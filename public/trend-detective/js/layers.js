/* Raízes do Futuro: Island Trend Detective, NASA GIBS layers on the globe.
   Base imagery switch (Esri World Imagery or GIBS true color), overlays with official legends,
   opacity, a date timeline and play. GIBS images are for viewing only: trend statistics always come
   from the NASA POWER series, never from image colours. Code written with AI assistance (Anthropic Claude). */
import { GIBS_LAYERS, GIBS_CHECKED, GIBS_CAPABILITIES } from "./gibs-layers.js";
import { $, map, esc, hooks } from "./app.js";

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const GIBS_ATTR = '<a href="https://gibs.earthdata.nasa.gov/">NASA GIBS</a>';
const byKey = Object.fromEntries(GIBS_LAYERS.map(l => [l.key, l]));
const TRUE = GIBS_LAYERS.find(l => l.role === "base");
const OVER = GIBS_LAYERS.filter(l => l.role === "overlay");
const S = { base: "esri", overlay: "lst", opacity: 0.55, date: {}, step: "month", playing: false, labels: true };

/* short names for the chips and the legend; anything new from gibs_layers.py falls back to its title */
const NAMES = {
  lst: { chip: "Land temp.", sub: "MODIS, monthly", name: "Land surface temp. (K)", src: "MODIS Terra" },
  imerg: { chip: "Rain", sub: "GPM IMERG, daily", name: "Precipitation rate", src: "GPM IMERG" },
  ssta: { chip: "Sea temp. anomaly", sub: "GHRSST, daily", name: "Sea temp. anomaly", src: "GHRSST" },
};
const meta = L => NAMES[L.key] || { chip: L.title, sub: "", name: L.title, src: "NASA GIBS" };

/* ---------- dates (UTC, ISO yyyy-mm-dd) ---------- */
const iso = d => d.toISOString().slice(0, 10);
const D = s => new Date(s + "T00:00:00Z");
function addStep(s, step, n = 1) { const d = D(s);
  if (step === "day") d.setUTCDate(d.getUTCDate() + n); else if (step === "month") d.setUTCMonth(d.getUTCMonth() + n); else d.setUTCFullYear(d.getUTCFullYear() + n);
  return iso(d); }
const first = L => L.intervals[0][0], last = L => L.intervals.at(-1)[1];
const isAvail = (L, s) => L.intervals.some(([a, b]) => s >= a && s <= b);
/* nearest available date at or before s (then after), so a gap never shows an empty map */
function snap(L, s) {
  if (L.period === "P1M") s = s.slice(0, 8) + "01";
  if (s > last(L)) return last(L); if (s < first(L)) return first(L);
  if (isAvail(L, s)) return s;
  let best = null;
  for (const [a, b] of L.intervals) { if (b < s) best = b; else if (a > s) { if (!best || (D(a) - D(s)) < (D(s) - D(best))) best = a; break; } }
  return best || last(L);
}
const nice = (L, s) => L.period === "P1M" ? D(s).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
  : D(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const short = (L, s) => L.period === "P1M" ? D(s).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })
  : D(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const tileUrl = (L, s) => `${GIBS}/${L.id}/default/${s}/${L.tileMatrixSet}/{z}/{y}/{x}.${L.ext}`;
/* the timeline slider moves in months for every layer; play still steps by day, month or year */
const months = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
function dateAtMonth(L, i) {
  const f = D(first(L)), d = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + i, 1));
  if (L.period !== "P1D") return iso(d);
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(d).slice(0, 8) + String(Math.min(+S.date[L.key].slice(8), dim)).padStart(2, "0");
}

for (const L of GIBS_LAYERS) S.date[L.key] = snap(L, L.period === "P1D" ? addStep(L.defaultTime, "day", -1) : L.defaultTime);

