// Lightweight in-browser data explorer over the tract table.
// Filter by region, pick a variable, see a live distribution, rank tracts, export CSV.
import * as Plot from "@observablehq/plot";
import { VARS, state } from "./data.js";

const REGIONS = {
  ca: { label: "All California", test: () => true },
  la: { label: "LA County", test: (p) => p.is_la_county === true || p.is_la_county === "true" },
  sc: { label: "South Central LA", test: (p) => p.is_south_central === true || p.is_south_central === "true" },
};

let region = "ca", variable = "median_hh_income";

export function mountExplorer() {
  const el = document.getElementById("explorer-mount");
  if (!el) return;
  el.innerHTML = `
    <p class="text-[15px] leading-7 text-ink/85">Every tract, every variable, in your browser. Filter to a region, choose a measure, read the distribution, and pull the ranked tracts. Download what you select.</p>
    <div class="mt-4 flex flex-wrap gap-3 items-end">
      <div><label class="block text-xs uppercase tracking-wide text-dim">Region</label>
        <select id="ex-region" class="mt-1 rounded-md border border-ink/20 bg-white px-3 py-2 text-sm"></select></div>
      <div><label class="block text-xs uppercase tracking-wide text-dim">Variable</label>
        <select id="ex-var" class="mt-1 rounded-md border border-ink/20 bg-white px-3 py-2 text-sm"></select></div>
      <button id="ex-csv" class="px-4 py-2 rounded-full bg-ink text-paper text-sm hover:bg-ink/85">Download CSV</button>
    </div>
    <div id="ex-summary" class="mt-4 text-sm text-ink/80"></div>
    <div id="ex-hist" class="mt-4"></div>
    <div class="mt-6 grid md:grid-cols-2 gap-4">
      <div><h4 class="text-sm font-semibold mb-1">Highest 10</h4><div id="ex-top" class="text-xs"></div></div>
      <div><h4 class="text-sm font-semibold mb-1">Lowest 10</h4><div id="ex-bot" class="text-xs"></div></div>
    </div>`;

  const rsel = el.querySelector("#ex-region");
  rsel.innerHTML = Object.entries(REGIONS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("");
  const vsel = el.querySelector("#ex-var");
  vsel.innerHTML = Object.entries(VARS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("");
  vsel.value = variable;
  rsel.addEventListener("change", () => { region = rsel.value; render(); });
  vsel.addEventListener("change", () => { variable = vsel.value; render(); });
  el.querySelector("#ex-csv").addEventListener("click", exportCsv);
  render();
}

function rows() {
  const feats = state.counties?.features || [];
  return feats.map((f) => f.properties).filter(REGIONS[region].test);
}

function render() {
  if (!state.counties) { document.getElementById("ex-summary").textContent = "Data not loaded."; return; }
  const v = VARS[variable];
  const data = rows().map((p) => ({ GEOID: p.GEOID, county: p.county_name, val: +p[variable] }))
    .filter((d) => Number.isFinite(d.val));
  data.sort((a, b) => b.val - a.val);
  const vals = data.map((d) => d.val);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const med = vals[Math.floor(vals.length / 2)];
  document.getElementById("ex-summary").innerHTML =
    `<b>${data.length.toLocaleString()}</b> tracts · ${v.label} · mean ${fmt(mean, v)} · median ${fmt(med, v)} · range ${fmt(vals[vals.length - 1], v)}–${fmt(vals[0], v)}`;

  const hist = document.getElementById("ex-hist"); hist.innerHTML = "";
  hist.append(Plot.plot({
    height: 220, marginLeft: 45,
    x: { label: `${v.label} (${v.unit})`, grid: true }, y: { label: "tracts" },
    marks: [Plot.rectY(data, Plot.binX({ y: "count" }, { x: "val", fill: "#6d5a8c", fillOpacity: 0.85 })), Plot.ruleY([0])],
  }));

  document.getElementById("ex-top").innerHTML = tbl(data.slice(0, 10), v);
  document.getElementById("ex-bot").innerHTML = tbl(data.slice(-10).reverse(), v);
}

function tbl(d, v) {
  return `<table class="w-full"><tbody>${d.map((r) =>
    `<tr class="border-b border-ink/10"><td class="py-0.5 pr-2 text-ink/60">${r.GEOID}</td><td class="pr-2">${r.county || ""}</td><td class="text-right font-medium">${fmt(r.val, v)}</td></tr>`).join("")}</tbody></table>`;
}

function fmt(x, v) {
  if (!Number.isFinite(x)) return "n/a";
  if (v.unit === "$") return "$" + Math.round(x).toLocaleString();
  if (v.unit === "%") return x.toFixed(1) + "%";
  return Math.round(x).toLocaleString();
}

function exportCsv() {
  const data = rows();
  const cols = ["GEOID", "county_name", ...Object.keys(VARS)];
  const head = cols.join(",");
  const body = data.map((p) => cols.map((c) => {
    const x = p[c]; return (x == null) ? "" : (typeof x === "string" && x.includes(",")) ? `"${x}"` : x;
  }).join(",")).join("\n");
  const blob = new Blob([head + "\n" + body], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ca_atlas_${region}.csv`;
  a.click();
}
