import maplibregl from "maplibre-gl";
import * as Plot from "@observablehq/plot";
import { animate, inView } from "motion";
import { VARS, RAMPS, HOLC_COLORS, state, loadJSON, groupedOptions } from "./data.js";
import { breaksFor, stepExpression, fmtVal } from "./classify.js";
import {
  renderReadingMap, renderDistributions, renderCEF, renderRegression,
  renderInference, renderMoran, renderBayes, renderPolicy, renderMethods,
  renderGradientField, renderOptimalTransport, renderNetworks, renderTopology,
} from "./prose.js";
import { mountExplorer } from "./explorer.js";
import { mountDownloads } from "./download.js";
import { mountAssistant } from "./assistant.js";
import { PAGES, GROUPS } from "./curriculum.js";
import { startRouter } from "./router.js";
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
  ca: { center: [-119.4, 37.2], zoom: 5.1 },
  la: { center: [-118.3, 34.05], zoom: 8.4 },
  stl: { center: [-90.25, 38.64], zoom: 9.8 },
};

// ---- MapLibre lifecycle ----------------------------------------------------
// Each routed page may build one or more maps into its own containers. When the
// router swaps the view's innerHTML those containers vanish, but the WebGL
// contexts they held do not free themselves — browsers cap live contexts at
// ~16, so a few navigations would exhaust them. teardownMaps() is the router's
// onBeforeRender hook: it disposes every map from the outgoing page.
let activeMaps = [];
let atlasMap = null;
function registerMap(m) { activeMaps.push(m); return m; }
function teardownMaps() {
  for (const m of activeMaps) { try { m.remove(); } catch { /* already gone */ } }
  activeMaps = [];
  atlasMap = null;
}

// ---- boot ------------------------------------------------------------------
async function boot() {
  try {
    const [counties, summary] = await Promise.all([
      loadJSON("us_counties.min.geojson"),
      loadJSON("us_summary.json").catch(() => ({})),
    ]);
    state.counties = counties;
    state.summary = summary;
  } catch (e) {
    document.getElementById("view").innerHTML =
      `<p class="load-error">Could not load county data. Run scripts/11_national_county.py then scripts/90_optimize_web_geometry.py.</p>`;
    console.error(e);
    return;
  }

  // Map every page id to its behavior, then wrap so the reveal animation and
  // chapter prev/next run uniformly after each mount.
  const MOUNTS = {
    home: mountHome,
    atlas: mountAtlas,
    "reading-a-map": () => renderReadingMap(),
    distributions: () => renderDistributions(Plot),
    "conditional-expectations": () => renderCEF(Plot),
    regression: () => renderRegression(Plot),
    inference: () => renderInference(Plot),
    bayes: () => renderBayes(Plot),
    "spatial-dependence": () => renderMoran(Plot),
    policy: () => renderPolicy(Plot),
    redlining: mountRedlining,
    "gradient-fields": () => renderGradientField(),
    "optimal-transport": () => renderOptimalTransport(),
    "networks-diffusion": () => renderNetworks(),
    topology: () => renderTopology(),
    explorer: () => mountExplorer(),
    download: () => mountDownloads(),
    wire: mountWire,
    "reading-room": mountPapers,
    network: mountNetwork,
    methods: () => renderMethods(),
  };
  PAGES.forEach((p) => { p.mount = () => MOUNTS[p.id]?.(); });

  buildNav();
  wireMastheadToggle();

  startRouter({
    view: document.getElementById("view"),
    pages: PAGES,
    fallback: "/",
    onBeforeRender: teardownMaps,
    onAfterRender: (page) => { markActiveNav(page); fillChapterNav(page); setupReveal(); },
  });

  mountAssistant();   // global floating drawer, mounted once
}

// ---- navigation chrome -----------------------------------------------------
function buildNav() {
  const nav = document.getElementById("masthead-nav");
  if (!nav) return;
  const byGroup = {};
  for (const p of PAGES) (byGroup[p.group] ??= []).push(p);
  nav.innerHTML = GROUPS.map((g) => {
    const pages = byGroup[g.id] || [];
    if (!pages.length) return "";
    const links = pages.map((p) =>
      `<a href="#${p.route}" data-route="${p.route}">${p.nav}</a>`).join("");
    const label = g.label
      ? `<span class="nav-group-label">${g.label}</span>` : "";
    return `<div class="nav-group">${label}${links}</div>`;
  }).join("");
}

