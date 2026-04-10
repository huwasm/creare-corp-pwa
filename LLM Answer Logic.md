# Metals Intelligence Monitor

> A decision-support tool for commodity buyers and procurement managers — combining price analysis and market sentiment into a plain-language recommendation.

---

## 🎯 Business Scenario

Commodity buyers and procurement managers need to act on volatile metals markets every day. The tools available are either too technical, too slow, or too fragmented — requiring someone to manually reconcile price trends, news feeds, and judgment before making a call.

This system solves that by combining two analytical layers — price momentum and news sentiment — into a single, readable signal. A non-technical decision-maker can select a commodity and a date, and get a clear briefing in under 60 seconds.

**Commodities in scope:** Copper (LME) · Nickel (LME) · Aluminium (LME)

---

## 📁 Dataset

User selects commodity + date
        ↓
Price Block runs
  → filters prices.csv to selected_commodity
  → computes ROC, ARIMA, GARCH up to selected_date
  → outputs: signal, flag, roc_14d_pct, vol_level,
             forecast_dir, recommendation
        ↓
Sentiment Block runs
  → filters news to selected_commodity
  → window: selected_date − 30 days → selected_date
  → runs FinBERT + decay weighting on that window
  → outputs: sentiment_tier, top_headlines (sorted)
        ↓
### Block 1 — Price Block

**Data prep**
1. Load `prices.csv`, parse date, sort ascending.
2. Pivot to wide format: rows = trading days, columns = commodities.
3. Validate: no missing prices, minimum 500 trading days per commodity.
4. Compute `daily_change = Price_t / Price_t−1` (input to Engine B).
5. Compute `log_return = log(Price_t / Price_t−1)` (reference only).

**Engine A — S1 Tactical Momentum**
```python
ROC = (Price_today - Price_20d_ago) / Price_20d_ago
Score_A = np.tanh(ROC * scaling_factor)
# scaling_factor: calibrate so typical ROC maps to −0.5 → +0.5 before tanh
# range: −1.0 to +1.0
```

**Engine B — B1 Direction Forecast (ARIMA)**
```python
# Input: daily_change series
# Auto-ARIMA finds optimal (p, d, q) per commodity
cumulative_return = prod(forecast_daily_change[t+1 ... t+30])
Score_B = np.tanh(cumulative_return - 1)
# range: −1.0 to +1.0
```

**Engine B — B2 Forward Volatility (GARCH)**
```python
# GARCH(1,1) on daily_change — forecasts conditional variance t+1 to t+30
# percentile_rank(mean_fwd_variance, full_history)
# < 33  → Low
# 33–66 → Moderate
# > 66  → High
# Feeds flag — does NOT affect Score B
```

**Final Score**
```python
Final_Score = (0.60 * Score_A) + (0.40 * Score_B)
# range: −1.0 (strongly bearish) to +1.0 (strongly bullish)
```

**Signal assignment — calibrated per commodity**
```python
# Run once at calibration across full history
p25 = np.percentile(all_final_scores, 25)
p75 = np.percentile(all_final_scores, 75)

if Final_Score > p75:  signal = 'Up'
elif Final_Score < p25: signal = 'Down'
else:                   signal = 'Neutral'
```

**Flag assignment**

| Signal | GARCH forward vol | Flag |
|---|---|---|
| Up | Low | Stable |
| Up | Moderate or High | Watch |
| Neutral | Any | Watch |
| Down | Low or Moderate | Watch |
| Down | High | Alert |


---

### Block 2 — Sentiment Block (FinBERT)

**Method**
1. Pull headlines for selected commodity over `selected_date − 30 days → selected_date`.
2. Run FinBERT on each headline → `{positive, neutral, negative}` confidence scores (sum to 1.0).
3. Apply time-decay weight per headline:
```python
decay_weight = np.exp(-0.05 * days_ago)
# today → 1.0 | 14 days ago → ~0.50 | 30 days ago → ~0.22
```
4. Aggregate per label across all headlines:
```python
weighted_score[label] = sum(decay_weight_i * finbert_confidence_i[label])
```
5. Dominant label = `sentiment_tier`.
6. Rank headlines by `decay_weight × dominant_confidence` → top 3 = `top_headlines`.

**Sentiment Block output contract**
```json
{
  "sentiment_tier":     "string",   // 'Positive' | 'Neutral' | 'Negative'
  "weighted_positive":  "float",
  "weighted_neutral":   "float",
  "weighted_negative":  "float",
  "headline_count":     "int",
  "top_headlines": [
    {
      "headline":   "string",
      "source":     "string",
      "date":       "string",
      "label":      "string",   // 'Positive' | 'Neutral' | 'Negative'
      "confidence": "float"
    }
  ]
}
```

---

### Block 3 — Decision Block

**Matrix: Price signal × Sentiment tier**

|  | Negative | Neutral | Positive |
|---|---|---|---|
| **Up** | Hold | Buy | Strong Buy |
| **Neutral** | Avoid | Hold | Buy |
| **Down** | Avoid | Avoid | Hold |

