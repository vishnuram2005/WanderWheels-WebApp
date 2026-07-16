"""
app.py
------
Flask backend for the Coimbatore Bike Trip Explorer.

Serves:
  - Static frontend (index.html, style.css, script.js) from ../frontend
  - JSON REST API under /api/... backed by SQLite (database.db)

Run locally with:
    python app.py
Then open http://127.0.0.1:5000 in your browser.
"""

import os
import sqlite3
from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

ALLOWED_SORT_COLUMNS = {
    "total_fare", "distance_km", "duration_days",
    "temperature_c", "destination", "entry_fee",
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us access columns by name, like a dict
    return conn


# ---------- Serve the frontend ----------

@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


# ---------- Metadata endpoints (for filter dropdowns) ----------

@app.route("/api/states")
def get_states():
    conn = get_db()
    rows = conn.execute("SELECT DISTINCT state FROM trips ORDER BY state").fetchall()
    conn.close()
    return jsonify([r["state"] for r in rows])


@app.route("/api/trip_types")
def get_trip_types():
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT trip_type FROM trips "
        "ORDER BY CASE trip_type "
        "  WHEN 'Solo' THEN 1 WHEN 'Duo' THEN 2 WHEN 'Squad' THEN 3 "
        "  WHEN '10 Members' THEN 4 ELSE 5 END"
    ).fetchall()
    conn.close()
    return jsonify([r["trip_type"] for r in rows])


@app.route("/api/seasons")
def get_seasons():
    conn = get_db()
    rows = conn.execute("SELECT DISTINCT best_season FROM trips ORDER BY best_season").fetchall()
    conn.close()
    return jsonify([r["best_season"] for r in rows])


# ---------- Main listing endpoint ----------

@app.route("/api/destinations")
def get_destinations():
    conn = get_db()

    query = "SELECT * FROM trips WHERE 1=1"
    count_query = "SELECT COUNT(*) as cnt FROM trips WHERE 1=1"
    params = []

    state = request.args.get("state")
    trip_type = request.args.get("trip_type")
    search = request.args.get("search")
    season = request.args.get("season")
    min_fare = request.args.get("min_fare")
    max_fare = request.args.get("max_fare")

    filters = ""
    if state:
        filters += " AND state = ?"
        params.append(state)
    if trip_type:
        filters += " AND trip_type = ?"
        params.append(trip_type)
    if search:
        filters += " AND (destination LIKE ? OR city LIKE ? OR district LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like, like])
    if season:
        filters += " AND best_season LIKE ?"
        params.append(f"%{season}%")
    if min_fare:
        filters += " AND total_fare >= ?"
        params.append(float(min_fare))
    if max_fare:
        filters += " AND total_fare <= ?"
        params.append(float(max_fare))

    query += filters
    count_query += filters

    total = conn.execute(count_query, params).fetchone()["cnt"]

    sort_by = request.args.get("sort_by", "total_fare")
    if sort_by not in ALLOWED_SORT_COLUMNS:
        sort_by = "total_fare"
    order = "DESC" if request.args.get("order", "asc").lower() == "desc" else "ASC"

    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 12)), 1), 100)
    offset = (page - 1) * per_page

    query += f" ORDER BY {sort_by} {order} LIMIT ? OFFSET ?"
    rows = conn.execute(query, params + [per_page, offset]).fetchall()
    conn.close()

    return jsonify({
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max((total + per_page - 1) // per_page, 1),
        "results": [dict(r) for r in rows],
    })


@app.route("/api/destination/<int:trip_id>")
def get_destination(trip_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM trips WHERE id = ?", (trip_id,)).fetchone()
    conn.close()
    if row is None:
        return jsonify({"error": "Trip not found"}), 404
    return jsonify(dict(row))


# ---------- Stats endpoint (for charts) ----------

@app.route("/api/stats")
def get_stats():
    conn = get_db()

    by_trip_type = conn.execute("""
        SELECT trip_type, ROUND(AVG(total_fare), 2) AS avg_fare, COUNT(*) AS cnt
        FROM trips GROUP BY trip_type
        ORDER BY CASE trip_type
          WHEN 'Solo' THEN 1 WHEN 'Duo' THEN 2 WHEN 'Squad' THEN 3
          WHEN '10 Members' THEN 4 ELSE 5 END
    """).fetchall()

    by_state = conn.execute("""
        SELECT state, ROUND(AVG(total_fare), 2) AS avg_fare, COUNT(*) AS cnt
        FROM trips GROUP BY state ORDER BY avg_fare DESC LIMIT 10
    """).fetchall()

    overall = conn.execute("""
        SELECT ROUND(AVG(total_fare), 2) AS avg_fare,
               ROUND(MIN(total_fare), 2) AS min_fare,
               ROUND(MAX(total_fare), 2) AS max_fare,
               COUNT(*) AS cnt
        FROM trips
    """).fetchone()

    conn.close()
    return jsonify({
        "by_trip_type": [dict(r) for r in by_trip_type],
        "by_state": [dict(r) for r in by_state],
        "overall": dict(overall),
    })


if __name__ == "__main__":
    # debug=True auto-reloads on code changes -- turn this off in production
    app.run(debug=True, port=5000)
