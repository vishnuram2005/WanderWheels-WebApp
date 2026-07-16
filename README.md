# Coimbatore Bike Trip Explorer

A full-stack web app for exploring the 885-row bike travel dataset:
filter by state, group size, season, or fare; sort results; and see
charts of average fare by group size and by state.

```
webapp/
├── Bike_Travel_Dataset_Coimbatore.xlsx   ← your dataset (source of truth)
├── backend/
│   ├── app.py             ← Flask server + REST API
│   ├── import_data.py     ← loads the Excel file into SQLite
│   ├── requirements.txt   ← Python dependencies
│   └── database.db        ← created after you run import_data.py
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

---

## 1. How the pieces fit together

```
 Excel file  --import_data.py-->  SQLite (database.db)
                                          │
                                          ▼
                              Flask (app.py) reads it and
                              exposes JSON at /api/...
                                          │
                                          ▼
                    Browser loads index.html, style.css, script.js
                    script.js calls fetch('/api/destinations?...')
                    and renders cards, pagination, and charts
```

- **The dataset never gets edited in place.** `import_data.py` reads the
  `.xlsx` once and copies it into a SQLite table called `trips`. SQLite is
  a single-file database (no server to install) — perfect for a dataset
  this size.
- **Flask** (`app.py`) is a small Python web framework. Each `@app.route(...)`
  is one URL the browser can call. Some routes serve the frontend files;
  the rest (`/api/...`) return JSON.
- **The frontend is plain HTML/CSS/JS** — no build step, no framework.
  `script.js` uses the browser's built-in `fetch()` to call your API and
  update the page.

---

## 2. Run it on your own computer

You need Python 3.9+ installed.

```bash
# 1. Go into the backend folder
cd webapp/backend

# 2. (Recommended) create a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Load the Excel dataset into SQLite (run once, or again after updating the Excel file)
python import_data.py

# 5. Start the server
python app.py
```

Now open **http://127.0.0.1:5000** in your browser. That's it — Flask is
serving both the API and the frontend on the same address.

**To update the data later:** replace `Bike_Travel_Dataset_Coimbatore.xlsx`
in the project root with your new version, then re-run
`python import_data.py` and restart `app.py`.

---

## 3. Understanding the API (so you can extend it)

| Endpoint | What it does |
|---|---|
| `GET /api/states` | List of distinct states, for the state dropdown |
| `GET /api/trip_types` | Solo / Duo / Small Group / Medium Group / Large Group |
| `GET /api/seasons` | Distinct "best season" values |
| `GET /api/destinations?state=Kerala&trip_type=Solo&search=falls&sort_by=total_fare&order=asc&page=1&per_page=12` | Filtered, sorted, paginated list of trips |
| `GET /api/destination/<id>` | Full detail for one row (used by the modal popup) |
| `GET /api/stats` | Aggregates for the charts: avg fare by group size, avg fare by state, overall min/max/avg |

All filter parameters on `/api/destinations` are optional and combine with
`AND`. Try it directly in your browser, e.g.:
`http://127.0.0.1:5000/api/destinations?state=Karnataka&sort_by=total_fare&order=desc`

To add a new filter (say, filter by `activities`), the pattern in
`app.py` is:
1. Read it: `activity = request.args.get("activities")`
2. Add to the query: `if activity: filters += " AND activities LIKE ?"; params.append(f"%{activity}%")`
3. (Optional) expose it in the frontend as a new `<select>` and read it in `buildQuery()` in `script.js`.

---

## 4. Hosting it online

You have two realistic paths. **Option A (single app) is simplest** because
Flask already serves the frontend — deploy once, done.

### Option A — Render.com (recommended, free tier available)

1. Push your `webapp/` folder to a GitHub repository.
2. Go to [render.com](https://render.com) → New → **Web Service** → connect
   your GitHub repo.
3. Set:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt && python import_data.py`
   - **Start Command:** `gunicorn app:app`
4. Deploy. Render gives you a public URL like `https://your-app.onrender.com`.

Notes:
- `gunicorn` (already in `requirements.txt`) is the production server —
  never use Flask's built-in `app.run(debug=True)` in production, it's
  single-threaded and unsafe to expose publicly.
- Free-tier Render apps sleep after inactivity and take ~30s to wake up
  on the next request — fine for a portfolio/demo project.
- Because `import_data.py` runs during the build step, `database.db` gets
  rebuilt fresh from your Excel file every deploy.

### Option B — PythonAnywhere (also free, good if you're newer to deployment)

1. Sign up at [pythonanywhere.com](https://www.pythonanywhere.com).
2. Upload your `webapp/` folder (Files tab, or `git clone` via their Bash console).
3. Open a Bash console there and run:
   ```bash
   cd webapp/backend
   pip install --user -r requirements.txt
   python import_data.py
   ```
4. Go to the **Web** tab → Add a new web app → **Flask** → point it at
   `webapp/backend/app.py`. PythonAnywhere handles the WSGI wiring for you.
5. Reload the web app. You get a URL like `yourname.pythonanywhere.com`.

### Splitting frontend and backend (optional, more advanced)

If you'd rather host the frontend separately (e.g. on Netlify/Vercel/GitHub
Pages) and the backend on Render/PythonAnywhere:
1. In `app.py`, add CORS support: `pip install flask-cors`, then
   `from flask_cors import CORS` and `CORS(app)` right after `app = Flask(...)`.
2. In `script.js`, change `const API_BASE = "";` to your backend's full URL,
   e.g. `const API_BASE = "https://your-app.onrender.com";`.
3. Deploy `frontend/` as a static site, and `backend/` as its own service.

This is more moving parts for no real benefit at this scale — stick with
Option A unless you have a specific reason to split them.

---

## 5. Common issues

| Problem | Fix |
|---|---|
| `FileNotFoundError` when running `import_data.py` | Make sure `Bike_Travel_Dataset_Coimbatore.xlsx` sits in `webapp/` (one level above `backend/`), not inside `backend/`. |
| Blank page / "Failed to fetch" in browser console | The Flask server isn't running, or you opened `index.html` directly as a `file://` path instead of via `http://127.0.0.1:5000`. Always load it through Flask so `fetch('/api/...')` resolves correctly. |
| Changes to `.xlsx` don't show up | Re-run `python import_data.py` — it's a one-way import, not a live link. |
| `ModuleNotFoundError: No module named 'flask'` | You're not in the virtual environment, or forgot `pip install -r requirements.txt`. |
| Port 5000 already in use | Change the last line of `app.py` to `app.run(debug=True, port=5001)` (or any free port). |
