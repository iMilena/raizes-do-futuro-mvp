/* Raízes do Futuro: Island Trend Detective, heat calendar and downloads.
   Heat calendar: NASA POWER hourly T2M and RH2M for 2001 to 2005 and 2021 to 2025, NOAA/NWS heat index,
   share of days at or above 32 °C by month and hour. Downloads: one-page HTML report and CSV.
   Code written with AI assistance (Anthropic Claude) and reviewed by the team. */
import { VARS, MON, hourlyUrl, heatFromHourly, riskyMonths, firstRiskyHour, ruleText, monthsText } from "./stats.js";
import { getJson } from "./power.js";
import { $, state, hooks, status, esc, fmt, coordText } from "./app.js";
import { lastScan } from "./scan.js";

const YEARS_A = [2001, 2002, 2003, 2004, 2005], YEARS_B = [2021, 2022, 2023, 2024, 2025];
let ctl = null, lastHeat = null;

/* ---------- markup ---------- */
$("drawer-foot").insertAdjacentHTML("beforeend", `
  <button class="btn ghost" id="dl-csv" type="button"><svg class="i" aria-hidden="true"><use href="#i-table"/></svg>Download CSV</button>
  <button class="btn ghost" id="heat" type="button"><svg class="i" aria-hidden="true"><use href="#i-sun"/></svg>Heat calendar</button>`);
$("report-slot").insertAdjacentHTML("beforeend", `
  <button class="btn ghost" id="dl-report" type="button"><svg class="i" aria-hidden="true"><use href="#i-file"/></svg>Download one-page report</button>`);
document.body.insertAdjacentHTML("beforeend", `
<dialog id="heat-dlg" aria-labelledby="heat-title">
  <div class="dlg-head">
    <div><p class="eyebrow">Heat calendar for outdoor work</p><h2 id="heat-title">…</h2>
      <p class="small">NASA POWER hourly temperature and humidity, heat index (NOAA/NWS), 2001 to 2005 vs 2021 to 2025. Local solar time.</p></div>
    <button class="icon-btn" id="heat-close" type="button" aria-label="Close heat calendar"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button>
  </div>
  <div class="dlg-body">
    <div id="heat-progress">
      <p class="status load" id="heat-status" role="status" aria-live="polite">Starting…</p>
      <progress id="heat-bar" max="10" value="0" aria-label="Years downloaded"></progress>
      <p><button class="btn ghost" id="heat-cancel" type="button">Cancel</button></p>
    </div>
    <div class="verdict" id="heat-verdict"></div>
    <div class="svg-scroll"><svg id="heatsvg" viewBox="0 0 980 330" role="img" aria-label="Heat calendar by month and hour for two periods" style="width:100%;height:auto;display:none;background:var(--bg2);border:1px solid var(--line);border-radius:12px"></svg></div>
  </div>
</dialog>`);

