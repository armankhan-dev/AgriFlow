const appState = { farms: [], readings: [], activeFarmId: null, toastTimer: null, trackerCharts: {} };
const byId = (id) => document.getElementById(id);

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(appState.toastTimer);
  appState.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch { /* Keep the status message. */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value ?? 0);
}

function moistureStatus(value) {
  return value < 25 ? ["Critical", "critical"] : value < 35 ? ["Low", "warning"] : ["In range", ""];
}

function farmInitials(crop) {
  return (crop || "F").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function farmMoisture(farm) {
  return appState.readings.find((reading) => reading.farmId === farm.id)?.moisture ?? farm.soilMoisture;
}

function renderFarms() {
  const farms = appState.farms;
  if (!farms.some((farm) => farm.id === appState.activeFarmId)) appState.activeFarmId = farms[0]?.id ?? null;
  byId("farm-nav-count").textContent = farms.length;
  byId("farm-count-label").textContent = `${farms.length} farm${farms.length === 1 ? "" : "s"}`;
  byId("overview-farms").innerHTML = farms.slice(0, 4).map((farm) => {
    const [status, variant] = moistureStatus(farm.soilMoisture);
    const selected = farm.id === appState.activeFarmId ? "selected" : "";
    return `<button class="zone-card ${selected}" data-select-farm="${farm.id}"><span class="zone-main"><i class="zone-dot ${variant}"></i><span class="zone-title">${escapeHtml(farm.name)}</span></span><span class="zone-value ${variant}">${formatNumber(farm.soilMoisture, 1)}%</span><span class="zone-meta">${escapeHtml(farm.crop)} · ${escapeHtml(farm.location)}</span><span class="status-pill ${variant}"><i></i>${status}</span></button>`;
  }).join("") || `<div class="loading-row">No farms yet. Add your first farm to get started.</div>`;
  renderFieldMarkers();
  renderCropHealth();
  renderFarmTable();
  renderFarmOptions();
  updateSelectedFarm();
}

function renderFieldMarkers() {
  const positions = [["27%", "35%"], ["68%", "42%"], ["42%", "63%"]];
  byId("field-markers").innerHTML = appState.farms.slice(0, 3).map((farm, index) => {
    const [status, variant] = moistureStatus(farm.soilMoisture);
    const selected = farm.id === appState.activeFarmId ? "selected" : "";
    return `<button class="field-marker ${variant} ${selected}" style="left:${positions[index][0]};top:${positions[index][1]}" data-select-farm="${farm.id}">${escapeHtml(farm.name)}<small>${escapeHtml(farm.crop)} · ${status}</small></button>`;
  }).join("");
}

function renderCropHealth() {
  const filters = trackerFilters();
  const farms = appState.farms.filter((farm) => {
    const [status] = moistureStatus(farmMoisture(farm));
    const health = status === "Critical" ? "critical" : status === "Low" ? "warning" : "healthy";
    return (filters.crop === "all" || farm.crop === filters.crop)
      && (filters.farm === "all" || String(farm.id) === filters.farm)
      && (filters.health === "all" || health === filters.health)
      && (filters.region === "all" || farmRegion(farm) === filters.region);
  });
  const farmIds = new Set(farms.map((farm) => farm.id));
  const readings = appState.readings.filter((reading) => {
    const date = new Date(reading.observedAt);
    return farmIds.has(reading.farmId)
      && (filters.year === "all" || date.getFullYear() === Number(filters.year))
      && (filters.month === "all" || date.getMonth() === Number(filters.month));
  });
  const latestByFarm = new Map();
  for (const reading of readings) if (!latestByFarm.has(reading.farmId)) latestByFarm.set(reading.farmId, reading);
  const moistureValues = filters.year === "all" && filters.month === "all"
    ? farms.map(farmMoisture)
    : [...latestByFarm.values()].map((reading) => reading.moisture);
  const avgMoisture = moistureValues.length ? moistureValues.reduce((total, value) => total + value, 0) / moistureValues.length : null;
  const attentionCount = farms.filter((farm) => farmMoisture(farm) < 30).length;

  byId("tracker-kpi-farms").textContent = formatNumber(farms.length);
  byId("tracker-kpi-hectares").textContent = formatNumber(farms.reduce((total, farm) => total + farm.hectares, 0), 1);
  byId("tracker-kpi-moisture").textContent = avgMoisture === null ? "—" : formatNumber(avgMoisture, 1);
  byId("tracker-kpi-water").textContent = formatNumber(farms.reduce((total, farm) => total + farm.waterNeed, 0));
  byId("tracker-kpi-alerts").textContent = formatNumber(attentionCount);
  byId("tracker-health-value").textContent = avgMoisture === null ? "—%" : `${formatNumber(avgMoisture, 1)}%`;

  const rows = farms.map((farm) => {
    const moisture = farmMoisture(farm);
    const [status, variant] = moistureStatus(moisture);
    return `<tr><td class="farm-table-name"><strong>${escapeHtml(farm.name)}</strong><small>${escapeHtml(farm.location)}</small></td><td>${escapeHtml(farm.crop)}</td><td>${escapeHtml(farmRegion(farm))}</td><td>${formatNumber(moisture, 1)}%</td><td>${formatNumber(farm.waterNeed)} L</td><td><span class="status-pill ${variant}"><i></i>${status}</span></td></tr>`;
  }).join("");
  byId("crop-table-body").innerHTML = rows || `<tr><td colspan="6" class="loading-row">No farms match these filters.</td></tr>`;
  renderTrackerCharts(farms, readings, avgMoisture);
}

function farmRegion(farm) {
  const pieces = farm.location.split(",").map((part) => part.trim());
  return pieces.length > 1 ? pieces.at(-1) : pieces[0];
}

function trackerFilters() {
  return {
    year: byId("tracker-year").value,
    month: byId("tracker-month").value,
    crop: byId("tracker-crop").value,
    farm: byId("tracker-farm").value,
    health: byId("tracker-health").value,
    region: byId("tracker-region").value
  };
}

function updateTrackerFilterOptions() {
  const setOptions = (id, items, labelFor = (item) => item.value) => {
    const select = byId(id);
    const selected = select.value || "all";
    select.innerHTML = `<option value="all">${id === "tracker-year" ? "All years" : id === "tracker-crop" ? "All crops" : id === "tracker-farm" ? "All farms" : "All regions"}</option>`
      + items.map((item) => `<option value="${escapeHtml(String(item.value))}">${escapeHtml(labelFor(item))}</option>`).join("");
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  };
  const years = [...new Set(appState.readings.map((reading) => new Date(reading.observedAt).getFullYear()))].sort((a, b) => b - a);
  setOptions("tracker-year", years.map((year) => ({ value: year })), (item) => String(item.value));
  setOptions("tracker-crop", [...new Set(appState.farms.map((farm) => farm.crop))].sort().map((crop) => ({ value: crop })));
  setOptions("tracker-farm", [...appState.farms].sort((a, b) => a.name.localeCompare(b.name)).map((farm) => ({ value: farm.id, label: farm.name })), (item) => item.label);
  setOptions("tracker-region", [...new Set(appState.farms.map(farmRegion))].sort().map((region) => ({ value: region })));
}

function renderTrackerCharts(farms, readings, avgMoisture) {
  if (!window.Chart) return;
  const chartText = "#a6acc3";
  const gridColor = "#41465f";
  const baseOptions = { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { display: false } } };
  const draw = (key, canvasId, config) => {
    if (appState.trackerCharts[key]) appState.trackerCharts[key].destroy();
    appState.trackerCharts[key] = new Chart(byId(canvasId), config);
  };
  const gaugeValue = avgMoisture === null ? 0 : Math.max(0, Math.min(100, avgMoisture));
  const gaugeColor = gaugeValue < 25 ? "#ff7187" : gaugeValue < 35 ? "#9b83ff" : "#26c2d3";
  draw("health", "tracker-health-chart", {
    type: "doughnut",
    data: { labels: ["Moisture index", "Remaining"], datasets: [{ data: [gaugeValue, 100 - gaugeValue], backgroundColor: [gaugeColor, "#424760"], borderWidth: 0, hoverOffset: 0 }] },
    options: { ...baseOptions, rotation: 270, circumference: 180, cutout: "78%", plugins: { ...baseOptions.plugins, tooltip: { enabled: false } } }
  });

  const moistureColors = farms.map((farm) => {
    const moisture = farmMoisture(farm);
    return moisture < 25 ? "#ff7187" : moisture < 35 ? "#9b83ff" : "#26c2d3";
  });
  draw("farms", "tracker-farm-chart", {
    type: "bar",
    data: { labels: farms.map((farm) => farm.name), datasets: [{ data: farms.map(farmMoisture), backgroundColor: moistureColors, borderRadius: 3, barThickness: 14 }] },
    options: { ...baseOptions, indexAxis: "y", layout: { padding: { right: 18 } }, scales: { x: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: chartText, font: { size: 9 }, callback: (value) => `${value}%` } }, y: { grid: { display: false }, ticks: { color: chartText, font: { size: 9 } } } }, plugins: { ...baseOptions.plugins, tooltip: { callbacks: { label: (context) => ` ${context.raw}% moisture` } } } }
  });

  const cropCounts = new Map();
  farms.forEach((farm) => cropCounts.set(farm.crop, (cropCounts.get(farm.crop) || 0) + 1));
  const cropColors = ["#806bf0", "#1fc1d2", "#42c99a", "#e5ad56", "#b19dff", "#59a9c5"];
  const crops = [...cropCounts.entries()];
  draw("crops", "tracker-crop-chart", {
    type: "doughnut",
    data: { labels: crops.map(([crop]) => crop), datasets: [{ data: crops.map(([, count]) => count), backgroundColor: crops.map((_, index) => cropColors[index % cropColors.length]), borderColor: "#2c3048", borderWidth: 3, hoverOffset: 4 }] },
    options: { ...baseOptions, cutout: "66%", plugins: { ...baseOptions.plugins, tooltip: { callbacks: { label: (context) => ` ${context.label}: ${context.raw} farm${context.raw === 1 ? "" : "s"}` } } } }
  });
  byId("tracker-crop-legend").innerHTML = crops.map(([crop, count], index) => `<div><i style="--crop-color:${cropColors[index % cropColors.length]}"></i><span>${escapeHtml(crop)}</span><b>${count}</b></div>`).join("") || `<span class="chart-empty-label">No crop data</span>`;

  const orderedReadings = [...readings].sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
  draw("trend", "tracker-trend-chart", {
    type: "line",
    data: { labels: orderedReadings.map((reading) => new Date(reading.observedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })), datasets: [{ label: "Soil moisture", data: orderedReadings.map((reading) => reading.moisture), borderColor: "#26c2d3", backgroundColor: "#26c2d324", fill: true, tension: 0.32, pointRadius: orderedReadings.length > 12 ? 1.5 : 3, pointBackgroundColor: "#9a85ff", borderWidth: 2 }] },
    options: { ...baseOptions, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, color: chartText, font: { size: 8 } } }, y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: chartText, font: { size: 8 }, callback: (value) => `${value}%` } } }, plugins: { ...baseOptions.plugins, tooltip: { callbacks: { label: (context) => ` ${context.raw}% moisture` } } } }
  });

  draw("water", "tracker-water-chart", {
    type: "bar",
    data: { labels: farms.map((farm) => farm.name), datasets: [{ data: farms.map((farm) => farm.waterNeed), backgroundColor: farms.map((_, index) => cropColors[index % cropColors.length]), borderRadius: 3, barThickness: 14 }] },
    options: { ...baseOptions, indexAxis: "y", layout: { padding: { right: 18 } }, scales: { x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: chartText, font: { size: 8 }, callback: (value) => formatCompact(value) } }, y: { grid: { display: false }, ticks: { color: chartText, font: { size: 8 } } } }, plugins: { ...baseOptions.plugins, tooltip: { callbacks: { label: (context) => ` ${formatNumber(context.raw)} L/day` } } } }
  });
}

