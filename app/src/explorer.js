// In-browser data explorer over the national county table.
// Two panels: a univariate distribution (filter, histogram, ranked counties,
// CSV of the current selection) and a bivariate relationship (scatter of any
// two variables with an OLS fit and Pearson r). All client-side.
import * as Plot from "@observablehq/plot";
import { VARS, state, groupedOptions } from "./data.js";

let scopeState = "all";       // "all" or a state_name
let variable = "median_hh_income";
let xVar = "median_hh_income", yVar = "diabetes_pct";

// Census suppresses small-county estimates; the pull stores those as null.
// `+null` and `+""` are 0 (and pass Number.isFinite), so coerce through this
// instead — a suppressed county must drop out, not masquerade as a zero.
const num = (x) => (x == null || x === "") ? NaN : +x;

export function mountExplorer() {
  const el = document.getElementById("explorer-mount");
  if (!el) return;
  el.innerHTML = `
    <p class="text-[15px] leading-7 text-ink/85">Every county, every variable, in your browser. Filter to a state, read the distribution, rank the counties, then pull the relationship between any two measures. Download what you select.</p>

    <div class="ex-tabs mt-5">
      <button data-tab="dist" class="ex-tab is-active">Distribution</button>
      <button data-tab="rel" class="ex-tab">Relationships</button>
    </div>

    <section data-panel="dist" class="ex-panel">
      <div class="mt-4 flex flex-wrap gap-3 items-end">
        <div><label class="ex-lbl">Scope</label>
          <select id="ex-scope" class="ex-sel"></select></div>
        <div><label class="ex-lbl">Variable</label>
          <select id="ex-var" class="ex-sel"></select></div>
        <button id="ex-csv" class="ex-btn">Download CSV</button>
      </div>
      <div id="ex-summary" class="mt-4 text-sm text-ink/80"></div>
      <div id="ex-hist" class="mt-3"></div>
      <div class="mt-6 grid md:grid-cols-2 gap-5">
        <div><h4 class="text-sm font-semibold mb-1">Highest 10</h4><div id="ex-top" class="text-xs"></div></div>
        <div><h4 class="text-sm font-semibold mb-1">Lowest 10</h4><div id="ex-bot" class="text-xs"></div></div>
      </div>
    </section>

    <section data-panel="rel" class="ex-panel" hidden>
      <div class="mt-4 flex flex-wrap gap-3 items-end">
        <div><label class="ex-lbl">X axis</label><select id="ex-x" class="ex-sel"></select></div>
        <div><label class="ex-lbl">Y axis</label><select id="ex-y" class="ex-sel"></select></div>
        <button id="ex-swap" class="ex-btn ex-btn-ghost">Swap</button>
      </div>
      <div id="ex-fitline" class="mt-4 text-sm text-ink/80"></div>
      <div id="ex-scatter" class="mt-3"></div>
      <p class="mt-2 text-xs text-dim">Each dot is a county. The line is an ordinary-least-squares fit; <i>r</i> is the Pearson correlation. Association, not causation — read the redlining case study for what it takes to argue the latter.</p>
    </section>`;

  // populate selects
  const scopeSel = el.querySelector("#ex-scope");
  scopeSel.innerHTML = `<option value="all">All United States</option>` + stateOptions();
  el.querySelector("#ex-var").innerHTML = groupedOptions(variable);
  el.querySelector("#ex-x").innerHTML = groupedOptions(xVar);
  el.querySelector("#ex-y").innerHTML = groupedOptions(yVar);

  // tab switching
  el.querySelectorAll(".ex-tab").forEach((t) => t.addEventListener("click", () => {
    el.querySelectorAll(".ex-tab").forEach((x) => x.classList.toggle("is-active", x === t));
    el.querySelectorAll(".ex-panel").forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab));
    if (t.dataset.tab === "rel") renderScatter();
  }));

  scopeSel.addEventListener("change", () => { scopeState = scopeSel.value; renderDist(); });
  el.querySelector("#ex-var").addEventListener("change", (e) => { variable = e.target.value; renderDist(); });
  el.querySelector("#ex-csv").addEventListener("click", exportCsv);
  el.querySelector("#ex-x").addEventListener("change", (e) => { xVar = e.target.value; renderScatter(); });
  el.querySelector("#ex-y").addEventListener("change", (e) => { yVar = e.target.value; renderScatter(); });
  el.querySelector("#ex-swap").addEventListener("click", () => {
    [xVar, yVar] = [yVar, xVar];
    el.querySelector("#ex-x").value = xVar; el.querySelector("#ex-y").value = yVar;
    renderScatter();
  });

  renderDist();
}

function stateOptions() {
  const feats = state.counties?.features || [];
  const names = [...new Set(feats.map((f) => f.properties.state_name).filter(Boolean))].sort();
  return names.map((n) => `<option value="${n}">${n}</option>`).join("");
}

function rows() {
  const feats = state.counties?.features || [];
  const r = feats.map((f) => f.properties);
  return scopeState === "all" ? r : r.filter((p) => p.state_name === scopeState);
}

