"""
import_data.py
--------------
Reads the Excel dataset (Bike_Travel_Dataset_Coimbatore.xlsx) and loads it
into a local SQLite database (database.db) inside the backend folder.

Run this ONCE before starting the server, and again any time you replace
the Excel file with a newer version.

Usage:
    python import_data.py
"""

import os
import sqlite3
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
XLSX_PATH = os.path.join(BASE_DIR, "..", "Bike_Travel_Dataset_Coimbatore.xlsx")
DB_PATH = os.path.join(BASE_DIR, "database.db")

# Maps the human-readable Excel column headers to clean database column names
COLUMN_MAP = {
    "Trip Type (Solo/Duo/Squad/10 Members)": "trip_type",
    "Departure": "departure",
    "State": "state",
    "District": "district",
    "Nearest City/Town": "city",
    "Destination (Tourist Spot)": "destination",
    "Distance One-Way (km)": "distance_km",
    "Round Trip Distance (km)": "round_trip_km",
    "Avg Mileage (km/l)": "avg_mileage",
    "Petrol Required (litres)": "petrol_liters",
    "Petrol Price (INR/litre)": "petrol_price",
    "Petrol Fare (INR)": "petrol_fare",
    "No. of Persons": "persons",
    "Avg Food Fare per Person (INR)": "food_fare_per_person",
    "Total Food Fare (INR)": "total_food_fare",
    "No. of Tolls": "num_tolls",
    "Toll Fare per Toll (INR)": "toll_fare_per_toll",
    "Total Toll Fare (INR)": "total_toll_fare",
    "Medical Emergency Expense (INR)": "medical_expense",
    "Total Fare (INR) [TARGET]": "total_fare",
    "Duration (Days)": "duration_days",
    "Best Season to Visit": "best_season",
    "Month(s) of Season": "season_months",
    "Accommodation Available": "accommodation",
    "Temperature (deg C)": "temperature_c",
    "Humidity (%)": "humidity_percent",
    "Adventure Activities": "activities",
    "Entry Fee (INR)": "entry_fee",
    "Misc/Unplanned Expenses (INR)": "misc_expense",
}


def main():
    if not os.path.exists(XLSX_PATH):
        raise FileNotFoundError(
            f"Could not find dataset at {XLSX_PATH}. "
            "Place Bike_Travel_Dataset_Coimbatore.xlsx in the project root folder."
        )

    print(f"Reading dataset from {XLSX_PATH} ...")
    df = pd.read_excel(XLSX_PATH)

    # Drop the S.No column (we'll use SQLite's own row id instead) and rename columns
    df = df.drop(columns=["S.No"], errors="ignore")
    df = df.rename(columns=COLUMN_MAP)

    # Round numeric columns for cleaner storage/display
    numeric_cols = [
        "distance_km", "round_trip_km", "petrol_liters", "petrol_price", "petrol_fare",
        "food_fare_per_person", "total_food_fare", "toll_fare_per_toll", "total_toll_fare",
        "medical_expense", "total_fare", "temperature_c", "misc_expense",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = df[col].round(2)

    conn = sqlite3.connect(DB_PATH)
    df.to_sql("trips", conn, if_exists="replace", index=True, index_label="id")

    # Indexes make filtering/sorting fast even as the dataset grows
    conn.execute("CREATE INDEX IF NOT EXISTS idx_state ON trips(state)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_trip_type ON trips(trip_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_total_fare ON trips(total_fare)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_destination ON trips(destination)")
    conn.commit()
    conn.close()

    print(f"Done. Imported {len(df)} rows into {DB_PATH}")


if __name__ == "__main__":
    main()