/* ---------- heat calendar ---------- */
function drawHeat(A, B) {
  const svg = $("heatsvg"); svg.style.display = "block"; const H0 = 6, H1 = 19, cw = 30, ch = 20, ox = [60, 540], oy = 46; let s = "";
  // light (few days) to dark clay (most days); numbers printed from 20% so colour is not the only cue
  const col = v => { const t = Math.min(v / 0.8, 1); const r = Math.round(250 - t * (250 - 140)), g = Math.round(244 - t * (244 - 45)), b = Math.round(222 - t * (222 - 20)); return `rgb(${r},${g},${b})`; };
  [[A, "2001 to 2005", ox[0]], [B, "2021 to 2025", ox[1]]].forEach(([P, t, x0]) => {
    s += `<text x="${x0}" y="28" fill="#e8f3ec" font-size="15" font-weight="700">${t} · ${P.hotDaysPerYear.toFixed(0)} days/yr with heat index ≥ 32 °C</text>`;
    for (let m = 0; m < 12; m++) {
      s += `<text x="${x0 - 8}" y="${oy + m * ch + 14}" fill="#a9c2b4" font-size="11" text-anchor="end">${MON[m]}</text>`;
      for (let h = H0; h < H1; h++) { const v = P.share[m][h];
        s += `<rect x="${x0 + (h - H0) * cw}" y="${oy + m * ch}" width="${cw - 1}" height="${ch - 1}" fill="${col(v)}"><title>${MON[m]} ${h}h: ${(v * 100).toFixed(0)}% of days</title></rect>`;
        if (v >= 0.2) s += `<text x="${x0 + (h - H0) * cw + cw / 2}" y="${oy + m * ch + 14}" font-size="10" text-anchor="middle" fill="${v > 0.5 ? "#fff" : "#111"}">${(v * 100).toFixed(0)}</text>`; }
    }
    for (let h = H0; h < H1; h += 2) s += `<text x="${x0 + (h - H0) * cw + cw / 2}" y="${oy + 12 * ch + 16}" fill="#a9c2b4" font-size="11" text-anchor="middle">${h}h</text>`;
  });
  s += `<text x="${ox[0]}" y="${oy + 12 * ch + 38}" fill="#a9c2b4" font-size="11">Numbers: % of days with heat index ≥ 32 °C at that hour (local solar time). Data: NASA POWER hourly. Tool code written with AI assistance (Claude).</text>`;
  svg.innerHTML = s;
}
async function heat() {
  if (!state.cell) return;
  const cell = state.cell, place = state.place.label || coordText(state.place.lat, state.place.lon);
  ctl?.abort(); const my = ctl = new AbortController();
  $("heat-title").textContent = place; $("heat-verdict").innerHTML = ""; $("heatsvg").style.display = "none";
  $("heat-progress").hidden = false; $("heat-bar").value = 0;
  const st = (m, k = "load") => { $("heat-status").className = "status " + k; $("heat-status").textContent = m; };
  st("Downloading hourly NASA POWER data: year 0 of 10…");
  if (!$("heat-dlg").open) $("heat-dlg").showModal();
  $("heat-cancel").focus();
  let done = 0;
  const get = y => getJson(hourlyUrl(cell.lat, cell.lon, y), { signal: my.signal }).then(j => {
    done++; $("heat-bar").value = done; if (!my.signal.aborted) st(`Downloading hourly NASA POWER data: year ${done} of 10…`);
    const p = j?.properties?.parameter; if (!p?.T2M || !p?.RH2M) throw new Error(`NASA POWER returned no hourly values for ${y}.`); return p; });
  try {
    const [pa, pb] = await Promise.all([Promise.all(YEARS_A.map(get)), Promise.all(YEARS_B.map(get))]);
    if (my.signal.aborted) return;
    const A = heatFromHourly(pa), B = heatFromHourly(pb);
    if (!A.days || !B.days) throw new Error("The hourly series has no valid values for this place.");
    drawHeat(A, B);
    const ra = riskyMonths(A.share), rb = riskyMonths(B.share), fh = firstRiskyHour(B.share), ratio = A.hotDaysPerYear > 0 ? B.hotDaysPerYear / A.hotDaysPerYear : null;
    $("heat-verdict").innerHTML = `At <strong>${esc(place)}</strong>, days with heat index ≥ 32 °C went from <strong>${A.hotDaysPerYear.toFixed(0)}</strong> to <strong>${B.hotDaysPerYear.toFixed(0)}</strong> per year${ratio && ratio >= 1.2 ? ` (${ratio.toFixed(1)}x)` : ""}. Risky months (≥ 20% of days at some hour): ${monthsText(ra)} to <strong>${monthsText(rb)}</strong>.` +
      (fh !== null ? ` Suggested rule: finish heavy outdoor work ${ruleText(B.share)}; resume after the hottest hours, with water and shade.` : " No month reaches the risk threshold in 2021 to 2025.") +
      ` <span style="color:var(--muted)">Two 5-year windows describe change, not a significance test; reanalysis smooths local heat peaks.</span>`;
    lastHeat = { key: cell.key, place, A, B, verdict: $("heat-verdict").innerHTML, svg: $("heatsvg").outerHTML };
    $("heat-progress").hidden = true;
  } catch (e) {
    if (e.kind === "abort" || my.signal.aborted) return;
    st("Could not build the calendar: " + e.message, "err");
  }
}
function cancelHeat() { ctl?.abort(); $("heat-dlg").close(); }
$("heat").addEventListener("click", heat);
$("heat-cancel").addEventListener("click", cancelHeat);
$("heat-close").addEventListener("click", cancelHeat);
$("heat-dlg").addEventListener("cancel", () => ctl?.abort());
$("heat-dlg").addEventListener("close", () => { ctl?.abort(); $("heat").focus(); });

