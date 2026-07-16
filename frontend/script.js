// ============================================================
// Config
// ============================================================
const API_BASE = ""; // same-origin: Flask serves both frontend & API

const state = {
  page: 1,
  per_page: 12,
};

let tripTypeChart = null;
let stateChart = null;

// ============================================================
// Helpers
// ============================================================
const fmtMoney = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtKm = (n) => Math.round(n).toLocaleString("en-IN") + " km";

function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// ============================================================
// Populate filter dropdowns
// ============================================================
async function loadFilterOptions() {
  const [states, tripTypes, seasons] = await Promise.all([
    fetchJSON(`${API_BASE}/api/states`),
    fetchJSON(`${API_BASE}/api/trip_types`),
    fetchJSON(`${API_BASE}/api/seasons`),
  ]);

  const stateSelect = document.getElementById("state");
  states.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    stateSelect.appendChild(opt);
  });

  const tripTypeSelect = document.getElementById("trip_type");
  tripTypes.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    tripTypeSelect.appendChild(opt);
  });

  const seasonSelect = document.getElementById("season");
  seasons.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    seasonSelect.appendChild(opt);
  });
}

// ============================================================
// Build query string from current filters
// ============================================================
function buildQuery() {
  const params = new URLSearchParams();
  const search = document.getElementById("search").value.trim();
  const stateVal = document.getElementById("state").value;
  const tripType = document.getElementById("trip_type").value;
  const season = document.getElementById("season").value;
  const sortBy = document.getElementById("sort_by").value;
  const order = document.getElementById("order").value;

  if (search) params.set("search", search);
  if (stateVal) params.set("state", stateVal);
  if (tripType) params.set("trip_type", tripType);
  if (season) params.set("season", season);
  params.set("sort_by", sortBy);
  params.set("order", order);
  params.set("page", state.page);
  params.set("per_page", state.per_page);

  return params.toString();
}

// ============================================================
// Fetch + render destination cards
// ============================================================
async function loadDestinations() {
  const cardsEl = document.getElementById("cards");
  cardsEl.innerHTML = `<p class="empty-state">Loading routes…</p>`;

  const query = buildQuery();
  const data = await fetchJSON(`${API_BASE}/api/destinations?${query}`);

  renderCards(data.results);
  renderResultsBar(data);
  renderPagination(data);
}

function renderCards(results) {
  const cardsEl = document.getElementById("cards");

  if (results.length === 0) {
    cardsEl.innerHTML = `<p class="empty-state">No routes match these filters. Try widening your search.</p>`;
    return;
  }

  cardsEl.innerHTML = results.map((r) => `
    <div class="card" data-id="${r.id}">
      <div class="card__marker">${fmtKm(r.distance_km)}</div>
      <span class="card__trip-type">${r.trip_type} · ${r.persons} ${r.persons === 1 ? "person" : "people"}</span>
      <h3>${r.destination}</h3>
      <p class="card__location">${r.city}, ${r.district}, ${r.state}</p>
      <div class="card__fare-label">Total fare (target)</div>
      <div class="card__fare">${fmtMoney(r.total_fare)}</div>
      <div class="card__meta">
        <div>⏱ <span>${r.duration_days} day${r.duration_days > 1 ? "s" : ""}</span></div>
        <div>🌡 <span>${r.temperature_c}°C</span></div>
        <div>🏨 <span>${r.accommodation}</span></div>
      </div>
    </div>
  `).join("");

  cardsEl.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openModal(card.dataset.id));
  });
}

function renderResultsBar(data) {
  const el = document.getElementById("results-count");
  const start = (data.page - 1) * data.per_page + 1;
  const end = Math.min(data.page * data.per_page, data.total);
  el.textContent = data.total === 0
    ? "No routes found"
    : `Showing ${start}–${end} of ${data.total} routes`;
}

function renderPagination(data) {
  const { page, total_pages } = data;
  const html = `
    <button ${page <= 1 ? "disabled" : ""} data-page="${page - 1}">‹ Prev</button>
    <span style="font-family: var(--font-mono); font-size: 13px; padding: 0 8px;">
      Page ${page} of ${total_pages}
    </span>
    <button ${page >= total_pages ? "disabled" : ""} data-page="${page + 1}">Next ›</button>
  `;
  ["pagination-top", "pagination-bottom"].forEach((id) => {
    const el = document.getElementById(id);
    el.innerHTML = html;
    el.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.page = Number(btn.dataset.page);
        loadDestinations();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  });
}