function markActiveNav(page) {
  document.querySelectorAll("#masthead-nav a").forEach((a) =>
    a.classList.toggle("is-current", a.dataset.route === page.route));
}

// Linear curriculum spine: pages that carry a `seq`, in order. Drives the
// prev/next control at the foot of each chapter (apparatus/data pages opt out).
const SPINE = PAGES.filter((p) => p.seq != null).sort((a, b) => a.seq - b.seq);
function fillChapterNav(page) {
  const slot = document.getElementById("chapter-nav");
  if (!slot) return;
  const i = SPINE.findIndex((p) => p.id === page.id);
  if (i === -1) { slot.innerHTML = ""; return; }
  const prev = SPINE[i - 1], next = SPINE[i + 1];
  const link = (p, dir) => p
    ? `<a class="cn-link cn-${dir}" href="#${p.route}">
        <span class="cn-dir">${dir === "prev" ? "← Previous" : "Next →"}</span>
        <span class="cn-title">${p.title || p.nav}</span></a>`
    : `<span class="cn-link cn-empty"></span>`;
  slot.innerHTML = link(prev, "prev") + link(next, "next");
}

function wireMastheadToggle() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("masthead-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) nav.classList.remove("open");
    });
  }
}

// ---- page mounts -----------------------------------------------------------
function mountHome() {
  if (!document.getElementById("hero-map")) return;
  const m = registerMap(new maplibregl.Map({
    container: "hero-map", style: BASEMAP, center: [-96.5, 38.5], zoom: 3.0,
    interactive: false, attributionControl: false,
  }));
  m.on("load", () => {
    if (state.counties) {
      m.addSource("t", { type: "geojson", data: state.counties });
      m.addLayer({ id: "t-fill", type: "fill", source: "t",
        paint: { "fill-color": colorExpr("median_hh_income"), "fill-antialias": false,
          "fill-opacity": 0, "fill-opacity-transition": { duration: 900 } } });
      requestAnimationFrame(() => m.getLayer("t-fill") && m.setPaintProperty("t-fill", "fill-opacity", 0.8));
    }
    m.easeTo({ center: VIEWS.us.center, zoom: VIEWS.us.zoom, duration: 7000 });
  });
}

function mountAtlas() {
  if (!document.getElementById("atlas-map")) return;
  atlasMap = registerMap(new maplibregl.Map({
    container: "atlas-map", style: BASEMAP, center: VIEWS.us.center, zoom: VIEWS.us.zoom,
  }));
  atlasMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  // Add county layers once the style is parsed. We poll isStyleLoaded() rather
  // than waiting on "load": under the heavy first paint of the national GeoJSON
  // the render loop can settle before "load" ever fires.
  whenStyleReady(atlasMap, () => {
    if (!state.counties || !atlasMap) return;
    atlasMap.addSource("counties", { type: "geojson", data: state.counties });
    // fill-antialias:false is deliberate: with it on, MapLibre antialiases each
    // polygon edge toward the basemap, and at a shared boundary the two
    // semi-transparent fills' edges don't coincide — the light basemap bleeds
    // through as a hairline ("white gaps"). Off, the topology-shared arcs tile
    // exactly and the line layer below supplies the crisp edge.
    atlasMap.addLayer({ id: "fill", type: "fill", source: "counties",
      paint: { "fill-color": colorExpr(state.variable), "fill-antialias": false,
        "fill-opacity": 0, "fill-opacity-transition": { duration: 600 } } });
    atlasMap.addLayer({ id: "line", type: "line", source: "counties",
      paint: { "line-color": "rgba(13,27,42,0.5)", "line-width": 0.35, "line-opacity": 0,
        "line-opacity-transition": { duration: 600 } } });
    atlasMap.addLayer({ id: "hl", type: "line", source: "counties",
      filter: ["==", "GEOID", ""], paint: { "line-color": "#b5482f", "line-width": 2 } });
    wirePopup();
    repaint();
    requestAnimationFrame(() => {
      if (!atlasMap || !atlasMap.getLayer("fill")) return;
      atlasMap.setPaintProperty("fill", "fill-opacity", 0.82);
      atlasMap.setPaintProperty("line", "line-opacity", 0.22);
    });
  });

  buildControls();
  wirePresets();
}

