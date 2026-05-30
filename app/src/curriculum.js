// The curriculum manifest. Each entry is one routed page: its content markup
// lives here (pure strings, no behavior); main.js attaches the mount function
// by id and wires prev/next from the `seq` order. The spine is three Movements:
//
//   I.   The county as an exchangeable draw   — classical, non-spatial inference
//   II.  The spatial field                    — dependence, the map as data
//   III. Geosocioeconometrics                 — the field's own geometry (Helfrich)
//
// Movement I teaches statistics from scratch on live national data. Movement II
// breaks the independence assumption and treats the country as a field. Movement
// III is the original program: gradients and structure tensors, optimal transport
// as distributional flux, networks and diffusion, and the topology of the field.

export const GROUPS = [
  { id: "front", label: "" },
  { id: "I", label: "I · The county as a draw", sub: "Classical inference" },
  { id: "II", label: "II · The spatial field", sub: "Dependence & the map as data" },
  { id: "III", label: "III · Geosocioeconometrics", sub: "Geometry of the field" },
  { id: "data", label: "Data" },
  { id: "apparatus", label: "Apparatus" },
];

// ---- page chrome helpers (keep every page visually consistent) ----
const head = ({ kicker, title, lede }) => `
  <header class="page-head reveal">
    ${kicker ? `<div class="kicker">${kicker}</div>` : ""}
    <h1 class="page-title">${title}</h1>
    ${lede ? `<p class="page-lede">${lede}</p>` : ""}
  </header>`;

// A standard teaching module: prose slot (filled by prose.js) + a plot div.
const moduleBody = (proseId, plotId) => `
  <section id="${proseId}" class="page-body reveal">
    <div class="prose-slot"></div>
    ${plotId ? `<div id="${plotId}" class="plot"></div>` : ""}
  </section>`;

const chapterNav = `<nav class="chapter-nav" id="chapter-nav"></nav>`;