function formatCompact(value) {
  return value >= 1000 ? `${formatNumber(value / 1000, 1)}k` : formatNumber(value);
}

function updateSelectedFarm() {
  const farm = appState.farms.find((item) => item.id === appState.activeFarmId);
  if (!farm) return;
  const [status, variant] = moistureStatus(farm.soilMoisture);
  const latest = appState.readings.find((reading) => reading.farmId === farm.id);
  byId("selected-location").textContent = farm.location;
  byId("active-farm-name").textContent = farm.name;
  byId("active-farm-status").textContent = `${farm.crop} · ${status}`;
  byId("active-farm-status").className = variant;
  byId("active-farm-moisture").textContent = `${formatNumber(farm.soilMoisture, 1)}%`;
  byId("active-moisture-bar").style.width = `${Math.min(100, Math.max(0, farm.soilMoisture))}%`;
  byId("field-crop-name").textContent = `${farm.crop} fields`;
  byId("field-location-caption").innerHTML = `${escapeHtml(farm.location)} <b>·</b> Latest field observation`;
  byId("field-temperature").textContent = latest ? `${formatNumber(latest.temperature, 1)}°C` : "—°C";
  byId("farm-select").value = String(farm.id);
  document.querySelectorAll("[data-select-farm]").forEach((marker) => marker.classList.toggle("selected", marker.dataset.selectFarm === String(farm.id)));
  byId("insight-title").textContent = appState.farms.some((item) => item.soilMoisture < 30) ? "Irrigation watch" : "Conditions look steady";
  byId("insight-copy").textContent = appState.farms.some((item) => item.soilMoisture < 30)
    ? `${appState.farms.filter((item) => item.soilMoisture < 30).length} farm locations are below 30% soil moisture. Review water planning before the next field round.`
    : "Farm moisture readings are holding above the attention threshold. Keep an eye on the next sensor update.";
  window.agriflowFarmData = { farms: appState.farms, activeFarmId: appState.activeFarmId };
  window.dispatchEvent(new CustomEvent("agriflow:farm-selection", { detail: window.agriflowFarmData }));
}