/* ---------- markup: popover, legend, timeline ---------- */
const chip = (kind, value, title, sub) => `<button class="chip" type="button" data-${kind}="${value}" aria-pressed="false">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
$("app").insertAdjacentHTML("beforeend", `
<section class="layers hide" id="layers" aria-label="Map layers" inert>
  <h3 id="lb-base">Base map</h3>
  <div class="seg" role="group" aria-labelledby="lb-base">
    ${chip("base", "esri", "Satellite", "Esri mosaic")}
    ${chip("base", "gibs", "True color", `NASA GIBS, ${short(TRUE, S.date[TRUE.key])}`)}
  </div>
  <label class="toggle"><input type="checkbox" id="labels-on" checked> Place labels</label>
  <h3 id="lb-over">NASA overlay</h3>
  <div class="seg" role="group" aria-labelledby="lb-over">
    ${chip("over", "none", "None", "")}
    ${OVER.map(L => chip("over", L.key, meta(L).chip, meta(L).sub)).join("")}
  </div>
  <div id="over-controls">
    <h3><label for="opacity">Overlay opacity</label></h3>
    <div class="range-row"><input id="opacity" type="range" min="0" max="1" step="0.05" value="${S.opacity}"><output id="opacity-val" for="opacity"></output></div>
    <h3><label for="lstep">Play steps by</label></h3>
    <select id="lstep"></select>
    <p class="about" id="about"></p>
  </div>
  <p class="about">Images from NASA GIBS (<a href="https://gibs.earthdata.nasa.gov/">gibs.earthdata.nasa.gov</a>), layer list checked against the
    <a href="${GIBS_CAPABILITIES}">WMTS GetCapabilities</a> on ${GIBS_CHECKED}. They are for looking only: the trend numbers come from the NASA POWER series of the clicked cell.</p>
</section>
<div class="map-legend hide" id="legend"></div>
<div class="timeline hide" id="timeline" role="group" aria-label="NASA overlay date">
  <button class="play" id="d-play" type="button" aria-pressed="false" aria-label="Play through dates"><svg class="i" aria-hidden="true" id="play-ico"><use href="#i-play"/></svg></button>
  <span class="label start" id="t-start"></span>
  <label class="sr-only" for="t-range">Overlay date</label>
  <input id="t-range" type="range" min="0" max="0" step="1" value="0">
  <span class="label now" id="t-now" aria-hidden="true"></span>