// ============================================================
// Modal (trip detail)
// ============================================================
async function openModal(id) {
  const backdrop = document.getElementById("modal-backdrop");
  const content = document.getElementById("modal-content");
  content.innerHTML = `<p>Loading…</p>`;
  backdrop.classList.add("open");

  const r = await fetchJSON(`${API_BASE}/api/destination/${id}`);

  content.innerHTML = `
    <button class="modal__close" id="modal-close">✕</button>
    <h2>${r.destination}</h2>
    <p class="modal__location">${r.city}, ${r.district}, ${r.state} · ${r.trip_type} (${r.persons} ${r.persons === 1 ? "person" : "people"})</p>
    <div class="modal-grid">
      <div><span>Distance one-way</span><strong>${fmtKm(r.distance_km)}</strong></div>
      <div><span>Round trip distance</span><strong>${fmtKm(r.round_trip_km)}</strong></div>
      <div><span>Petrol required</span><strong>${r.petrol_liters.toFixed(2)} L</strong></div>
      <div><span>Petrol fare</span><strong>${fmtMoney(r.petrol_fare)}</strong></div>
      <div><span>Food fare (total)</span><strong>${fmtMoney(r.total_food_fare)}</strong></div>
      <div><span>Toll fare (total)</span><strong>${fmtMoney(r.total_toll_fare)}</strong></div>
      <div><span>Medical emergency expense</span><strong>${fmtMoney(r.medical_expense)}</strong></div>
      <div><span>Misc / unplanned expenses</span><strong>${fmtMoney(r.misc_expense)}</strong></div>
      <div><span>Total fare</span><strong>${fmtMoney(r.total_fare)}</strong></div>
      <div><span>Duration</span><strong>${r.duration_days} days</strong></div>
      <div><span>Entry fee</span><strong>${fmtMoney(r.entry_fee)}</strong></div>
      <div><span>Best season</span><strong>${r.best_season}</strong></div>
      <div><span>Months</span><strong>${r.season_months}</strong></div>
      <div><span>Temperature</span><strong>${r.temperature_c}°C</strong></div>
      <div><span>Humidity</span><strong>${r.humidity_percent}%</strong></div>
      <div><span>Accommodation</span><strong>${r.accommodation}</strong></div>
      <div><span>Adventure activities</span><strong>${r.activities}</strong></div>
    </div>
  `;

  document.getElementById("modal-close").addEventListener("click", closeModal);
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("open");
}

document.getElementById("modal-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "modal-backdrop") closeModal();
});

// ============================================================
// Headline stats + charts
// ============================================================
async function loadStats() {
  const data = await fetchJSON(`${API_BASE}/api/stats`);

  document.getElementById("stat-count").textContent = data.overall.cnt.toLocaleString("en-IN");
  document.getElementById("stat-avg").textContent = fmtMoney(data.overall.avg_fare);

  renderTripTypeChart(data.by_trip_type);
  renderStateChart(data.by_state);
}

function renderTripTypeChart(rows) {
  const ctx = document.getElementById("chart-trip-type");
  if (tripTypeChart) tripTypeChart.destroy();
  tripTypeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.trip_type),
      datasets: [{
        label: "Avg total fare (₹)",
        data: rows.map((r) => r.avg_fare),
        backgroundColor: "#E8871E",
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => "₹" + v.toLocaleString("en-IN") } } },
    },
  });
}

function renderStateChart(rows) {
  const ctx = document.getElementById("chart-state");
  if (stateChart) stateChart.destroy();
  stateChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.state),
      datasets: [{
        label: "Avg total fare (₹)",
        data: rows.map((r) => r.avg_fare),
        backgroundColor: "#1F6E43",
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { callback: (v) => "₹" + v.toLocaleString("en-IN") } } },
    },
  });
}

// ============================================================
// Event wiring
// ============================================================
function resetPageAndReload() {
  state.page = 1;
  loadDestinations();
}

document.getElementById("search").addEventListener("input", debounce(resetPageAndReload));
["state", "trip_type", "season", "sort_by", "order"].forEach((id) => {
  document.getElementById(id).addEventListener("change", resetPageAndReload);
});

// ============================================================
// Init
// ============================================================
(async function init() {
  await loadFilterOptions();
  await loadDestinations();
  await loadStats();
})();
