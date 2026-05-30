import maplibregl from "maplibre-gl";
import * as Plot from "@observablehq/plot";
import scrollama from "scrollama";
import { animate, inView } from "motion";
import { VARS, RAMPS, HOLC_COLORS, state, loadJSON, groupedOptions } from "./data.js";
import { breaksFor, stepExpression, fmtVal } from "./classify.js";
import { renderProse } from "./prose.js";
import { mountExplorer } from "./explorer.js";
import { mountDownloads } from "./download.js";
import { mountAssistant } from "./assistant.js";
import "./style.css";

const BASE = import.meta.env.BASE_URL;

// Census suppresses small-county estimates, stored as null in the GeoJSON.
// `+null` is 0 (and finite), which would drag down break computation and print
// "$0" in popups for suppressed counties — coerce through this so they drop out.
const num = (x) => (x == null || x === "") ? NaN : +x;

// MapTiler-free raster basemap (CARTO light, no token). Vector style overlaid with our GeoJSON.
const BASEMAP = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap, © CARTO",
    },
  },
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#f7f5f0" } },
           { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 0.55 } }],
};

const VIEWS = {
  us: { center: [-96.5, 38.5], zoom: 3.5 },
  west: { center: [-118.5, 37.0], zoom: 4.6 },
  south: { center: [-90.0, 33.0], zoom: 4.8 },
  northeast: { center: [-74.5, 41.5], zoom: 5.2 },
  // case-study views (tracts / HOLC)
  ca: { center: [-119.4, 37.2], zoom: 5.1 },
  la: { center: [-118.3, 34.05], zoom: 8.4 },
  stl: { center: [-90.25, 38.64], zoom: 9.8 },
};

let atlasMap, currentValues = [];

async function boot() {
  // Critical path: only the two payloads the hero + national atlas need, fetched
  // in parallel. The 11.5 MB statewide tract file used to block first paint here;
  // it is now deferred to lazyRedlining() and slimmed to the HOLC-graded subset.
  try {
    const [counties, summary] = await Promise.all([
      loadJSON("us_counties.min.geojson"),
      loadJSON("us_summary.json").catch(() => ({})),
    ]);
    state.counties = counties;
    state.summary = summary;
  } catch (e) {
    document.getElementById("atlas-stats").innerHTML =
      `<p class="text-rust">Could not load county data. Run scripts/11_national_county.py then scripts/90_optimize_web_geometry.py.</p>`;
    console.error(e);
    return;
  }

  buildHero();
  buildAtlas();
  buildControls();
  renderProse(Plot);
  mountExplorer();
  mountDownloads();
  buildWire();
  buildPapers();
  buildNetwork();
  setupScrolly();
  wireMasthead();
  setupReveal();
  mountAssistant();

  // Heavy redlining tract layer: fetch only as the section approaches the viewport.
  lazyRedlining();
}

// Defer the California HOLC tract payload until the redlining section is near.
// rootMargin gives a head start so the map is usually ready before it scrolls in.
function lazyRedlining() {
  const sec = document.getElementById("redlining");
  if (!sec) return;
  let started = false;
  const load = async () => {
    if (started) return;
    started = true;
    const mount = document.getElementById("redlining-mount");
    if (mount) mount.innerHTML = `<div class="redline-skeleton mono-dim">Loading the redlining map…</div>`;
    try {
      const [tracts, caSummary] = await Promise.all([
        loadJSON("ca_tracts_holc.geojson"),
        loadJSON("atlas_summary.json").catch(() => ({})),
      ]);
      state.caTracts = tracts;
      state.caSummary = caSummary;
    } catch (e) {
      console.error(e);
      if (mount) mount.innerHTML = `<p class="mono-dim">Redlining layer unavailable — run scripts/90_optimize_web_geometry.py.</p>`;
      return;
    }
    buildRedlining();
  };
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
  }, { rootMargin: "700px 0px" });
  io.observe(sec);
}

function wireMasthead() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("masthead-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
  }
}

// scroll-driven atlas: each .chapter sets variable / view / classification
function setupScrolly() {
  const scroller = scrollama();
  scroller.setup({ step: "#atlas .chapter", offset: 0.6 })
    .onStepEnter(({ element }) => {
      element.classList.add("is-active");
      const { var: v, view, class: cls } = element.dataset;
      if (cls) state.classifier = cls;
      if (v) {
        state.variable = v;
        const sel = document.getElementById("var-select");
        if (sel) sel.value = v;
        repaint();
      }
      if (view && atlasMap) atlasMap.flyTo({ ...VIEWS[view], duration: 1500, essential: true });
    })
    .onStepExit(({ element }) => element.classList.remove("is-active"));
  window.addEventListener("resize", () => scroller.resize());
}