</div>`);

/* ---------- map layers ---------- */
function addLayers() {
  map.addSource("gibs-tc", { type: "raster", tileSize: 256, maxzoom: TRUE.maxzoom, tiles: [tileUrl(TRUE, S.date[TRUE.key])], attribution: GIBS_ATTR });
  map.addLayer({ id: "gibs-tc", type: "raster", source: "gibs-tc", layout: { visibility: "none" } }, "labels");
  for (const L of OVER) {
    map.addSource("gibs-" + L.key, { type: "raster", tileSize: 256, maxzoom: L.maxzoom, tiles: [tileUrl(L, S.date[L.key])], attribution: GIBS_ATTR });
    map.addLayer({ id: "gibs-" + L.key, type: "raster", source: "gibs-" + L.key, layout: { visibility: "none" },
      paint: { "raster-opacity": S.opacity, "raster-fade-duration": 250, "raster-resampling": "linear" } }, "labels");
  }
  apply();
}
function apply() {
  if (map && map.getLayer("gibs-tc")) {
    map.setLayoutProperty("esri", "visibility", S.base === "esri" ? "visible" : "none");
    map.setLayoutProperty("gibs-tc", "visibility", S.base === "gibs" ? "visible" : "none");
    map.setLayoutProperty("labels", "visibility", S.labels ? "visible" : "none");
    for (const L of OVER) {
      const on = S.overlay === L.key;
      map.setLayoutProperty("gibs-" + L.key, "visibility", on ? "visible" : "none");
      map.setPaintProperty("gibs-" + L.key, "raster-opacity", S.opacity);
      if (on) map.getSource("gibs-" + L.key).setTiles([tileUrl(L, S.date[L.key])]);
    }
  }
  ui();
}
let legendHtml = "";
function ui() {
  const L = byKey[S.overlay];
  document.querySelectorAll("#layers [data-base]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.base === S.base)));
  document.querySelectorAll("#layers [data-over]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.over === S.overlay)));
  $("over-controls").hidden = !L;
  $("opacity-val").textContent = Math.round(S.opacity * 100) + "%";
  $("timeline").classList.toggle("hide", !L);
  $("legend").classList.toggle("hide", !L);
  if (!L) return;
  const s = S.date[L.key], m = meta(L);
  const opts = L.period === "P1M" ? [["month", "Month"], ["year", "Year (same month)"]] : [["day", "Day"], ["month", "Month"], ["year", "Year (same day)"]];
  if (!opts.some(o => o[0] === S.step)) S.step = "month";
  $("lstep").innerHTML = opts.map(([v, t]) => `<option value="${v}"${v === S.step ? " selected" : ""}>${t}</option>`).join("");
  $("about").textContent = L.about + ` Available ${nice(L, first(L))} to ${nice(L, last(L))}.`;
  // timeline
  const r = $("t-range");
  r.max = months(first(L), last(L)); r.value = months(first(L), s);
  r.setAttribute("aria-valuetext", nice(L, s));
  $("t-start").textContent = short(L, first(L));
  $("t-now").textContent = short(L, s);
  // legend: official GIBS colour scale, redrawn only when the layer or date changes
  const html = `<div class="t">${esc(m.name)} <span>${esc(m.src)} · ${esc(short(L, s))}</span></div>` +
    (L.legend ? `<div class="scale"><img src="${L.legend}" alt="Colour scale for ${esc(L.title)}, from NASA GIBS"></div>` : "") +
    `<p class="src">Source: NASA GIBS</p>`;
  if (html !== legendHtml) { $("legend").innerHTML = html; legendHtml = html; }
}

/* ---------- controls ---------- */
const setDate = s => { const L = byKey[S.overlay]; if (!L) return; S.date[L.key] = snap(L, s); apply(); };
$("layers").addEventListener("click", e => {
  const b = e.target.closest("button.chip"); if (!b) return;
  if (b.dataset.base) S.base = b.dataset.base;
  if (b.dataset.over) { stop(); S.overlay = b.dataset.over; }
  apply();
});
$("labels-on").addEventListener("change", e => { S.labels = e.target.checked; apply(); });
$("opacity").addEventListener("input", e => { S.opacity = +e.target.value; apply(); });
$("lstep").addEventListener("change", e => { S.step = e.target.value; });
// while dragging only the label moves; tiles load when the thumb is released (or on each arrow key)
$("t-range").addEventListener("input", e => { const L = byKey[S.overlay]; if (L) $("t-now").textContent = short(L, snap(L, dateAtMonth(L, +e.target.value))); });
$("t-range").addEventListener("change", e => { const L = byKey[S.overlay]; if (!L) return; stop(); setDate(dateAtMonth(L, +e.target.value)); });

/* popover: opens under the Layers button, closes on Esc, outside click or when the result drawer opens */
const layersOpen = () => !$("layers").classList.contains("hide");
function openLayers(open) {
  const p = $("layers"); p.classList.toggle("hide", !open); p.inert = !open;
  $("layers-btn").setAttribute("aria-expanded", String(open));
  if (open) p.querySelector('.chip[aria-pressed="true"]')?.focus({ preventScroll: true });
}
$("layers-btn").addEventListener("click", () => openLayers(!layersOpen()));
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && layersOpen()) { e.stopPropagation(); openLayers(false); $("layers-btn").focus(); }
}, true);
document.addEventListener("pointerdown", e => { if (layersOpen() && !e.target.closest("#layers, #layers-btn")) openLayers(false); });
hooks.onPanel.push(open => { if (open && layersOpen()) openLayers(false); });

/* play: step through dates, waiting for tiles before moving on; wraps to the start of the record */
let playTok = 0;
function stop() { S.playing = false; playTok++; $("d-play").setAttribute("aria-pressed", "false"); $("d-play").setAttribute("aria-label", "Play through dates"); $("play-ico").innerHTML = '<use href="#i-play"/>'; }
async function play() {
  const tok = ++playTok; S.playing = true;
  $("d-play").setAttribute("aria-pressed", "true"); $("d-play").setAttribute("aria-label", "Pause"); $("play-ico").innerHTML = '<use href="#i-pause"/>';
  while (S.playing && tok === playTok) {
    const L = byKey[S.overlay]; if (!L) break;
    let next = addStep(S.date[L.key], S.step, 1);
    if (next > last(L)) next = S.step === "year" ? first(L).slice(0, 4) + S.date[L.key].slice(4) : addStep(last(L), S.step, -24);
    setDate(next);
    await Promise.race([new Promise(r => map.once("idle", r)), new Promise(r => setTimeout(r, 5000))]);
    await new Promise(r => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 2500 : 900));
  }
}
$("d-play").addEventListener("click", () => S.playing ? stop() : play());

ui();
if (map) { if (map.isStyleLoaded()) addLayers(); else map.once("load", addLayers); }