function renderFarmTable() {
  const query = (byId("farm-filter")?.value || "").trim().toLowerCase();
  const visible = appState.farms.filter((farm) => [farm.name, farm.location, farm.crop].some((value) => value.toLowerCase().includes(query)));
  byId("farm-table-body").innerHTML = visible.map((farm) => {
    const [status, variant] = moistureStatus(farm.soilMoisture);
    return `<tr><td class="farm-table-name"><strong>${escapeHtml(farm.name)}</strong><small>${escapeHtml(farm.location)}</small></td><td>${escapeHtml(farm.crop)}</td><td>${formatNumber(farm.hectares, 1)} ha</td><td>${formatNumber(farm.soilMoisture, 1)}%</td><td>${formatNumber(farm.waterNeed)} L/day</td><td><span class="status-pill ${variant}"><i></i>${status}</span></td><td><button class="delete-button" data-delete-farm="${farm.id}" aria-label="Delete ${escapeHtml(farm.name)}">Remove</button></td></tr>`;
  }).join("") || `<tr><td colspan="7" class="loading-row">${query ? "No farms match your search." : "No farms added yet."}</td></tr>`;
}

function renderFarmOptions() {
  [byId("sensor-farm"), byId("farm-select")].forEach((select) => {
    const previous = select.id === "farm-select" ? appState.activeFarmId : select.value;
    select.innerHTML = appState.farms.map((farm) => `<option value="${farm.id}">${escapeHtml(farm.name)}</option>`).join("");
    if (appState.farms.some((farm) => String(farm.id) === String(previous))) select.value = String(previous);
    select.disabled = appState.farms.length === 0;
  });
}