async function buildWire() {
  const mount = document.getElementById("wire-mount");
  let feeds;
  try { feeds = await loadJSON("feeds.json"); }
  catch { mount.innerHTML = `<p class="mono-dim">Live wire unavailable — run scripts/70_feeds.py to build the snapshot.</p>`; return; }

  const stamp = document.getElementById("wire-stamp");
  if (stamp && feeds.generated)
    stamp.textContent = "· snapshot " + new Date(feeds.generated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const cols = [["data", "Data releases"], ["research", "Working papers"], ["news", "In the news"]];
  mount.innerHTML = cols.map(([key, label]) => {
    const lane = feeds.lanes[key] || [];
    const items = lane.map((it) => `
      <a class="ticker-item" href="${it.url}" target="_blank" rel="noopener">
        <div class="ticker-meta"><span class="ticker-source">${it.source}</span><span class="ticker-date">${fmtDate(it.date)}</span></div>
        <div class="ticker-title">${it.title}</div>
      </a>`).join("");
    return `<div class="wire-col">
      <div class="wire-col-head"><span class="wc-title">${label}</span><span class="wc-count">${lane.length} items</span></div>
      <div class="ticker-list">${items}</div></div>`;
  }).join("");
}

async function buildPapers() {
  const mount = document.getElementById("papers-mount");
  let data;
  try { data = await loadJSON("papers.json"); }
  catch { mount.innerHTML = `<p class="mono-dim">Reading room unavailable.</p>`; return; }

  const byTheme = {};
  for (const p of data.papers) (byTheme[p.theme] ||= []).push(p);
  mount.innerHTML = data.themes.map((theme) => {
    const ps = byTheme[theme] || [];
    if (!ps.length) return "";
    const items = ps.map((p) => {
      const href = p.doi ? `https://doi.org/${p.doi}` : (p.url || "#");
      const ref = p.doi ? `doi.org/${p.doi}` : "publisher record";
      return `<a class="paper-item" href="${href}" target="_blank" rel="noopener">
        <div class="paper-line"><span class="paper-year">${p.year}</span><span class="paper-title">${p.title}</span></div>
        <div class="paper-authors">${p.authors} · <span class="paper-venue">${p.venue}</span></div>
        <p class="paper-hook">${p.hook}</p>
        <div class="paper-doi">${ref} ↗</div>
      </a>`;
    }).join("");
    return `<div class="paper-theme"><div class="paper-theme-head">${theme}</div>${items}</div>`;
  }).join("");
}

async function buildNetwork() {
  const mount = document.getElementById("network-mount");
  if (!mount) return;
  let dispatch;
  try { dispatch = await loadJSON("dispatch.json"); }
  catch { mount.innerHTML = `<p class="mono-dim">Network manifest unavailable — run scripts/82_build_dispatch.py to build it.</p>`; return; }

  const stamp = document.getElementById("network-stamp");
  if (stamp && dispatch.generated)
    stamp.textContent = "· checked " + new Date(dispatch.generated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const dot = (live) => live === true ? "is-live" : live === false ? "is-down" : "is-unknown";
  const dotLabel = (live) => live === true ? "live" : live === false ? "offline" : "status unknown";

  const cards = (dispatch.nodes || []).map((n) => {
    const tags = (n.tags || []).map((t) => `<span class="net-tag">${esc(t)}</span>`).join("");
    const updated = n.updated ? `<span class="net-updated">updated ${fmtDate(n.updated)}</span>` : "";
    return `<a class="net-card" href="${esc(n.url)}" target="_blank" rel="noopener">
      <div class="net-card-head">
        <span class="net-status ${dot(n.live)}" title="${dotLabel(n.live)}"></span>
        <span class="net-title">${esc(n.title)}</span>
      </div>
      <p class="net-blurb">${esc(n.blurb)}</p>
      <p class="net-signal">${esc(n.signal)}</p>
      <div class="net-foot"><div class="net-tags">${tags}</div>${updated}</div>
    </a>`;
  }).join("");

  const hub = dispatch.hub
    ? `<a class="net-hub" href="${esc(dispatch.hub)}" target="_blank" rel="noopener">All projects on the hub ↗</a>`
    : "";
  mount.innerHTML = cards + hub;
}

function buildHero() {
  const m = new maplibregl.Map({
    container: "hero-map", style: BASEMAP, center: [-96.5, 38.5], zoom: 3.0,
    interactive: false, attributionControl: false,
  });
  m.on("load", () => {
    if (state.counties) {
      m.addSource("t", { type: "geojson", data: state.counties });
      m.addLayer({ id: "t-fill", type: "fill", source: "t",
        paint: { "fill-color": colorExpr("median_hh_income"), "fill-opacity": 0,
          "fill-opacity-transition": { duration: 900 } } });
      requestAnimationFrame(() => m.getLayer("t-fill") && m.setPaintProperty("t-fill", "fill-opacity", 0.8));
    }
    m.easeTo({ center: VIEWS.us.center, zoom: VIEWS.us.zoom, duration: 7000 });
  });
}

function colorExpr(varId) {
  const v = VARS[varId];
  const vals = state.counties.features.map((f) => num(f.properties[varId])).filter(Number.isFinite);
  const br = breaksFor(state.classifier, vals);
  return stepExpression(varId, br, RAMPS[v.palette] || RAMPS.reds);
}

function buildAtlas() {
  atlasMap = new maplibregl.Map({
    container: "atlas-map", style: BASEMAP, center: VIEWS.us.center, zoom: VIEWS.us.zoom,
  });
  atlasMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  // Add the county layers once the basemap style is parsed. We deliberately do
  // NOT wait for the "load" event: under the heavy first-paint cost of the
  // national GeoJSON, MapLibre's on-demand render loop can settle before "load"
  // ever fires. Polling isStyleLoaded() is event-timing-proof — there is no
  // window where the style is ready but no callback is scheduled to notice.
  whenStyleReady(atlasMap, () => {
    if (!state.counties) return;
    atlasMap.addSource("counties", { type: "geojson", data: state.counties });
    atlasMap.addLayer({ id: "fill", type: "fill", source: "counties",
      paint: { "fill-color": colorExpr(state.variable), "fill-opacity": 0,
        "fill-opacity-transition": { duration: 600 } } });
    atlasMap.addLayer({ id: "line", type: "line", source: "counties",
      paint: { "line-color": "#0d1b2a", "line-width": 0.2, "line-opacity": 0,
        "line-opacity-transition": { duration: 600 } } });
    atlasMap.addLayer({ id: "hl", type: "line", source: "counties",
      filter: ["==", "GEOID", ""], paint: { "line-color": "#b5482f", "line-width": 2 } });
    wirePopup();
    repaint();
    // Fade the choropleth in on the next frame so first paint is a soft reveal,
    // not a hard pop the instant the GeoJSON parses.
    requestAnimationFrame(() => {
      if (!atlasMap.getLayer("fill")) return;
      atlasMap.setPaintProperty("fill", "fill-opacity", 0.82);
      atlasMap.setPaintProperty("line", "line-opacity", 0.22);
    });
  });
}

// Run cb once the map style is loaded, regardless of whether the "load"/"styledata"
// events fire at a useful moment. Polls every 80ms (cheap, bounded by style load).
function whenStyleReady(map, cb) {
  if (map.isStyleLoaded()) { cb(); return; }
  const iv = setInterval(() => {
    if (map.isStyleLoaded()) { clearInterval(iv); cb(); }
  }, 80);
}

function wirePopup() {
  const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
  atlasMap.on("mousemove", "fill", (e) => {
    const f = e.features[0]; if (!f) return;
    atlasMap.getCanvas().style.cursor = "pointer";
    atlasMap.setFilter("hl", ["==", "GEOID", f.properties.GEOID]);
    const v = VARS[state.variable];
    const val = fmtVal(num(f.properties[state.variable]), v.unit);
    pop.setLngLat(e.lngLat).setHTML(
      `<strong>${f.properties.county_name || ""}</strong><br/>` +
      `<span class="pop-sub">${f.properties.state_name || ""}</span><br/>` +
      `${v.label}: <b>${val}</b>`
    ).addTo(atlasMap);
  });
  atlasMap.on("mouseleave", "fill", () => {
    atlasMap.getCanvas().style.cursor = "";
    atlasMap.setFilter("hl", ["==", "GEOID", ""]); pop.remove();
  });
}

function buildControls() {
  const sel = document.getElementById("var-select");
  sel.innerHTML = groupedOptions(state.variable);
  sel.value = state.variable;
  sel.addEventListener("change", () => { state.variable = sel.value; repaint(); });

  const cb = document.getElementById("class-buttons");
  const methods = [["quantile", "Quantile"], ["equal", "Equal"], ["jenks", "Jenks"]];
  cb.innerHTML = methods.map(([k, l]) =>
    `<button data-m="${k}" class="cls">${l}</button>`).join("");
  cb.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.classifier = b.dataset.m; repaint();
  });

  // easeOutCubic: decelerating glide reads more composed than the default ease.
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  document.querySelectorAll(".flyto").forEach((b) =>
    b.addEventListener("click", () => atlasMap.flyTo({
      ...VIEWS[b.dataset.fly], duration: 1800, curve: 1.42, easing: easeOutCubic })));
}

