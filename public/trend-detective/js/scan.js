/* Raízes do Futuro: Island Trend Detective, "Scan the area" (where).
   Tests the clicked NASA POWER cell and its 8 neighbours, applies Benjamini-Hochberg FDR (q = 0.05)
   and colours the cells on the map by slope per decade: orange for increase, blue for decrease,
   faded and dashed when not significant. Code written with AI assistance (Anthropic Claude). */
import { VARS, analyse, fetchAnnual, bhFdr, powerCell, CELL_DLAT, CELL_DLON } from "./stats.js";
import { $, state, hooks, map, empty, rect, setData, status, fmt, esc, powerJson } from "./app.js";

let ctl = null, tags = [];
export let lastScan = null;

const mix = (a, b, t) => "#" + [0, 2, 4].map(i => Math.round(parseInt(a.substr(i + 1, 2), 16) * (1 - t) + parseInt(b.substr(i + 1, 2), 16) * t).toString(16).padStart(2, "0")).join("");
const colour = t => t >= 0 ? mix("#f6d9b0", "#d97742", Math.min(1, t)) : mix("#d4e6f4", "#2f7fc1", Math.min(1, -t));

function ensureLayers() {
  if (!map || map.getSource("scan")) return;
  map.addSource("scan", { type: "geojson", data: empty() });
  map.addLayer({ id: "scan-fill", type: "fill", source: "scan", paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "sig"], 0.72, 0.12] } }, "cell-fill");
  map.addLayer({ id: "scan-line", type: "line", source: "scan", paint: { "line-color": ["case", ["get", "sig"], "#04100d", "#cfedd9"], "line-width": 1.2,
    "line-dasharray": ["case", ["get", "sig"], ["literal", [1, 0]], ["literal", [2, 2]]] } }, "cell-fill");
}
export function clearScan() {
  ctl?.abort(); tags.forEach(t => t.remove()); tags = []; lastScan = null;
  if (map?.getSource("scan")) setData("scan", empty());
  $("scan-key").hidden = true;
}

async function scan() {
  if (!state.cell) return;
  clearScan();
  const c0 = state.cell, v = state.v, y0 = state.y0, y1 = state.y1, VV = VARS[v];
  const my = ctl = new AbortController(); const btn = $("scan"); btn.disabled = true;
  const cells = [];
  for (const dy of [CELL_DLAT, 0, -CELL_DLAT]) for (const dx of [-CELL_DLON, 0, CELL_DLON]) {
    const lat = c0.lat + dy; if (lat > 90 || lat < -90) continue;
    cells.push(powerCell(lat, c0.lon + dx));
  }
  let done = 0;
  status(`Scanning ${cells.length} NASA POWER cells around this point: 0 of ${cells.length}…`, "load");
  try {
    const out = await Promise.all(cells.map(c => fetchAnnual(c.lat, c.lon, v, y0, y1, powerJson(my.signal))
      .then(r => { done++; if (!my.signal.aborted) status(`Scanning ${cells.length} NASA POWER cells around this point: ${done} of ${cells.length}…`, "load");
        if (r.years.length < 10) return { c, err: "not enough complete years" };
        const a = analyse(r.years, r.vals); return { c, dec: a.sen.slope * 10, p: a.mk.p, n: r.years.length }; })
      .catch(e => { if (e.kind === "abort") throw e; return { c, err: e.message }; })));
    if (my.signal.aborted) return;
    const ok = out.filter(o => o.err === undefined);
    if (!ok.length) throw new Error(out[0]?.err || "No cell returned data.");
    const sig = bhFdr(ok.map(o => o.p)); ok.forEach((o, i) => o.sig = sig[i]);
    const mx = Math.max(...ok.map(o => Math.abs(o.dec))) || 1;
    ensureLayers();
    setData("scan", { type: "FeatureCollection", features: ok.map(o => rect(o.c, { color: colour(o.dec / mx), sig: !!o.sig })) });
    for (const o of out) {
      const el = document.createElement("div");
      el.className = "cell-tag" + (o.err !== undefined || !o.sig ? " ns" : "");
      el.textContent = o.err !== undefined ? "no data" : `${fmt(o.dec, VV.dec > 1 ? 2 : VV.dec)}${o.sig ? "" : " n.s."}`;
      if (map) tags.push(new maplibregl.Marker({ element: el }).setLngLat([o.c.lon, o.c.lat]).addTo(map));
    }
    if (map) map.fitBounds([[c0.west - CELL_DLON * 1.6, c0.south - CELL_DLAT * 1.6], [c0.east + CELL_DLON * 1.6, c0.north + CELL_DLAT * 1.6]], { padding: 30, duration: 1200, maxZoom: 8.5 });
    const nSig = ok.filter(o => o.sig).length, up = ok.filter(o => o.sig && o.dec > 0).length, down = nSig - up;
    lastScan = { v, y0, y1, center: c0, cells: out };
    $("scan-key").hidden = false;
    $("scan-key-text").textContent = `${VV.unit} per decade, ${y0} to ${y1}. Dashed and faded: not significant (n.s.).`;
    status(`Where: ${nSig} of ${ok.length} cells show a significant trend after false discovery rate control (q = 0.05)` +
      (nSig ? `: ${up} increasing, ${down} decreasing.` : ".") + (ok.length < out.length ? ` ${out.length - ok.length} cell(s) without data.` : ""));
    if (v === "PRECTOTCORR") $("status").innerHTML += " Rainfall trends from reanalysis are a signal to confirm.";
  } catch (e) {
    if (e.kind === "abort" || my.signal.aborted) return;
    status("Could not scan: " + esc(e.message), "err");
  } finally { if (ctl === my) btn.disabled = false; }
}

/* button and key */
$("scan-slot").insertAdjacentHTML("beforeend", `<button class="btn ghost" id="scan" type="button"><svg class="i" aria-hidden="true"><use href="#i-grid"/></svg>Scan the area</button>`);
$("scan-slot").insertAdjacentHTML("beforeend", `<div class="scan-key" id="scan-key" hidden><span>Decrease</span><span class="ramp" aria-hidden="true"></span><span>Increase</span><span id="scan-key-text"></span></div>`);
$("scan").addEventListener("click", scan);
hooks.onPlace.push(clearScan);
for (const id of ["variable", "y0", "y1"]) $(id).addEventListener("change", clearScan);