function renderReadings() {
  const readings = appState.readings;
  byId("sensor-total").textContent = formatNumber(readings.length);
  byId("sensor-temp").textContent = readings.length ? `${formatNumber(readings[0].temperature, 1)}°` : "—";
  byId("sensor-rain").textContent = readings.length ? `${formatNumber(readings[0].rainfall, 1)} mm` : "—";
  byId("overview-readings").innerHTML = readings.slice(0, 3).map((reading) => `<div class="reading-item"><span><strong>${escapeHtml(reading.farmName)}</strong><small>${relativeTime(reading.observedAt)}</small></span><span class="reading-values">${formatNumber(reading.moisture, 1)}% <small>${formatNumber(reading.temperature, 1)}°C · ${formatNumber(reading.rainfall, 1)} mm</small></span></div>`).join("") || `<div class="loading-row">No observations recorded yet.</div>`;
  byId("sensor-table-body").innerHTML = readings.map((reading) => `<tr><td>${escapeHtml(reading.farmName)}</td><td>${formatNumber(reading.moisture, 1)}%</td><td>${formatNumber(reading.temperature, 1)}°C</td><td>${formatNumber(reading.rainfall, 1)} mm</td><td>${new Date(reading.observedAt).toLocaleString()}</td></tr>`).join("") || `<tr><td colspan="5" class="loading-row">No observations recorded yet.</td></tr>`;
}

