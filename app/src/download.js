// Open-data download panel. Reads data_manifest.json (written by the pull) and
// renders one card per shipped artifact with its real byte size, plus a
// scrollable data dictionary. Everything links to static files in /data, so a
// download is a plain GET — no server, no build-time surprises.
import { loadJSON, VARS } from "./data.js";

const BASE = import.meta.env.BASE_URL;
const FMT = { CSV: "csv", GeoJSON: "map", JSON: "json" };

function human(bytes) {
  if (bytes == null) return "";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

export async function mountDownloads() {
  const el = document.getElementById("download-mount");
  if (!el) return;
  let m;
  try { m = await loadJSON("data_manifest.json"); }
  catch { el.innerHTML = `<p class="mono-dim">Download manifest unavailable — run scripts/11_national_county.py.</p>`; return; }

  const v = m.vintage || {};
  const cards = (m.files || []).map((f) => `
    <a class="dl-card" href="${BASE}data/${f.name}" download>
      <div class="dl-fmt dl-fmt-${FMT[f.format] || "file"}">${f.format}</div>
      <div class="dl-body">
        <div class="dl-name">${f.name}</div>
        <div class="dl-desc">${f.desc}</div>
        <div class="dl-meta">${human(f.bytes)}</div>
      </div>
      <span class="dl-arrow" aria-hidden="true">↓</span>
    </a>`).join("");

  el.innerHTML = `
    <p class="text-[15px] leading-7 text-ink/85">
      The full county dataset is yours: <b>${(m.n_variables || Object.keys(VARS).length)}</b> variables across
      <b>${(m.n_counties || 0).toLocaleString()}</b> counties (${m.geography || "US"}), compiled from the
      US Census Bureau and CDC. Take the flat table for a spreadsheet, the GeoJSON for a GIS, or the
      dictionary to see exactly how each column is defined and sourced.
    </p>
    <div class="dl-grid mt-4">${cards}</div>
    <p class="dl-prov mt-3">Vintages: ${v.acs || ""}; ${v.places || ""}; ${v.geometry || ""}.
      ${m.license || ""}</p>

    <details class="dl-dict mt-6">
      <summary>Data dictionary — ${Object.keys(VARS).length} variables</summary>
      <div class="dl-dict-wrap">
        <table class="dl-table">
          <thead><tr><th>Variable</th><th>Label</th><th>Unit</th><th>Group</th><th>Source</th></tr></thead>
          <tbody>${Object.entries(VARS).map(([id, x]) =>
            `<tr><td class="mono">${id}</td><td>${x.label}</td><td>${x.unit}</td><td>${x.group}</td><td class="dl-src">${x.source}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </details>`;
}
