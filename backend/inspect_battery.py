from pathlib import Path

from scipy.io import loadmat
import matplotlib.pyplot as plt

path = (
    Path(__file__).resolve().parent
    / "data"
    / "nasa_battery_mat"
    / "FY08Q4"
    / "B0005.mat"
)
battery = loadmat(path, squeeze_me=True, struct_as_record=False)["B0005"]

capacities = []

for event in battery.cycle:
    if event.type == "discharge" and hasattr(event.data, "Capacity"):
        capacities.append(float(event.data.Capacity))

print("Discharge measurements:", len(capacities))
print("First capacity:", capacities[0], "Ah")
print("Last capacity:", capacities[-1], "Ah")

initial_capacity = capacities[0]
latest_capacity = capacities[-1]

retention_percent = (latest_capacity / initial_capacity) * 100
capacity_reduction_percent = 100 - retention_percent

print(f"Capacity retention since first recorded discharge: {retention_percent:.2f}%")
print(f"Capacity reduction: {capacity_reduction_percent:.2f}%")

discharge_numbers = range(1, len(capacities) + 1)

fig, ax = plt.subplots(figsize=(10, 5))

fig.patch.set_facecolor("#C39D72")
ax.set_facecolor("#a0aca4")

ax.plot(
    discharge_numbers,
    capacities,
    color="#AC6936",
    linewidth=2,
    marker="o",
    markersize=3,
)

ax.set_title("vehicle capacity: Discharge Capacity", color="#f4f5f5")
ax.set_xlabel("Discharge measurement", color="#131614")
ax.set_ylabel("Capacity (Ah)", color="#1d231f")
ax.tick_params(colors="#000000")
ax.grid(color="#0F0F0E", alpha=0.5)

for spine in ax.spines.values():
    spine.set_color("#505650")

fig.tight_layout()
plt.show()