// Guided-view presets replace the old scroll-driven chapters: each sets a
// variable, classification, and region in one click.
function wirePresets() {
  const list = document.getElementById("atlas-presets");
  if (!list) return;
  list.addEventListener("click", (e) => {
    const b = e.target.closest(".preset"); if (!b) return;
    list.querySelectorAll(".preset").forEach((x) => x.classList.toggle("is-active", x === b));
    const { var: v, view, class: cls } = b.dataset;
    if (cls) state.classifier = cls;
    if (v) {
      state.variable = v;
      const sel = document.getElementById("var-select");
      if (sel) sel.value = v;
      repaint();
    }
    if (view && atlasMap) atlasMap.flyTo({ ...VIEWS[view], duration: 1600, essential: true });
  });
}

async function mountRedlining() {
  const mount = document.getElementById("redlining-mount");
  if (!mount) return;
  mount.innerHTML = `<div class="redline-skeleton mono-dim">Loading the redlining map…</div>`;
  if (!state.caTracts) {
    try {
      const [tracts, caSummary] = await Promise.all([
        loadJSON("ca_tracts_holc.geojson"),
        loadJSON("atlas_summary.json").catch(() => ({})),
      ]);
      state.caTracts = tracts;
      state.caSummary = caSummary;
    } catch (e) {
      console.error(e);
      mount.innerHTML = `<p class="mono-dim">Redlining layer unavailable — run scripts/90_optimize_web_geometry.py.</p>`;
      return;
    }
  }
  // Guard: the user may have navigated away during the fetch.
  if (!document.getElementById("redlining-mount")) return;
  buildRedlining();
}