function repaint() {
  const v = VARS[state.variable];
  document.getElementById("var-desc").textContent = `${v.desc} Source: ${v.source}.`;
  document.querySelectorAll(".cls").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.m === state.classifier));
  if (!atlasMap || !atlasMap.getLayer("fill")) return;

  const vals = state.counties.features.map((f) => num(f.properties[state.variable])).filter(Number.isFinite);
  currentValues = vals;
  const br = breaksFor(state.classifier, vals);
  const ramp = RAMPS[v.palette] || RAMPS.reds;
  atlasMap.setPaintProperty("fill", "fill-color", stepExpression(state.variable, br, ramp));
  renderLegend(br, ramp, v);
  renderStats(vals, v);
}

function renderLegend(br, ramp, v) {
  const fmt = (x) => fmtVal(x, v.unit);
  const rows = ramp.map((c, i) => {
    const lo = i === 0 ? "min" : fmt(br[i - 1]);
    const hi = i === ramp.length - 1 ? "max" : fmt(br[i]);
    return `<div class="lg-row"><span class="legend-swatch" style="background:${c}"></span><span>${lo} – ${hi}</span></div>`;
  }).join("");
  document.getElementById("legend").innerHTML =
    `<div class="lg-title">${v.label} (${v.unit})</div>${rows}` +
    `<div class="lg-row"><span class="legend-swatch" style="background:#d8d8d2"></span><span>no data</span></div>`;
}