function relativeTime(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function refreshData() {
  try {
    const [dashboard, farms, readings] = await Promise.all([api("/api/dashboard"), api("/api/farms"), api("/api/sensors")]);
    appState.farms = farms;
    appState.readings = readings;
    byId("metric-area").textContent = formatNumber(dashboard.totalHectares, 1);
    byId("metric-farms").textContent = dashboard.farmCount;
    byId("metric-moisture").textContent = `${formatNumber(dashboard.averageMoisture, 1)}%`;
    byId("gauge-moisture").textContent = `${formatNumber(dashboard.averageMoisture, 1)}%`;
    byId("summary-farms").textContent = dashboard.farmCount;
    byId("summary-water").textContent = `${formatNumber(dashboard.waterDemand)} L`;
    byId("water-demand-total").textContent = formatNumber(dashboard.waterDemand);
    byId("summary-temp").textContent = readings.length ? `${formatNumber(readings[0].temperature, 1)}°C` : "—";
    byId("moisture-gauge").style.setProperty("--moisture-angle", `${Math.min(270, dashboard.averageMoisture * 2.7)}deg`);
    byId("average-moisture-bar").style.width = `${Math.min(100, Math.max(0, dashboard.averageMoisture))}%`;
    const averageStatus = moistureStatus(dashboard.averageMoisture);
    byId("average-status").textContent = averageStatus[0];
    byId("average-status").className = `health-state ${averageStatus[1]}`;
    updateTrackerFilterOptions();
    renderFarms();
    renderReadings();
  } catch (error) {
    showToast(`Could not load AgriFlow data: ${error.message}`);
  }
}

function switchView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === name));
  byId("page-crumb").textContent = ({ overview: "Overview", farms: "Farms", sensors: "Monitoring", crops: "Crop health", lab: "DSA lab" })[name];
  if (name === "crops") requestAnimationFrame(renderCropHealth);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
