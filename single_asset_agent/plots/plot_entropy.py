import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Load the data
file_path = "evaluation_split_1.csv"
#file_path = "aluminium_lme.csv"
df = pd.read_csv(file_path)

# Convert date column to datetime
df['date'] = pd.to_datetime(df['date'])

# Sort by date
df = df.sort_values('date')

# Plot
plt.figure(figsize=(12, 6))
scatter=plt.scatter(df['date'], df['price'], c=df['entropy'], cmap='viridis')
plt.plot(df['date'], df['price'], alpha=0.3)

# Add colorbar
cbar = plt.colorbar(scatter)
cbar.set_label('Entropy')

# Labels and title
plt.xlabel('Date')
plt.ylabel('Price')
plt.title('Time Series with entropy coloring')


plt.grid(True)
plt.tight_layout()

# Save as PNG
output_file = "time_series_plot.png"
plt.savefig(output_file, dpi=300)

# Optional: also show it
plt.show()

print(f"Plot saved as {output_file}")
