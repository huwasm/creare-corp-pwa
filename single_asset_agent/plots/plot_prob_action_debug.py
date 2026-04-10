import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Load the data
file_path = "evaluation_split_1.csv"
df = pd.read_csv(file_path)

# Convert date column to datetime
df['date'] = pd.to_datetime(df['date'])

# Sort by date
df = df.sort_values('date')

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)

# Price
ax1.plot(df['date'], df['price'])
ax1.set_ylabel("Price")

# Probabilities
ax2.plot(df['date'], df['prob_hold'], label='Hold')
ax2.plot(df['date'], df['prob_buy'], label='Buy')
ax2.plot(df['date'], df['prob_sell'], label='Sell')

ax2.legend()
ax2.set_ylabel("Probability")

plt.grid(True)
plt.tight_layout()

# Save as PNG
output_file = "time_series_plot.png"
plt.savefig(output_file, dpi=300)

# Optional: also show it
plt.show()

print(f"Plot saved as {output_file}")