/* ---------- downloads ---------- */
function slug(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(); }
function download(name, content, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function downloadCsv() {
  const r = state.last; if (!r) { status("Run an analysis first: click a place on the globe.", "err"); return; }
  const VV = VARS[r.v];
  let c = `# Raizes do Futuro: Island Trend Detective\n# Source: NASA POWER monthly API, ${r.url}\n# Place: ${r.place} (${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}); NASA POWER cell centred at ${r.cell.lat}, ${r.cell.lon}\n# Annual ${VV.agg === "sum" ? "total" : "mean"} of ${r.v} in ${VV.unit}; years with a missing month are left out${r.skipped.length ? ` (${r.skipped.join(" ")})` : ""}\n# Generated ${new Date().toISOString().slice(0, 10)}; tool code written with AI assistance (Anthropic Claude)\nyear,${r.v}_${VV.agg}_${VV.unit.replace(/[^a-zA-Z%/]/g, "")}\n`;
  r.years.forEach((y, i) => c += `${y},${r.vals[i].toFixed(4)}\n`);
  download(`trend-data-${slug(r.place)}-${r.v}.csv`, c, "text/csv");
}
function downloadReport() {
  const r = state.last; if (!r) { status("Run an analysis first: click a place on the globe.", "err"); return; }
  const VV = VARS[r.v];
  const rows = r.rows;   // the four answers, built by show() in app.js
  const scan = lastScan && lastScan.center.key === r.cell.key && lastScan.v === r.v && lastScan.y0 === state.y0 && lastScan.y1 === state.y1 ? lastScan : null;
  const scanBlock = scan ? `<h2>Where: the cell and its 8 neighbours</h2><table><tr><th>Cell centre</th><th>Slope per decade</th><th>Significant (FDR q = 0.05)</th></tr>${scan.cells.map(o => `<tr><td>${o.c.lat.toFixed(2)}, ${o.c.lon.toFixed(3)}</td><td>${o.err !== undefined ? "no data" : fmt(o.dec, VV.dec) + " " + VV.unit}</td><td>${o.err !== undefined ? "" : o.sig ? "yes" : "no"}</td></tr>`).join("")}</table>` : "";
  const heatBlock = lastHeat && lastHeat.key === r.cell.key ? `<h2>Heat calendar for outdoor work</h2><p>${lastHeat.verdict}</p>${lastHeat.svg.replace(/style="[^"]*"/, 'style="width:100%;height:auto;background:#061713;border-radius:10px"')}<p class="muted">Hourly data: NASA POWER hourly API (T2M, RH2M, local solar time), 2001 to 2005 and 2021 to 2025, https://power.larc.nasa.gov/api/temporal/hourly/point</p>` : "";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Trend report: ${esc(r.place)}</title><meta name="generator" content="Raizes do Futuro: Island Trend Detective (code written with AI assistance, Anthropic Claude)">
<style>body{font-family:Segoe UI,system-ui,sans-serif;max-width:900px;margin:30px auto;padding:0 20px;color:#10241d;line-height:1.55}h1{font-family:Georgia,serif;margin-bottom:4px}h2{font-family:Georgia,serif;margin-top:30px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #cfdcd4;padding:8px;text-align:left;vertical-align:top}th{color:#4a6b5d;font-size:13px;text-transform:uppercase}svg{width:100%;height:auto;background:#061713;border-radius:10px}.muted{color:#5b7a6c;font-size:13px}.flag{background:#fdf1df;border-left:4px solid #d97742;padding:8px 10px}@media print{svg{break-inside:avoid}}</style></head><body>
<p class="muted">NASA Space Apps Challenge 2026 · Raízes do Futuro: Island Trend Detective · generated ${new Date().toISOString().slice(0, 10)}</p>
<h1>Earth system trend report: ${esc(r.place)}</h1><p>${esc(VV.name)} (${esc(VV.unit)}), ${r.years[0]} to ${r.years.at(-1)}, point ${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}, NASA POWER cell centred at ${r.cell.lat.toFixed(2)}, ${r.cell.lon.toFixed(3)} (0.5° x 0.625°).</p>
<h2>Four answers</h2><table><tr><th>Question</th><th>Answer</th><th>Detail</th></tr>${rows.map(x => `<tr><td>${x[0]}</td><td><strong>${esc(x[1])}</strong></td><td>${esc(x[2])}</td></tr>`).join("")}</table>
<div>${$("verdict").innerHTML}</div>${$("chart").outerHTML}${scanBlock}${heatBlock}
<h2>Method</h2><ul><li>Annual ${VV.agg === "sum" ? "totals" : "means"} from NASA POWER monthly data; years with a missing month are left out${r.skipped.length ? ` (${r.skipped.join(", ")})` : ""}.</li><li>Mann-Kendall trend test with the Hamed and Rao (1998) autocorrelation correction; Theil-Sen slope with 95% confidence interval.</li><li>Pettitt (1979) change-point test.</li><li>Where: Benjamini-Hochberg false discovery rate (q = 0.05) across the 9 cells.</li><li>Heat index: NOAA/NWS Rothfusz regression on NASA POWER hourly T2M and RH2M; 32 °C = NWS extreme caution.</li></ul>
<h2>Limits</h2><p>NASA POWER is reanalysis on a 0.5° x 0.625° grid: one cell can mix land and sea and smooth local extremes. Rainfall trends from reanalysis can carry artifacts and should be checked against GPM IMERG or local gauges. Trends describe the past and are not forecasts.</p>
<h2>Data source</h2><p>NASA POWER, Prediction Of Worldwide Energy Resources: <a href="${esc(r.url)}">${esc(r.url)}</a> · https://power.larc.nasa.gov</p>
<p class="muted">Report and tool code written with AI assistance (Anthropic Claude) and reviewed by team Raízes do Futuro. Data are NASA POWER values. No NASA logo or mark is used.</p></body></html>`;
  download(`trend-report-${slug(r.place)}-${r.v}.html`, html, "text/html");
}
$("dl-report").addEventListener("click", downloadReport);
$("dl-csv").addEventListener("click", downloadCsv);
hooks.onPlace.push(() => { ctl?.abort(); });