document.querySelectorAll("[data-goto]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.goto)));
document.querySelectorAll("[data-open-farm]").forEach((button) => button.addEventListener("click", () => byId("farm-dialog").showModal()));
byId("today-label").textContent = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
byId("refresh-button").addEventListener("click", refreshData);
["tracker-year", "tracker-month", "tracker-crop", "tracker-farm", "tracker-health", "tracker-region"].forEach((id) => {
  byId(id).addEventListener("change", renderCropHealth);
});
byId("farm-select").addEventListener("change", (event) => {
  appState.activeFarmId = Number(event.currentTarget.value);
  renderFarms();
});
document.addEventListener("click", (event) => {
  const selector = event.target.closest("[data-select-farm]");
  if (!selector) return;
  appState.activeFarmId = Number(selector.dataset.selectFarm);
  renderFarms();
});
byId("irrigation-button").addEventListener("click", () => {
  const farm = appState.farms.find((item) => item.id === appState.activeFarmId);
  if (farm) showToast(`Irrigation plan previewed for ${farm.name}. No equipment controls are connected.`);
});
byId("farm-filter").addEventListener("input", renderFarmTable);
byId("farm-table-body").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-farm]");
  if (!button || !confirm("Remove this farm and its record?")) return;
  try { await api(`/api/farms/${button.dataset.deleteFarm}`, { method: "DELETE" }); await refreshData(); showToast("Farm removed."); }
  catch (error) { showToast(error.message); }
});

byId("farm-dialog").querySelector(".dialog-close").addEventListener("click", () => byId("farm-dialog").close());
byId("cancel-farm").addEventListener("click", () => byId("farm-dialog").close());
byId("farm-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  for (const field of ["hectares", "soilMoisture", "waterNeed"]) data[field] = Number(data[field]);
  try { await api("/api/farms", { method: "POST", body: JSON.stringify(data) }); form.reset(); byId("farm-dialog").close(); await refreshData(); showToast("Farm added to your operation."); }
  catch (error) { showToast(error.message); }
});

byId("sensor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  for (const field of ["farmId", "moisture", "temperature", "rainfall"]) data[field] = Number(data[field]);
  try { await api("/api/sensors", { method: "POST", body: JSON.stringify(data) }); await refreshData(); showToast("Sensor observation saved."); }
  catch (error) { showToast(error.message); }
});

byId("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const result = byId("search-result");
  result.textContent = "Searching report…";
  try {
    const response = await api(`/api/dsa/search?${new URLSearchParams(data)}`);
    result.innerHTML = `<strong>${response.count} match${response.count === 1 ? "" : "es"}</strong> found with ${escapeHtml(response.algorithm.replaceAll("_", " "))}. Character offsets: ${response.matches.length ? response.matches.join(", ") : "none"}.`;
  } catch (error) { result.textContent = error.message; }
});

byId("compare-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await api(`/api/dsa/compare?${new URLSearchParams(data)}`);
    byId("compare-result").innerHTML = `<div><span>EDIT DISTANCE</span><strong>${result.levenshteinDistance}</strong></div><div><span>LOCAL ALIGNMENT</span><strong>${result.smithWatermanScore}</strong></div><div><span>COMMON RUN</span><strong>${result.suffixArrayLcp}</strong></div>`;
  } catch (error) { showToast(error.message); }
});

byId("flow-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const edges = data.edges.trim().split(/\n+/).filter(Boolean).map((line) => line.split(",").map(Number)).map(([from, to, capacity]) => ({ from, to, capacity }));
  const request = { nodes: Number(data.nodes), source: Number(data.source), sink: Number(data.sink), edges };
  try {
    const result = await api("/api/dsa/water-flow", { method: "POST", body: JSON.stringify(request) });
    byId("flow-result").innerHTML = `<strong>Maximum flow: ${result.maxFlow} units</strong><br>Source side of minimum cut: ${result.sourceSideOfMinCut.join(" · ")}.<br>${escapeHtml(result.algorithm)}`;
  } catch (error) { byId("flow-result").textContent = error.message; }
});

byId("sample-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const stream = data.stream.split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
  try {
    const result = await api("/api/dsa/reservoir-sample", { method: "POST", body: JSON.stringify({ stream, size: Number(data.size) }) });
    byId("sample-result").innerHTML = `<strong>Sample (${result.sample.length} of ${result.streamSize}):</strong> ${result.sample.join(", ")}`;
  } catch (error) { byId("sample-result").textContent = error.message; }
});

refreshData();