// =====================================================================
// PAGES
// =====================================================================
export const PAGES = [
  // ---------- FRONT MATTER ----------
  {
    id: "home", route: "/", group: "front", nav: "Cover", title: "",
    html: `
      <section class="hero">
        <div id="hero-map"></div>
        <div class="hero-scrim"></div>
        <div class="hero-inner">
          <div class="kicker reveal">Vol. I · 3,144 counties · 50 states + DC · ACS 2018–22 → today</div>
          <h1 class="hero-title reveal">A country is a field,<br/>not a list.</h1>
          <p class="hero-lede reveal">A working atlas of the United States, built to <em>teach</em>. It starts where every statistics course starts — distributions, regression, inference, on live national data — then breaks the assumption that counties are independent draws and treats the country as what it is: a field with geometry. The last movement is a research program of my own, geosocioeconometrics, taught from the first page.</p>
          <div class="hero-actions reveal">
            <a href="#/atlas" class="btn btn-solid">Open the atlas</a>
            <a href="#/i/distributions" class="btn btn-ghost">Start the curriculum</a>
          </div>
        </div>
      </section>

      <section class="toc reveal">
        <div class="toc-intro">
          <span class="kicker">How to read this atlas</span>
          <h2 class="toc-title">Three movements, in order.</h2>
          <p class="toc-sub">Each page is a single idea on the same national data. Read them in sequence and the argument builds: a county looks like an independent observation, then it doesn't, then the dependence itself becomes the object worth modeling.</p>
        </div>
        <div class="toc-grid">
          <a class="toc-card toc-i" href="#/i/distributions">
            <span class="toc-num">I</span>
            <h3>The county as a draw</h3>
            <p>Distributions, conditional expectations, regression, sampling and inference, Bayesian shrinkage. The classical toolkit, taught from scratch on every county in the country.</p>
            <span class="toc-go">Begin Movement I →</span>
          </a>
          <a class="toc-card toc-ii" href="#/ii/spatial-dependence">
            <span class="toc-num">II</span>
            <h3>The spatial field</h3>
            <p>Tobler's law made quantitative: Moran's I, the map as data, a place-based counterfactual, and the redlining line of 1939 still legible in today's health gradient.</p>
            <span class="toc-go">Begin Movement II →</span>
          </a>
          <a class="toc-card toc-iii" href="#/iii/gradient-fields">
            <span class="toc-num">III</span>
            <h3>Geosocioeconometrics</h3>
            <p>The original program. Gradient and structure-tensor fields, optimal transport as distributional flux, networks and diffusion, and the topology of the socioeconomic surface.</p>
            <span class="toc-go">Begin Movement III →</span>
          </a>
        </div>
      </section>`,
  },

  {
    id: "atlas", route: "/atlas", group: "front", nav: "The atlas", seq: 0,
    title: "The atlas",
    html: `
      <section class="atlas-page">
        <div class="atlas-stage">
          <div id="atlas-map"></div>
          <div class="stage-overlay">
            <div class="overlay-head">
              <span class="kicker">The atlas</span>
              <span class="overlay-count" id="atlas-count"></span>
            </div>
            <select id="var-select" aria-label="variable"></select>
            <div id="class-buttons" class="class-row"></div>
            <div id="legend" class="legend"></div>
            <div id="atlas-stats" class="overlay-stats"></div>
            <div class="fly-row">
              <button data-fly="us" class="flyto">United States</button>
              <button data-fly="west" class="flyto">West</button>
              <button data-fly="south" class="flyto">South</button>
              <button data-fly="northeast" class="flyto">Northeast</button>
            </div>
            <p id="var-desc" class="overlay-desc"></p>
          </div>
        </div>
        <div class="atlas-rail reveal">
          <span class="kicker">Guided views</span>
          <h2 class="rail-title">Five ways into the country</h2>
          <p class="rail-sub">Each preset sets a variable, a classification rule, and a region. Everything in Movements I–III is built from this same national data — change the number here and the lessons downstream change with it.</p>
          <div class="preset-list" id="atlas-presets">
            <button class="preset" data-var="pop_density_km2" data-view="us" data-class="jenks">
              <b>Where people are</b><span>Population density · four orders of magnitude · Jenks breaks</span></button>
            <button class="preset" data-var="median_hh_income" data-view="us" data-class="quantile">
              <b>The money map</b><span>Median household income · quantile cut · the coasts separate</span></button>
            <button class="preset" data-var="pct_poverty" data-view="south" data-class="quantile">
              <b>The persistent South</b><span>Poverty · the Delta, the Black Belt, Appalachia</span></button>
            <button class="preset" data-var="diabetes_pct" data-view="south" data-class="jenks">
              <b>The health gradient</b><span>Adult diabetes · the CDC's "diabetes belt"</span></button>
            <button class="preset" data-var="pct_bachelor_plus" data-view="northeast" data-class="quantile">
              <b>The education corridor</b><span>Bachelor's-plus share · the Northeast metro band</span></button>
          </div>
        </div>
      </section>
      ${chapterNav}`,
  },

  // ---------- MOVEMENT I ----------
  {
    id: "reading-a-map", route: "/i/reading-a-map", group: "I", nav: "Reading a map", seq: 1,
    title: "Reading a map",
    html: head({ kicker: "Movement I · 01 · Reading a map",
      title: "The same data, cut three ways",
      lede: "Before any statistic, a decision: where do the color breaks go? It is the first place an analyst's assumptions become visible." })
      + moduleBody("m1", null) + chapterNav,
  },
  {
    id: "distributions", route: "/i/distributions", group: "I", nav: "Distributions", seq: 2,
    title: "Distributions",
    html: head({ kicker: "Movement I · 02 · Distributions",
      title: "One variable, 3,144 counties",
      lede: "A distribution is the full answer to a simple question: how often does each value happen?" })
      + moduleBody("m2", "dist-plot") + chapterNav,
  },
  {
    id: "conditional-expectations", route: "/i/conditional-expectations", group: "I", nav: "E[Y | X]", seq: 3,
    title: "Conditional expectations",
    html: head({ kicker: "Movement I · 03 · Conditional expectations",
      title: "E[Y | X], the most useful object in statistics",
      lede: "For counties at a given income, what is the average diabetes rate? Answering that, value by value, is most of applied statistics." })
      + moduleBody("m3", "cef-plot") + chapterNav,
  },
  {
    id: "regression", route: "/i/regression", group: "I", nav: "Regression", seq: 4,
    title: "Regression",
    html: head({ kicker: "Movement I · 04 · Regression",
      title: "A line, and then a control",
      lede: "The straight-line summary of the cloud — and what happens to the slope when a second variable enters." })
      + moduleBody("m4", "reg-plot") + chapterNav,
  },
  {
    id: "inference", route: "/i/inference", group: "I", nav: "Inference", seq: 5,
    title: "Statistical inference",
    html: head({ kicker: "Movement I · 05 · Statistical inference",
      title: "From one sample to a sampling distribution",
      lede: "If you only saw a handful of counties, how sure could you be about the whole country? The central limit theorem, shown rather than asserted." })
      + moduleBody("m5", "inference-plot") + chapterNav,
  },
  {
    id: "bayes", route: "/i/bayes", group: "I", nav: "Bayesian shrinkage", seq: 6,
    title: "Bayesian shrinkage",
    html: head({ kicker: "Movement I · 06 · Bayesian thinking",
      title: "Borrowing strength across counties",
      lede: "A 20% rate measured on 500 people is barely a measurement. Shrinkage pulls the noisy local estimate toward the whole, in proportion to how little it knows." })
      + moduleBody("m7", "bayes-plot") + chapterNav,
  },

  // ---------- MOVEMENT II ----------
  {
    id: "spatial-dependence", route: "/ii/spatial-dependence", group: "II", nav: "Spatial dependence", seq: 7,
    title: "Spatial dependence",
    html: head({ kicker: "Movement II · 07 · Spatial dependence",
      title: "Nearby counties are not strangers",
      lede: "Movement I treated each county as an independent draw. Tobler's first law says that is wrong — and Moran's I says exactly how wrong." })
      + moduleBody("m6", "moran-plot") + chapterNav,
  },
  {
    id: "policy", route: "/ii/policy", group: "II", nav: "Policy counterfactual", seq: 8,
    title: "Policy & forecasting",
    html: head({ kicker: "Movement II · 08 · Policy impact & forecasting",
      title: "From description to counterfactual",
      lede: "Sort the country by poverty, watch diabetes climb, then ask the what-if a place-based program implies — with its assumptions in the open." })
      + moduleBody("m8", "policy-plot") + chapterNav,
  },
  {
    id: "redlining", route: "/ii/redlining", group: "II", nav: "The redlining line", seq: 9,
    title: "The redlining line",
    html: `
      <section class="flagship reveal">
        <div class="flagship-inner">
          <span class="kicker kicker-light">Movement II · The flagship case</span>
          <h1 class="flagship-title">A line drawn in 1939, still legible today</h1>
          <p class="page-lede page-lede-light">The Home Owners' Loan Corporation graded neighborhoods A through D and starved the D's of investment. The grades are gone; the gradient they produced is not. Here it is, in present-day health data, at the tract scale.</p>
          <div id="redlining" class="prose-slot prose-slot-light"></div>
          <div id="redlining-mount" class="mt"></div>
        </div>
      </section>
      ${chapterNav}`,
  },

  // ---------- MOVEMENT III ----------
  {
    id: "gradient-fields", route: "/iii/gradient-fields", group: "III", nav: "Gradient & tensor fields", seq: 10,
    title: "Gradient & structure-tensor fields",
    html: head({ kicker: "Movement III · 09 · Geometry of the field",
      title: "Where the country changes fastest",
      lede: "Stop reading the map as 3,144 numbers and read it as a surface Z(s). A surface has a slope everywhere, and the slope is where the structure is." })
      + `<section class="page-body reveal">
        <div class="prose-slot" id="iii-grad-prose"></div>
        <div id="grad-plot" class="plot"></div>
        <div class="dev-note">Interactive vector-field and structure-tensor viewer in development. The math below is the specification it implements.</div>
      </section>` + chapterNav,
  },
  {
    id: "optimal-transport", route: "/iii/optimal-transport", group: "III", nav: "Optimal transport", seq: 11,
    title: "Optimal transport & distributional flux",
    html: head({ kicker: "Movement III · 10 · Distributional flux",
      title: "The cost of moving one map onto another",
      lede: "Where poverty is, against where clinics are. Optimal transport measures the minimal work to reconcile the two, and the velocity field that does it is what I call distributional flux." })
      + `<section class="page-body reveal">
        <div class="prose-slot" id="iii-ot-prose"></div>
        <div class="dev-note">Sinkhorn / POT companion and the Benamou–Brenier flow viewer in development. The specification follows.</div>
      </section>` + chapterNav,
  },
  {
    id: "networks-diffusion", route: "/iii/networks-diffusion", group: "III", nav: "Networks & diffusion", seq: 12,
    title: "Networks & diffusion",
    html: head({ kicker: "Movement III · 11 · Networks & diffusion",
      title: "The country as a graph that conducts",
      lede: "Counties are nodes, shared borders are edges, and the graph Laplacian governs how a shock spreads. This is the operator that quietly underwrote Movements I and II." })
      + `<section class="page-body reveal">
        <div class="prose-slot" id="iii-net-prose"></div>
        <div class="dev-note">Heat-kernel diffusion and effective-distance viewer in development. The specification follows.</div>
      </section>` + chapterNav,
  },
  {
    id: "topology", route: "/iii/topology", group: "III", nav: "Topology of the field", seq: 13,
    title: "Topology of the field",
    html: head({ kicker: "Movement III · 12 · Topology",
      title: "How many clusters, without choosing a threshold",
      lede: "Lower a waterline through the surface and watch islands appear and merge. Persistent homology records which features are real and which are noise — the question Moran's I could only answer yes or no." })
      + `<section class="page-body reveal">
        <div class="prose-slot" id="iii-topo-prose"></div>
        <div class="dev-note">Persistence-diagram viewer (superlevel-set filtration) in development. The specification follows.</div>
      </section>` + chapterNav,
  },

  // ---------- DATA ----------
  {
    id: "explorer", route: "/data/explorer", group: "data", nav: "Data explorer",
    title: "Data explorer",
    html: head({ kicker: "Data · the explorer",
      title: "Cut the data yourself",
      lede: "Every county, every variable, in your browser. Filter, rank, relate any two measures, and take your selection with you." })
      + `<section class="page-body reveal"><div id="explorer-mount" class="mt"></div></section>`,
  },
  {
    id: "download", route: "/data/download", group: "data", nav: "Open data",
    title: "Open data",
    html: head({ kicker: "Data · open download",
      title: "Take the data with you",
      lede: "Everything here is a static file and a plain GET. CSV, GeoJSON, and a full data dictionary." })
      + `<section class="page-body reveal"><div id="download-mount" class="mt"></div></section>`,
  },

  // ---------- APPARATUS ----------
  {
    id: "wire", route: "/apparatus/wire", group: "apparatus", nav: "Live wire",
    title: "Live wire",
    html: head({ kicker: "Apparatus · live wire",
      title: "What the data agencies are saying right now",
      lede: "A build-time snapshot of release calendars, working papers, and coverage. Refreshed daily." })
      + `<section class="page-body reveal"><p class="section-sub"><span id="wire-stamp" class="mono-dim"></span></p><div id="wire-mount" class="wire-grid"></div></section>`,
  },
  {
    id: "reading-room", route: "/apparatus/reading-room", group: "apparatus", nav: "Reading room",
    title: "Reading room",
    html: head({ kicker: "Apparatus · reading room",
      title: "The papers behind the maps",
      lede: "The literature this atlas leans on, from Moran (1950) onward. Every DOI checked against the publisher of record." })
      + `<section class="page-body reveal"><div id="papers-mount" class="papers-mount"></div></section>`,
  },
  {
    id: "network", route: "/apparatus/network", group: "apparatus", nav: "Research network",
    title: "Research network",
    html: head({ kicker: "Apparatus · research network",
      title: "One node in a wider observatory",
      lede: "This atlas is a federated spoke of a wider network of public research instruments. Liveness and last activity are checked when this page is built." })
      + `<section class="page-body reveal"><p class="section-sub"><span id="network-stamp" class="mono-dim"></span></p><div id="network-mount" class="network-grid"></div></section>`,
  },
  {
    id: "methods", route: "/apparatus/methods", group: "apparatus", nav: "Methods & sources",
    title: "Methods & sources",
    html: head({ kicker: "Apparatus · methods",
      title: "How this was built",
      lede: "Geography, vintages, and the reproducible pipeline behind every figure." })
      + `<section class="page-body reveal"><div id="methods-mount" class="methods"></div></section>`,
  },
];