function renderDist() {
  if (!state.counties) { document.getElementById("ex-summary").textContent = "Data not loaded."; return; }
  const v = VARS[variable];
  const data = rows().map((p) => ({ GEOID: p.GEOID, county: p.county_name, state: p.state_name, val: num(p[variable]) }))
    .filter((d) => Number.isFinite(d.val));
  data.sort((a, b) => b.val - a.val);
  const vals = data.map((d) => d.val);
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  const med = vals[Math.floor(vals.length / 2)];
  const scopeLbl = scopeState === "all" ? "U.S. counties" : `counties in ${scopeState}`;
  document.getElementById("ex-summary").innerHTML =
    `<b>${data.length.toLocaleString()}</b> ${scopeLbl} · ${v.label} · mean ${fmt(mean, v)} · median ${fmt(med, v)} · range ${fmt(vals[vals.length - 1], v)}–${fmt(vals[0], v)}`;

  const hist = document.getElementById("ex-hist"); hist.innerHTML = "";
  hist.append(Plot.plot({
    height: 220, marginLeft: 48, width: hist.clientWidth || 680,
    x: { label: `${v.label} (${v.unit}) →`, grid: true }, y: { label: "counties" },
    marks: [Plot.rectY(data, Plot.binX({ y: "count" }, { x: "val", fill: "#6d5a8c", fillOpacity: 0.85 })), Plot.ruleY([0])],
  }));

  document.getElementById("ex-top").innerHTML = tbl(data.slice(0, 10), v);
  document.getElementById("ex-bot").innerHTML = tbl(data.slice(-10).reverse(), v);
}

function renderScatter() {
  const mount = document.getElementById("ex-scatter");
  if (!mount || !state.counties) return;
  const vx = VARS[xVar], vy = VARS[yVar];
  const data = rows().map((p) => ({ county: p.county_name, state: p.state_name, x: num(p[xVar]), y: num(p[yVar]) }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
  const { r, slope, intercept, n } = ols(data);
  const scopeLbl = scopeState === "all" ? "all U.S. counties" : scopeState;
  document.getElementById("ex-fitline").innerHTML =
    `<b>${vy.label}</b> vs <b>${vx.label}</b> across ${n.toLocaleString()} ${scopeLbl} · ` +
    `Pearson <i>r</i> = <b>${r.toFixed(3)}</b> (r² = ${(r * r).toFixed(3)}) · ` +
    `slope ${slope.toPrecision(3)} ${vy.unit}/${vx.unit}`;

  mount.innerHTML = "";
  mount.append(Plot.plot({
    height: 420, marginLeft: 56, width: mount.clientWidth || 680,
    grid: true,
    x: { label: `${vx.label} (${vx.unit}) →`, type: vx.log ? "log" : "linear" },
    y: { label: `↑ ${vy.label} (${vy.unit})` },
    marks: [
      Plot.dot(data, { x: "x", y: "y", r: 2, fill: "#3b528b", fillOpacity: 0.32 }),
      Plot.linearRegressionY(data, { x: "x", y: "y", stroke: "#b5482f", ci: 0.95, fillOpacity: 0.08 }),
    ],
  }));
}

// Simple linear regression + Pearson r (closed form).
function ols(data) {
  const n = data.length;
  if (n < 2) return { r: NaN, slope: NaN, intercept: NaN, n };
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const { x, y } of data) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const cov = sxy - sx * sy / n, vx = sxx - sx * sx / n, vy = syy - sy * sy / n;
  const slope = cov / vx, intercept = (sy - slope * sx) / n;
  const r = cov / Math.sqrt(vx * vy);
  return { r, slope, intercept, n };
}

function tbl(d, v) {
  return `<table class="w-full"><tbody>${d.map((r) =>
    `<tr class="border-b border-ink/10"><td class="py-0.5 pr-2 text-ink/55">${r.GEOID}</td><td class="pr-2">${r.county || ""}${r.state ? `, ${abbr(r.state)}` : ""}</td><td class="text-right font-medium tabular-nums">${fmt(r.val, v)}</td></tr>`).join("")}</tbody></table>`;
}

function fmt(x, v) {
  if (!Number.isFinite(x)) return "n/a";
  if (v.unit === "$" || v.unit === "$ / month") return "$" + Math.round(x).toLocaleString();
  if (v.unit.startsWith("index")) return x.toFixed(3);
  if (v.unit.includes("%")) return x.toFixed(1) + "%";
  if (v.unit === "years") return x.toFixed(1);
  return Math.round(x).toLocaleString();
}

function abbr(name) { return name; }

function exportCsv() {
  const data = rows();
  const cols = ["GEOID", "county_name", "state_name", ...Object.keys(VARS)];
  const head = cols.join(",");
  const body = data.map((p) => cols.map((c) => {
    const x = p[c]; return (x == null) ? "" : (typeof x === "string" && x.includes(",")) ? `"${x}"` : x;
  }).join(",")).join("\n");
  const blob = new Blob([head + "\n" + body], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = scopeState === "all" ? "us_counties_all.csv" : `us_counties_${scopeState.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