async function mountWire() {
  const mount = document.getElementById("wire-mount");
  if (!mount) return;
  let feeds;
  try { feeds = await loadJSON("feeds.json"); }
  catch { mount.innerHTML = `<p class="mono-dim">Live wire unavailable — run scripts/70_feeds.py to build the snapshot.</p>`; return; }
  if (!document.getElementById("wire-mount")) return;

  const stamp = document.getElementById("wire-stamp");
  if (stamp && feeds.generated)
    stamp.textContent = "snapshot " + new Date(feeds.generated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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

async function mountPapers() {
  const mount = document.getElementById("papers-mount");
  if (!mount) return;
  let data;
  try { data = await loadJSON("papers.json"); }
  catch { mount.innerHTML = `<p class="mono-dim">Reading room unavailable.</p>`; return; }
  if (!document.getElementById("papers-mount")) return;

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

async function mountNetwork() {
  const mount = document.getElementById("network-mount");
  if (!mount) return;
  let dispatch;
  try { dispatch = await loadJSON("dispatch.json"); }
  catch { mount.innerHTML = `<p class="mono-dim">Network manifest unavailable — run scripts/82_build_dispatch.py to build it.</p>`; return; }
  if (!document.getElementById("network-mount")) return;

  const stamp = document.getElementById("network-stamp");
  if (stamp && dispatch.generated)
    stamp.textContent = "checked " + new Date(dispatch.generated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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

// ---- atlas internals (shared by mountAtlas / repaint) ----------------------
function colorExpr(varId) {
  const v = VARS[varId];
  const vals = state.counties.features.map((f) => num(f.properties[varId])).filter(Number.isFinite);
  const br = breaksFor(state.classifier, vals);
  return stepExpression(varId, br, RAMPS[v.palette] || RAMPS.reds);
}

function whenStyleReady(map, cb) {
  if (map.isStyleLoaded()) { cb(); return; }
  const iv = setInterval(() => {
    if (!map || !map.getContainer()) { clearInterval(iv); return; }
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
  if (!sel) return;
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

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  document.querySelectorAll(".flyto").forEach((b) =>
    b.addEventListener("click", () => atlasMap && atlasMap.flyTo({
      ...VIEWS[b.dataset.fly], duration: 1800, curve: 1.42, easing: easeOutCubic })));
}

function repaint() {
  const v = VARS[state.variable];
  const desc = document.getElementById("var-desc");
  if (desc) desc.textContent = `${v.desc} Source: ${v.source}.`;
  document.querySelectorAll(".cls").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.m === state.classifier));
  if (!atlasMap || !atlasMap.getLayer("fill")) return;

  const vals = state.counties.features.map((f) => num(f.properties[state.variable])).filter(Number.isFinite);
  const br = breaksFor(state.classifier, vals);
  const ramp = RAMPS[v.palette] || RAMPS.reds;
  atlasMap.setPaintProperty("fill", "fill-color", stepExpression(state.variable, br, ramp));
  renderLegend(br, ramp, v);
  renderStats(vals, v);
}

function renderLegend(br, ramp, v) {
  const slot = document.getElementById("legend");
  if (!slot) return;
  const fmt = (x) => fmtVal(x, v.unit);
  const rows = ramp.map((c, i) => {
    const lo = i === 0 ? "min" : fmt(br[i - 1]);
    const hi = i === ramp.length - 1 ? "max" : fmt(br[i]);
    return `<div class="lg-row"><span class="legend-swatch" style="background:${c}"></span><span>${lo} – ${hi}</span></div>`;
  }).join("");
  slot.innerHTML =
    `<div class="lg-title">${v.label} (${v.unit})</div>${rows}` +
    `<div class="lg-row"><span class="legend-swatch" style="background:#d8d8d2"></span><span>no data</span></div>`;
}

function renderStats(vals, v) {
  const slot = document.getElementById("atlas-stats");
  if (!slot) return;
  const s = vals.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.floor(p * s.length)];
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  slot.innerHTML = `
    <div class="os-label">across ${vals.length.toLocaleString()} counties</div>
    <div>median ${fmtVal(q(0.5), v.unit)} · mean ${fmtVal(mean, v.unit)}</div>
    <div>p10–p90 ${fmtVal(q(0.1), v.unit)} → ${fmtVal(q(0.9), v.unit)}</div>`;
  const c = document.getElementById("atlas-count");
  if (c) c.textContent = vals.length.toLocaleString() + " counties";
}

function buildRedlining() {
  const mount = document.getElementById("redlining-mount");
  if (!mount) return;
  mount.innerHTML = `<div id="redline-map" class="redline-map"></div>
    <div id="redline-gradient" class="mt-6"></div>`;
  const m = registerMap(new maplibregl.Map({ container: "redline-map", style: BASEMAP, ...VIEWS.la }));
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  m.on("load", () => {
    if (!state.caTracts) return;
    m.addSource("t", { type: "geojson", data: state.caTracts });
    m.addLayer({ id: "holc", type: "fill", source: "t",
      filter: ["has", "holc_dominant_grade"],
      paint: { "fill-color": ["match", ["get", "holc_dominant_grade"],
        "A", HOLC_COLORS.A, "B", HOLC_COLORS.B, "C", HOLC_COLORS.C, "D", HOLC_COLORS.D, "#ccc"],
        "fill-antialias": false,
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
  state.caTracts.features.forEach((f) => {
    const gr = f.properties.holc_dominant_grade, d = num(f.properties.diabetes_pct);
    if (gr && g[gr] && Number.isFinite(d)) g[gr].push(d);
  });
  const data = Object.entries(g).map(([grade, arr]) => ({
    grade, mean: arr.reduce((a, b) => a + b, 0) / (arr.length || 1), n: arr.length }));
  const gradEl = document.getElementById("redline-gradient");
  if (gradEl) gradEl.append(Plot.plot({
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
  document.querySelectorAll(".reveal:not(.in)").forEach((el) =>
    inView(el, () => { el.classList.add("in"); animate(el, { opacity: [0, 1], y: [16, 0] }, { duration: 0.7 }); }, { amount: 0.12 }));
}

boot();