**Flag modifiers (applied after matrix lookup)**

| Flag | Condition | Effect |
|---|---|---|
| Alert | Always | Override to **Avoid** — hard rule |
| Watch | Signal is Up | Downgrade one level (Strong Buy→Buy, Buy→Hold) |
| Watch | Signal is Neutral or Down | No change — Watch is already the baseline |
| Stable | Any | No change — use matrix result as-is |

**Time window by recommendation**

| Recommendation | User-facing label |
|---|---|
| Strong Buy | Act within 24–48 hours |
| Buy | Act within the next 3–5 days |
| Hold | Revisit in 1–2 weeks |
| Avoid | No clear entry point — wait |

---

## 🤖 LLM Prompt

Set this as the **system prompt**. Pass the assembled Price Block + Sentiment Block JSON as the **user message**. No additional instructions needed in the user turn.

```
You are the analyst engine for the Metals Intelligence Monitor, a decision-support
tool for commodity buyers and procurement managers.

You will receive structured data from two analytical blocks. Your job is to
generate a plain-language briefing that a non-technical buyer can read in under
60 seconds and act on.

───────────────────────────────────────
DATA TO REVIEW
───────────────────────────────────────

PRICE:
* commodity: the metal being analysed
* signal: Up | Neutral | Down
* flag: Stable | Watch | Alert
* roc_14d_pct: price % change over the last 14 days
* vol_level: Low | Moderate | High (forward volatility from GARCH)
* forecast_dir: upward | flat | downward (ARIMA 30-day forecast)
* recommendation: Strong Buy | Buy | Hold | Avoid

SENTIMENT BLOCK:
* sentiment_tier: Positive | Neutral | Negative
* top_headlines: array of the 3 most influential headlines from the last 30 days,
  each with: headline text, source, date, sentiment label (Positive/Neutral/Negative)

───────────────────────────────────────
OUTPUT FORMAT — ALWAYS IN THIS ORDER
───────────────────────────────────────

1. PRICE SUMMARY (2–3 sentences)
   What the price has been doing over the last 30 days. Mention the direction,
   the 14-day change as a percentage, and what the forecast suggests.
   Do not use the words "ARIMA", "GARCH", "ROC", "signal", "score", or any
   technical model name. Speak as if explaining to a colleague who does not
   follow markets daily.

2. MARKET NEWS (3 bullet points)
   List the 3 top headlines driving the sentiment assessment. For each, write:
   * One sentence in plain language summarising what happened and why it matters
     for this commodity. Do not copy the headline verbatim — rephrase it simply.
   * The source and date in parentheses.
   * A sentiment tag: 📈 Positive | ➖ Neutral | 📉 Negative

3. RECOMMENDATION (1–2 sentences)
   Close with the recommendation. Never use the words "buy", "sell", or "avoid"
   as direct commands. Frame it as what current conditions suggest.
   If the flag is Watch or Alert, name the specific risk in plain terms.
   Tone: calm, direct, helpful — like a trusted analyst giving a colleague
   a quick read before a meeting.

───────────────────────────────────────
LANGUAGE RULES — ALWAYS FOLLOW
───────────────────────────────────────

* No financial jargon. No model names. No probability language.
* Write in full sentences. No headers inside the output.
* Maximum 200 words total across all three sections.
* Never say "based on the data" or "according to the analysis" —
  just say what is happening.
* If flag is Alert: the closing line must clearly signal caution.
  Use language like "this is not the right moment" or "conditions
  are not favorable right now."
* If flag is Stable and recommendation is Strong Buy: the tone can
  be more confident — "conditions are aligned" is appropriate.
* Always end on the recommendation. Never end on a news point.
```

**Example user message:**

Then the user asks something like:

"Should I be buying copper right now?"
"What is happening with aluminium this month?"
"Is nickel a good position given the current news?"

**Expected output:**
> Copper has lost 4.2% over the past two weeks and the pressure does not appear
> to be easing — the short-term outlook points to further decline. Price swings
> have been larger than usual, adding an extra layer of uncertainty for anyone
> considering a new position.
>
> * 📉 China's factory activity contracted for the third month in a row, which
>   directly reduces demand for copper in manufacturing and construction.
>   (Bloomberg, 12 Apr 2025)
> * 📉 Copper stockpiles at major exchanges have reached their highest level in
>   six months, a sign that supply is outpacing current demand. (Reuters, 9 Apr 2025)
> * ➖ Mining output in Chile remains stable despite ongoing labour talks, so
>   supply disruption is not a near-term factor. (WSJ, 6 Apr 2025)
>
> Both the price trend and the news environment are pointing in the same direction
> right now. This is not the right moment to act on copper — it is worth waiting
> for demand signals to stabilise before revisiting.


---

*Metals Intelligence Monitor · System Spec v2.1 · Price Block: ROC + ARIMA + GARCH · Sentiment: FinBERT confidence-weighted · Decision: matrix + LLM*
