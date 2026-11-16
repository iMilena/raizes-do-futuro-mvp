/* Raízes do Futuro: Island Trend Detective, globe and result drawer.
   Click anywhere: outline the NASA POWER cell, download its annual series, answer what, how much,
   is it significant and since when. Statistics come from js/stats.js (same code as the Node tests).
   Code written with AI assistance (Anthropic Claude) and reviewed by the team. */
import { VARS, analyse, fetchAnnual, powerCell } from "./stats.js";
import { getJson } from "./power.js";

export const $ = id => document.getElementById(id);
export const BOIPEBA = { lat: -13.62, lon: -38.93, label: "Boipeba Island, Bahia, Brazil" };
export const state = { place: null, cell: null, v: "T2M", y0: 1981, y1: 2025, last: null, controller: null };
export const hooks = { onPlace: [], onResult: [], onPanel: [] };   // later modules (scan, layers, heat) plug in here
const ESRI_ATTR = 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community';
const OSM_ATTR = 'Place search © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const mobile = () => matchMedia("(max-width: 760px)").matches;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const fmt = (x, d) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(d);
export const coordText = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? "S" : "N"}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? "W" : "E"}`;
export const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const BEFORE = "#3d5a52", AFTER = "#ff8a4c";

/* ---------- variable menu ---------- */
for (const [k, v] of Object.entries(VARS)) {
  const o = document.createElement("option"); o.value = k; o.textContent = `${v.label} (${v.unit})`; o.title = `NASA POWER parameter ${k}`; $("variable").appendChild(o);
}

/* ---------- map ---------- */
export let map = null;
let spinning = false;
function webglOk() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } }
function initMap() {
  if (!window.maplibregl || !webglOk()) {
    $("map").innerHTML = '<p style="padding:150px 20px 0;color:#d9e0dc;max-width:520px;margin:0 auto">The interactive globe needs WebGL, which this browser does not offer. You can still type a place or coordinates in the search box: the analysis works without the map.</p>';
    return;
  }
  map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      projection: { type: "globe" },
      sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
      sources: {
        esri: { type: "raster", tileSize: 256, maxzoom: 19, attribution: ESRI_ATTR,
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"] },
        labels: { type: "raster", tileSize: 256, maxzoom: 19, attribution: "Labels © Esri (World Boundaries and Places)",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"] },
        cell: { type: "geojson", data: empty() },
      },
      layers: [
        { id: "space", type: "background", paint: { "background-color": "#05080b" } },
        { id: "esri", type: "raster", source: "esri" },
        { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.95 } },
        { id: "cell-fill", type: "fill", source: "cell", paint: { "fill-color": "#7fd8a4", "fill-opacity": 0.12 } },
        { id: "cell-line", type: "line", source: "cell", paint: { "line-color": "#7fd8a4", "line-width": 2.5 } },
      ],
    },
    center: [-30, -8], zoom: mobile() ? 1.1 : 1.7, minZoom: 0.6, maxZoom: 16,
    attributionControl: false, dragRotate: false, pitchWithRotate: false,
  });
  // bottom controls stack upwards, so the attribution is added first and sits below the zoom buttons
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: OSM_ATTR }), "bottom-right");
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.once("load", () => setTimeout(() => { if (mobile()) document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"); }, 300));
  map.on("click", e => selectPlace(e.lngLat.lat, wrapLon(e.lngLat.lng), null, { fly: true }));
  map.on("error", e => { if (e?.error?.status || e?.error?.name === "AbortError" || /abort/i.test(e?.error?.message || "")) return; console.warn("map:", e?.error?.message || e); });
  const el = document.createElement("button");
  el.className = "pulse"; el.type = "button"; el.setAttribute("aria-label", "Boipeba Island case study: analyse this place");
  el.addEventListener("click", ev => { ev.stopPropagation(); goBoipeba(); });
  new maplibregl.Marker({ element: el }).setLngLat([BOIPEBA.lon, BOIPEBA.lat]).addTo(map);

  // slow spin until the first interaction
  spinning = !reduced();
  map.on("load", spin);
  map.on("moveend", spin);
  for (const ev of ["mousedown", "touchstart", "wheel"]) map.on(ev, userTouched);
  map.getCanvas().addEventListener("keydown", userTouched);
}
function spin() { if (!spinning || !map) return; const c = map.getCenter(); c.lng -= 2; map.easeTo({ center: c, duration: 1000, easing: t => t }); }
function userTouched() { spinning = false; hideHero(false); }
const wrapLon = lon => ((((lon + 180) % 360) + 360) % 360) - 180;
export const empty = () => ({ type: "FeatureCollection", features: [] });
export const rect = (c, props = {}) => ({ type: "Feature", properties: props, geometry: { type: "Polygon",
  coordinates: [[[c.west, c.south], [c.east, c.south], [c.east, c.north], [c.west, c.north], [c.west, c.south]]] } });
export function setData(src, data) { if (!map) return; const s = map.getSource(src); if (s) s.setData(data); else map.once("load", () => map.getSource(src)?.setData(data)); }

/* ---------- camera padding: the globe sits beside the hero and the drawer ---------- */
const heroShown = () => !$("hero").classList.contains("hide");
const panelOpen = () => !$("panel").classList.contains("hide");
function padding() {
  if (mobile()) return { top: 72, bottom: panelOpen() ? Math.round(innerHeight * 0.72) : 72, left: 0, right: 0 };
  return { top: 76, bottom: 72, left: heroShown() ? 480 : 0, right: panelOpen() ? 452 : 0 };
}
const ease = () => { if (map) map.easeTo({ padding: padding(), duration: reduced() ? 0 : 600 }); };
addEventListener("resize", () => map?.setPadding(padding()));

/* ---------- hero ---------- */
export function hideHero(camera = true) {
  if (!heroShown()) return;
  $("hero").classList.add("hide"); $("hero").inert = true;
  if (camera) ease();
}
$("hero-boipeba").addEventListener("click", () => goBoipeba());
$("hero-explore").addEventListener("click", () => { spinning = false; hideHero(true); });

/* ---------- place ---------- */
let pick = null, placeTok = 0;
export function selectPlace(lat, lon, label, { fly = false, zoom = null } = {}) {
  lat = Math.max(-89.99, Math.min(89.99, lat));
  const place = state.place = { lat, lon, label }, tok = ++placeTok;
  state.cell = powerCell(lat, lon);
  spinning = false;
  $("panel-title").textContent = label || "Selected cell";
  $("panel-cell").textContent = `${coordText(lat, lon)} · cell 0.5° × 0.625°`;
  $("method-cell").textContent = `The outline on the globe is the NASA POWER cell these numbers describe, centred at ${state.cell.lat.toFixed(2)}, ${state.cell.lon.toFixed(3)} (0.5° latitude × 0.625° longitude).`;
  hideHero(false);
  setPanel(true, { camera: !fly });
  if (map) {
    setData("cell", { type: "FeatureCollection", features: [rect(state.cell)] });
    if (!pick) { const d = document.createElement("div"); d.className = "pick"; pick = new maplibregl.Marker({ element: d }); }
    pick.setLngLat([lon, lat]).addTo(map);
    if (fly) map.flyTo({ center: [lon, lat], zoom: zoom ?? Math.max(map.getZoom(), 6.2), padding: padding(), duration: reduced() ? 0 : 2200, essential: true });
  }
  hooks.onPlace.forEach(f => f());
  run();
  if (!label) reverseName(lat, lon, () => tok === placeTok).then(name => {
    if (!name || tok !== placeTok) return;
    place.label = name; $("panel-title").textContent = name;
    if (state.last && state.last.lat === lat && state.last.lon === lon) state.last.place = name;
  });
}
export function goBoipeba() { selectPlace(BOIPEBA.lat, BOIPEBA.lon, BOIPEBA.label, { fly: true, zoom: 8.6 }); }

/* ---------- drawer ---------- */
export function setPanel(open, { camera = true } = {}) {
  const p = $("panel"), had = p.contains(document.activeElement);
  p.classList.toggle("hide", !open); p.inert = !open;
  document.body.classList.toggle("drawer-open", open);
  if (open) {
    hideHero(false); hooks.onPanel.forEach(f => f(open));
    // the long attribution would run under the timeline; fold it to its (i) button, still one click away
    document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  }
  else if (had) (map ? map.getCanvas() : $("q")).focus();
  if (camera) ease();
}
$("panel-close").addEventListener("click", () => setPanel(false));
addEventListener("keydown", e => {
  if (document.querySelector("dialog[open]")) return;
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || "");
  if (e.key === "/" && !typing) { e.preventDefault(); $("q").focus(); }
  if (e.key === "Escape" && panelOpen()) setPanel(false);
});

export function status(msg, kind = "") { const s = $("status"); s.className = "status" + (kind ? " " + kind : ""); s.innerHTML = msg; }

/* ---------- analysis ---------- */
function readYears() {
  let y0 = Math.round(+$("y0").value) || 1981, y1 = Math.round(+$("y1").value) || 2025;
  y0 = Math.max(1981, Math.min(y0, 2015)); y1 = Math.max(y0 + 10, Math.min(y1, 2025));
  $("y0").value = y0; $("y1").value = y1; return { y0, y1 };
}
export const powerJson = signal => url => getJson(url, { signal });
async function run() {
  if (!state.place) return;
  state.controller?.abort();
  const ctl = state.controller = new AbortController();
  const v = state.v = $("variable").value; const { y0, y1 } = readYears(); state.y0 = y0; state.y1 = y1;
  const { place, cell } = state;
  clearAnswers();
  status(`Asking NASA POWER for ${y1 - y0 + 1} years of monthly ${v}…`, "load");
  try {
    const r = await fetchAnnual(cell.lat, cell.lon, v, y0, y1, powerJson(ctl.signal));
    if (ctl.signal.aborted) return;
    if (r.years.length < 10) {
      status(`NASA POWER has only ${r.years.length} complete year${r.years.length === 1 ? "" : "s"} of ${v} for this cell between ${y0} and ${y1}${r.skipped.length ? ` (${r.skipped.length} years have missing months)` : ""}. A trend test needs at least 10. Try another variable or period.`, "err");
      $("verdict").textContent = "Not enough data for a trend test here."; state.last = null; return;
    }
    const a = analyse(r.years, r.vals);
    state.last = { ...place, place: place.label || coordText(place.lat, place.lon), cell, v, years: r.years, vals: r.vals, a, url: r.url, skipped: r.skipped };
    show(state.last);
    status(`Done: ${r.years.length} complete years from NASA POWER${r.skipped.length ? `. Skipped incomplete years: ${r.skipped.join(", ")}` : ""}.`);
    hooks.onResult.forEach(f => f(state.last));
  } catch (e) {
    if (e.kind === "abort" || ctl.signal.aborted) return;
    status(esc(e.message), "err"); $("verdict").textContent = "No result for this place yet."; state.last = null;
  }
}
function clearAnswers() {
  $("verdict-card").classList.add("neutral");
  $("a-trend").textContent = "…"; $("a-trend-u").textContent = ""; $("verdict").textContent = "";
  for (const id of ["a-much", "a-sig", "a-when"]) { $(id).textContent = "…"; $(id).className = "v"; $(id + "-s").textContent = ""; }
  $("chart").innerHTML = ""; $("chart-key").innerHTML = ""; $("method-text").textContent = "";
}
$("variable").addEventListener("change", run);
$("y0").addEventListener("change", run);
$("y1").addEventListener("change", run);

function show(L) {
  const { years, a, v } = L, VV = VARS[v], dec = a.sen.slope * 10, sig = a.mk.p < 0.05, d = VV.dec, cp = a.pt.p < 0.05;
  const what = sig ? (dec > 0 ? VV.up : VV.down) : "no clear trend";
  const ptxt = a.mk.p < 0.001 ? "p < 0.001" : `p = ${a.mk.p.toFixed(3)}`;
  const pPt = cp ? (a.pt.p < 0.001 ? "p < 0.001" : "p = " + a.pt.p.toFixed(3)) : `p = ${a.pt.p.toFixed(2)}`;
  const shift = cp ? years[a.pt.k] : null;

  // 1. verdict
  $("verdict-card").classList.toggle("neutral", !sig);
  $("a-trend").textContent = `${fmt(dec, d)} ${VV.unit}`;
  $("a-trend-u").textContent = "per decade";
  const rain = v === "PRECTOTCORR" ? `<p class="flag"><strong>Signal to confirm.</strong> Rainfall trends from reanalysis can carry artifacts from changes in the observing system. Confirm with GPM IMERG or local rain gauges before acting on it.</p>` : "";
  $("verdict").innerHTML = (sig
    ? `The signal here is <b>${esc(what)}</b>: the change in ${esc(VV.name)} is <b>statistically significant</b>${cp ? `, and it shifted <b>after ${shift}</b>` : ""}.`
    : `Here, ${esc(VV.name)} shows <b>no clear trend</b>: the change cannot be told apart from year-to-year variability.`) + rain;

  // 2. three short answers
  $("a-much").textContent = `${fmt(a.last - a.first, d)} ${VV.unit}`;
  $("a-much-s").textContent = `last ${a.w} vs first ${a.w} years`;
  $("a-sig").textContent = sig ? "Yes" : "No"; $("a-sig").className = "v" + (sig ? " ok" : "");
  $("a-sig-s").textContent = ptxt;
  $("a-when").textContent = cp ? `after ${shift}` : "No break";
  $("a-when-s").textContent = `Pettitt ${pPt}`;

  // 3. chart and methods
  $("chart-title").textContent = `Annual ${VV.agg === "sum" ? "total" : "mean"}, ${VV.unit}`;
  $("chart-key").innerHTML = cp
    ? `<span><i style="background:${BEFORE}"></i>before</span><span><i style="background:${AFTER}"></i>after ${shift}</span>`
    : `<span><i style="background:${BEFORE}"></i>annual value</span>`;
  drawChart($("chart"), L);
  $("method-text").textContent = `Mann-Kendall trend test with the Hamed and Rao autocorrelation correction (${ptxt}), Theil-Sen slope with 95% CI (${fmt(a.sen.lo * 10, d)} to ${fmt(a.sen.hi * 10, d)} ${VV.unit} per decade), Pettitt change point (${pPt}${cp ? `: ${a.pt.before.toFixed(d)} to ${a.pt.after.toFixed(d)} ${VV.unit}` : ""}). Data: NASA POWER monthly ${v}, annual ${VV.agg === "sum" ? "totals" : "means"}, ${years.length} complete years from ${years[0]} to ${years.at(-1)}. First ${a.w} years ${a.first.toFixed(d)} vs last ${a.w} years ${a.last.toFixed(d)} ${VV.unit}.`;

  // rows for the downloadable report (same content as the four answers)
  L.rows = [
    ["What", what, `${VV.name}, ${years[0]} to ${years.at(-1)}`],
    ["How much", `${fmt(dec, d)} ${VV.unit} per decade`, `95% CI ${fmt(a.sen.lo * 10, d)} to ${fmt(a.sen.hi * 10, d)}; first ${a.w} yrs ${a.first.toFixed(d)} vs last ${a.w} yrs ${a.last.toFixed(d)}`],
    ["Significant?", sig ? "Yes" : "No", `${ptxt}, Mann-Kendall with Hamed-Rao autocorrelation correction`],
    ["Since when", cp ? `after ${shift}` : "no break", cp ? `Pettitt ${pPt}: ${a.pt.before.toFixed(d)} to ${a.pt.after.toFixed(d)} ${VV.unit}` : `Pettitt ${pPt}`],
  ];
}

export function drawChart(svg, { years, vals, a, v }) {
  const W = 380, H = 190, L = 36, R = 6, T = 16, B = 22, VV = VARS[v], mono = "JetBrains Mono, monospace";
  const mn = Math.min(...vals), mx = Math.max(...vals), pad = (mx - mn) * 0.15 || 1;
  const y0 = VV.agg === "sum" ? 0 : mn - pad, y1 = mx + pad;
  const X = i => L + (i + 0.5) * (W - L - R) / years.length, Y = val => T + (H - T - B) * (1 - (val - y0) / (y1 - y0));
  const bw = (W - L - R) / years.length * 0.72, cp = a.pt.p < 0.05; let s = "";
  for (let g = 0; g <= 3; g++) { const val = y0 + (y1 - y0) * g / 3;
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(val)}" y2="${Y(val)}" stroke="rgba(255,255,255,.07)"/><text x="${L - 6}" y="${Y(val) + 3}" fill="#93a19b" font-size="9" font-family="${mono}" text-anchor="end">${val.toFixed(VV.dec > 0 ? 1 : 0)}</text>`; }
  vals.forEach((val, i) => { const after = cp && i > a.pt.k;
    s += `<rect x="${X(i) - bw / 2}" y="${Y(val)}" width="${bw}" height="${Math.max(H - B - Y(val), 0)}" fill="${after ? AFTER : BEFORE}" rx="1.5"><title>${years[i]}: ${val.toFixed(VV.dec)} ${VV.unit}</title></rect>`; });
  const mid = (years.length - 1) / 2, medV = [...vals].sort((p, q) => p - q)[Math.floor(vals.length / 2)], ly = i => medV + a.sen.slope * (i - mid);
  s += `<line x1="${X(0)}" y1="${Y(ly(0))}" x2="${X(years.length - 1)}" y2="${Y(ly(years.length - 1))}" stroke="#eef2ef" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  if (cp) { const xc = (X(a.pt.k) + X(a.pt.k + 1)) / 2;
    s += `<line x1="${xc}" x2="${xc}" y1="${T - 4}" y2="${H - B}" stroke="#eef2ef" stroke-opacity=".55" stroke-dasharray="2 3"/><text x="${xc + 4}" y="${T + 4}" fill="#93a19b" font-size="9" font-family="Manrope, sans-serif">shift</text>`; }
  years.forEach((y, i) => { if (y % (years.length > 30 ? 10 : 5) === 0) s += `<text x="${X(i)}" y="${H - 6}" fill="#93a19b" font-size="9" font-family="${mono}" text-anchor="middle">${y}</text>`; });
  svg.innerHTML = s;
  svg.setAttribute("aria-label", `Annual ${VV.name} from ${years[0]} to ${years.at(-1)}, Theil-Sen trend ${fmt(a.sen.slope * 10, VV.dec)} ${VV.unit} per decade. Chart code written with AI assistance.`);
}

/* ---------- place names (Nominatim, only after a user action, at most 1 request per second) ---------- */
let lastGeocode = 0; const geoCache = new Map(), revCache = new Map();
async function throttle() {
  const at = Math.max(Date.now(), lastGeocode + 1100); lastGeocode = at;
  const wait = at - Date.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait));
}
async function geocode(q) {
  if (geoCache.has(q)) return geoCache.get(q);
  await throttle();
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { "Accept-Language": "en" } });
  if (!r.ok) throw new Error("Place search is not available right now (HTTP " + r.status + "). Type coordinates instead, like -3.12, -60.02.");
  const j = await r.json(); const out = j[0] ? { lat: +j[0].lat, lon: +j[0].lon, label: j[0].display_name.split(",").slice(0, 3).join(",") } : null;
  geoCache.set(q, out); return out;
}
/* reverse lookup for a clicked point: "Town, State, Country", or null at sea or on error */
async function reverseName(lat, lon, stillWanted) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (revCache.has(key)) return revCache.get(key);
  try {
    await throttle();
    if (!stillWanted()) return null;
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, { headers: { "Accept-Language": "en" } });
    if (!r.ok) return null;
    const j = await r.json(), ad = j.address || {};
    const parts = [ad.island || ad.city || ad.town || ad.village || ad.municipality || ad.county || j.name, ad.state, ad.country].filter(Boolean);
    const out = j.error ? null : ([...new Set(parts)].join(", ") || null);
    revCache.set(key, out); return out;
  } catch { return null; }
}

/* ---------- search: "lat, lon" or a place name ---------- */
$("search").addEventListener("submit", async e => {
  e.preventDefault();
  const q = $("q").value.trim(); if (!q) return;
  const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) {
    const lat = +m[1], lon = +m[2];
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) { setPanel(true); status("Latitude must be between -90 and 90 and longitude between -180 and 180.", "err"); return; }
    selectPlace(lat, lon, null, { fly: true }); return;
  }
  try {
    const g = await geocode(q);
    if (!g) { setPanel(true); status(`No place found for "${esc(q)}". Try coordinates, like -3.12, -60.02.`, "err"); return; }
    selectPlace(g.lat, g.lon, g.label, { fly: true });
  } catch (err) { setPanel(true); status(esc(err.message), "err"); }
});
$("go-boipeba").addEventListener("click", goBoipeba);

/* ---------- start: hero visible, drawer closed, globe spinning ---------- */
initMap();
if (map) map.setPadding(padding());
window.__trend = { state, selectPlace, map: () => map };   // used by the browser tests