function renderStats(vals, v) {
  const s = vals.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.floor(p * s.length)];
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  document.getElementById("atlas-stats").innerHTML = `
    <div class="os-label">across ${vals.length.toLocaleString()} counties</div>
    <div>median ${fmtVal(q(0.5), v.unit)} · mean ${fmtVal(mean, v.unit)}</div>
    <div>p10–p90 ${fmtVal(q(0.1), v.unit)} → ${fmtVal(q(0.9), v.unit)}</div>`;
  const c = document.getElementById("atlas-count");
  if (c) c.textContent = vals.length.toLocaleString() + " counties";
}

function buildRedlining() {
  const mount = document.getElementById("redlining-mount");
  mount.innerHTML = `<div id="redline-map" class="h-[60vh] rounded-lg overflow-hidden border border-ink/15"></div>
    <div id="redline-gradient" class="mt-6"></div>`;
  const m = new maplibregl.Map({ container: "redline-map", style: BASEMAP, ...VIEWS.la });
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  m.on("load", () => {
    if (!state.caTracts) return;
    m.addSource("t", { type: "geojson", data: state.caTracts });
    m.addLayer({ id: "holc", type: "fill", source: "t",
      filter: ["has", "holc_dominant_grade"],
      paint: { "fill-color": ["match", ["get", "holc_dominant_grade"],
        "A", HOLC_COLORS.A, "B", HOLC_COLORS.B, "C", HOLC_COLORS.C, "D", HOLC_COLORS.D, "#ccc"],
        "fill-opacity": 0, "fill-opacity-transition": { duration: 600 } } });
    m.addLayer({ id: "holc-line", type: "line", source: "t",
      filter: ["has", "holc_dominant_grade"],
      paint: { "line-color": "#0d1b2a", "line-width": 0.2, "line-opacity": 0,
        "line-opacity-transition": { duration: 600 } } });
    requestAnimationFrame(() => {
      if (!m.getLayer("holc")) return;
      m.setPaintProperty("holc", "fill-opacity", 0.75);
      m.setPaintProperty("holc-line", "line-opacity", 0.3);
    });
  });
  // gradient: mean diabetes by HOLC grade, computed from tract props
  const g = { A: [], B: [], C: [], D: [] };
  if (!state.caTracts) return;
  state.caTracts.features.forEach((f) => {
    const gr = f.properties.holc_dominant_grade, d = num(f.properties.diabetes_pct);
    if (gr && g[gr] && Number.isFinite(d)) g[gr].push(d);
  });
  const data = Object.entries(g).map(([grade, arr]) => ({
    grade, mean: arr.reduce((a, b) => a + b, 0) / (arr.length || 1), n: arr.length }));
  document.getElementById("redline-gradient").append(Plot.plot({
    height: 260, marginLeft: 50,
    x: { label: "1939 HOLC grade" },
    y: { label: "mean adult diabetes (%)", grid: true },
    marks: [
      Plot.barY(data, { x: "grade", y: "mean", fill: (d) => HOLC_COLORS[d.grade] }),
      Plot.text(data, { x: "grade", y: "mean", text: (d) => d.mean.toFixed(1), dy: -8 }),
    ],
  }));
}

function setupReveal() {
  document.querySelectorAll(".reveal").forEach((el) =>
    inView(el, () => { el.classList.add("in"); animate(el, { opacity: [0, 1], y: [16, 0] }, { duration: 0.7 }); }, { amount: 0.15 }));
}

boot();
