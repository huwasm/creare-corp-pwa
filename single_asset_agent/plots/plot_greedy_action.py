import pandas as pd
import matplotlib.pyplot as plt

# Load the data
#file_path = "evaluation_split_1.csv"
file_path = "full_dataset_predictions_split_3.csv"

df = pd.read_csv(file_path)

# Convert date column to datetime
df['date'] = pd.to_datetime(df['date'])

# Sort by date
df = df.sort_values('date')

# Define colors for each action
color_map = {
    0: 'blue',
    1: 'green',
    2: 'red'
}

# Map colors
#colors = df['action'].map(color_map)
colors = df['greedy_action'].map(color_map)

# Plot
plt.figure(figsize=(12, 6))
plt.scatter(df['date'], df['price'], c=colors)
plt.plot(df['date'], df['price'], alpha=0.3)

# Labels and title
plt.xlabel('Date')
plt.ylabel('Price')
plt.title('Time Series with Action Coloring')

# Legend
import matplotlib.patches as mpatches
legend_handles = [
    mpatches.Patch(color='blue', label='Hold'),
    mpatches.Patch(color='green', label='Buy'),
    mpatches.Patch(color='red', label='Sell')
]
plt.legend(handles=legend_handles)

plt.grid(True)
plt.tight_layout()

# Save as PNG
output_file = "time_series_plot.png"
plt.savefig(output_file, dpi=300)

# Optional: also show it
plt.show()

print(f"Plot saved as {output_file}")
