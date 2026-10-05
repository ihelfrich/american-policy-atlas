import { gapScenario, normalPosterior } from "./analysis.js";
// Module narrative + interactive plots (M1-M8) and methods text.
import katex from "katex";
import { state } from "./data.js";

function tex(s, display = false) {
  try { return katex.renderToString(s, { displayMode: display, throwOnError: false }); }
  catch { return s; }
}
const P = (html) => `<p class="text-[15px] leading-7 text-ink/85">${html}</p>`;

// Suppressed small-county estimates are null in the GeoJSON. `+null` is 0 and
// passes Number.isFinite, which would inject phantom 0% counties into every
// demo below (the diabetes layer alone has ~190). Coerce through this so the
// existing isFinite filters drop them instead of treating them as real zeros.
const num = (x) => (x == null || x === "") ? NaN : +x;

function setProse(id, html) {
  const slot = document.querySelector(`#${id} .prose-slot`);
  if (slot) slot.innerHTML = html;
}

// small seeded PRNG so the resampling demos are stable across reloads (reproducibility)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// pull finite numeric pairs from county props
function pairs(xv, yv) {
  const out = [];
  for (const f of state.counties?.features || []) {
    const x = num(f.properties[xv]), y = num(f.properties[yv]);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

// ordinary least squares, returns {beta,r2,n}; multiple via normal equations
function ols(rows, xs, yk) {
  const X = rows.map((r) => [1, ...xs.map((k) => r[k])]);
  const y = rows.map((r) => r[yk]);
  const n = rows.length, p = xs.length + 1;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const beta = solve(XtX, Xty);
  const yb = y.reduce((s, v) => s + v, 0) / n;
  let ssr = 0, sst = 0;
  for (let i = 0; i < n; i++) {
    const yhat = X[i].reduce((s, v, j) => s + v * beta[j], 0);
    ssr += (y[i] - yhat) ** 2; sst += (y[i] - yb) ** 2;
  }
  return { beta, r2: 1 - ssr / sst, n };
}
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-9;
    for (let j = c; j <= n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r) => r[n]);
}

// ---- M1: reading a map ----
export function renderReadingMap() {
  setProse("m1",
    P(`A choropleth paints each area by a number. The honest trick is that the same numbers can tell different stories depending on where you cut the color breaks. On the atlas page, switch between <b>Quantile</b> (equal counts per color), <b>Equal interval</b> (equal value width), and <b>Jenks</b> (natural breaks that minimize within-class variance). Watch how the income map "spreads" or "concentrates" the country just by changing the rule.`) +
    P(`Quantile guarantees every color is used equally often, which flatters maps of skewed variables like income or density. Equal interval is honest about magnitude but can leave whole classes empty. Jenks is the cartographer's compromise: it finds breaks that group similar counties together. None is "correct" — the point is that classification is an assumption, and a good analyst states it.`));
}

// ---- M2: distributions ----
export function renderDistributions(Plot) {
  setProse("m2",
    P(`Before any model, look at one variable on its own. Here is median household income for all <b>3,144 counties</b>, where available, as a histogram: the horizontal axis is income, the height of each bar is how many counties fall in that slice. A distribution is just the full answer to "how often does each value happen?"`) +
    P(`Two summaries sit on the plot. The <b>median</b> (solid) splits the counties into two equal halves; the <b>mean</b> (dashed) is the balance point. When a distribution has a long right tail — a handful of very rich counties — the mean is dragged toward the tail and lands to the right of the median. That gap between mean and median can signal asymmetry, although it is not itself a formal measure of skewness, and it is why the choice of color breaks on the atlas page mattered so much.`));
  distPlot(Plot);
}

// ---- M3: CEF / binscatter ----
export function renderCEF(Plot) {
  setProse("m3",
    P(`A conditional expectation answers: for counties at a given income, what is the average diabetes rate? Written ${tex("E[Y \\mid X]")}, it is the single most useful object in applied statistics. We approximate it with a <b>binscatter</b>: sort counties by income, chop into bins, and plot the average outcome in each bin.`) +
    P(`The curve below is nonparametric — it lets the data choose its own shape. Regression, next, is just the straight-line summary of this same cloud.`));
  cefPlot(Plot);
}

// ---- M4: regression + control ----
export function renderRegression(Plot) {
  regressionBlock(Plot);
}

// ---- M5: statistical inference ----
export function renderInference(Plot) {
  setProse("m5",
    P(`Coverage varies by measure; the diabetes simulation uses the available county estimates. But the deeper lesson of statistics is about <em>sampling</em>: if you only saw a handful of counties, how sure could you be about the whole country? Treat the available county estimates as a fixed finite population, draw counties independently with replacement, and record each sample mean. This artificial sampling experiment does not propagate the uncertainty in the source estimates.`) +
    P(`The histogram below is the <b>sampling distribution</b> of that mean. Two facts the <b>Central Limit Theorem</b> promises show up immediately: the heap is nearly normal even though the underlying county values are skewed, and its spread is the standard error ${tex("\\sigma/\\sqrt{n}")}, not the population standard deviation. A 95% confidence interval is just one sample's mean plus or minus about two standard errors — and a hypothesis test asks whether an observed gap is larger than that yardstick.`));
  inferencePlot(Plot);
}

// ---- M6: Moran's I ----
export function renderMoran(Plot) {
  setProse("m6",
    P(`Tobler's first law: near things are more related than distant things. <b>Moran's I</b> puts a number on it by correlating each county's value with the average of its neighbors (its "spatial lag"). Positive I means clustering — high next to high, low next to low. Neighbors here are counties that share a border (queen contiguity), built from the full-resolution Census boundary file.`) +
    P(`This statistic is computed for the diabetes estimates themselves, not regression residuals. It does not diagnose residual dependence or quantify the error in an OLS standard error. The graph is rebuilt on counties with available data, so missing states affect the spatial comparison.`));
  moranPlot(Plot);
}

// ---- M7: Bayesian shrinkage ----
export function renderBayes(Plot) {
  setProse("m7", P('How should a noisy measurement be balanced against prior information? This hypothetical normal-normal model lets you change the standard error of an observation. The prior mean is 12%, its standard deviation is 3 percentage points, and the observed estimate is 20%.') + P('The posterior mean is w × observation + (1 − w) × prior mean, with w = prior variance / (prior variance + measurement variance). These are illustrative inputs, not county estimates. County population is not a survey sample size. CDC PLACES already uses multilevel regression and poststratification; re-shrinking its published rates with a binomial variance based on residents would be unjustified.'));
  bayesPlot(Plot);
}

// ---- M8: policy ----
export function renderPolicy(Plot) {
  setProse("m8", P('Group the counties with both poverty and diabetes estimates into five roughly equal groups, ordered by poverty. Each bar is the unweighted average of county diabetes estimates in that group, not the prevalence among all people in the group.') + P('Choose how much of each positive gap above the lowest-poverty group to close. This arithmetic scenario does not specify an intervention or estimate its effect. Results stay in percentage points: converting these adult rates to case counts would require compatible adult denominators and a defensible intervention model.'));
  policyPlot(Plot);
}

function distPlot(Plot) {
  const v = [];
  for (const f of state.counties?.features || []) {
    const x = num(f.properties.median_hh_income);
    if (Number.isFinite(x)) v.push(x);
  }
  if (!v.length) return;
  v.sort((a, b) => a - b);
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const median = v[Math.floor(v.length / 2)];
  const el = document.getElementById("dist-plot");
  if (!el) return;
  el.append(Plot.plot({
    height: 320, marginLeft: 50,
    x: { label: "median household income ($)", grid: true },
    y: { label: "counties", grid: true },
    marks: [
      Plot.rectY(v, Plot.binX({ y: "count" }, { x: (d) => d, fill: "#6d5a8c", fillOpacity: 0.55, thresholds: 44 })),
      Plot.ruleX([median], { stroke: "#0d1b2a", strokeWidth: 2 }),
      Plot.ruleX([mean], { stroke: "#b5482f", strokeWidth: 2, strokeDasharray: "4 3" }),
    ],
  }));
  el.insertAdjacentHTML("beforeend",
    `<p class="text-sm mt-2 text-ink/80">Median = <b>$${Math.round(median).toLocaleString()}</b> (solid), mean = <b>$${Math.round(mean).toLocaleString()}</b> (dashed). The mean sits to the right of the median: a right-skewed distribution, dragged by a long tail of high-income counties.</p>`);
}

function cefPlot(Plot) {
  const d = pairs("median_hh_income", "diabetes_pct").filter((r) => r.x > 0 && r.x < 250000);
  if (!d.length) return;
  d.sort((a, b) => a.x - b.x);
  const k = 24, bins = [];
  for (let i = 0; i < k; i++) {
    const seg = d.slice(Math.floor(i / k * d.length), Math.floor((i + 1) / k * d.length));
    if (!seg.length) continue;
    bins.push({ x: seg.reduce((s, r) => s + r.x, 0) / seg.length,
                y: seg.reduce((s, r) => s + r.y, 0) / seg.length });
  }
  const cefEl = document.getElementById("cef-plot");
  if (!cefEl) return;
  cefEl.append(Plot.plot({
    height: 320, marginLeft: 50,
    x: { label: "median household income ($)", grid: true },
    y: { label: "diabetes prevalence (%)", grid: true },
    marks: [
      Plot.dot(d.filter((_, i) => i % 6 === 0), { x: "x", y: "y", r: 1, fill: "#5b6470", fillOpacity: 0.18 }),
      Plot.line(bins, { x: "x", y: "y", stroke: "#b5482f", strokeWidth: 2.5 }),
      Plot.dot(bins, { x: "x", y: "y", fill: "#b5482f", r: 3 }),
    ],
  }));
}

function regressionBlock(Plot) {
  const dp = [];
  for (const f of state.counties?.features || []) {
    const p = f.properties;
    const inc = num(p.median_hh_income), y = num(p.diabetes_pct), pov = num(p.pct_poverty);
    if ([inc, y, pov].every(Number.isFinite)) dp.push({ inc: inc / 10000, diabetes_pct: y, pct_poverty: pov });
  }
  let txt = P(`Fit a straight line: ${tex("\\text{diabetes} = \\beta_0 + \\beta_1\\,\\text{income}")}. The slope ${tex("\\beta_1")} is the change in diabetes prevalence for each additional $10,000 of county median income. Then add present-day poverty as a control and watch the income coefficient shrink — income and poverty carry much of the same information.`);
  if (dp.length > 30) {
    const simple = ols(dp, ["inc"], "diabetes_pct");
    const multi = ols(dp, ["inc", "pct_poverty"], "diabetes_pct");
    const b1 = simple.beta[1], b1c = multi.beta[1];
    const shrink = Math.round((1 - b1c / b1) * 100);
    txt += `<div class="mt-3 grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-lg border border-ink/15 p-3"><div class="text-xs uppercase text-dim">income alone</div>
        <div>slope = <b>${b1.toFixed(2)}</b> pts / $10k</div><div>R² = ${simple.r2.toFixed(3)}</div></div>
      <div class="rounded-lg border border-ink/15 p-3"><div class="text-xs uppercase text-dim">+ poverty control</div>
        <div>slope = <b>${b1c.toFixed(2)}</b> pts / $10k</div><div>R² = ${multi.r2.toFixed(3)}</div></div></div>`;
    txt += P(`Adding poverty shrinks the income slope by about <b>${shrink}%</b> but does not erase it. This is a change in a conditional association, not evidence that poverty mediates a causal income effect. The comparison uses the same complete-case counties. PLACES outcomes are modeled estimates whose predictors include socioeconomic information; that construction can contribute to the observed association.`);
    const xmin = Math.min(...dp.map((d) => d.inc)), xmax = Math.max(...dp.map((d) => d.inc));
    const line = [xmin, xmax].map((x) => ({ x, y: simple.beta[0] + simple.beta[1] * x }));
    const regEl = document.getElementById("reg-plot");
    if (regEl) regEl.append(Plot.plot({
      height: 300, marginLeft: 50,
      x: { label: "median household income ($10k)", grid: true },
      y: { label: "diabetes prevalence (%)", grid: true },
      marks: [
        Plot.dot(dp.filter((_, i) => i % 3 === 0), { x: "inc", y: "diabetes_pct", r: 1.4, fill: "#5b6470", fillOpacity: 0.12 }),
        Plot.line(line, { x: "x", y: "y", stroke: "#0d1b2a", strokeWidth: 2 }),
      ],
    }));
  }
  setProse("m4", txt);
}

function inferencePlot(Plot) {
  const pop = [];
  for (const f of state.counties?.features || []) {
    const x = num(f.properties.diabetes_pct);
    if (Number.isFinite(x)) pop.push(x);
  }
  const el = document.getElementById("inference-plot");
  if (!el) return;
  if (pop.length < 100) { el.innerHTML = `<p class="text-sm text-ink/60">Inference demo needs the national county layer.</p>`; return; }
  const N = pop.length;
  const mu = pop.reduce((s, x) => s + x, 0) / N;
  const sigma = Math.sqrt(pop.reduce((s, x) => s + (x - mu) ** 2, 0) / N);
  const n = 40, B = 2000, rand = mulberry32(42);
  const means = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += pop[Math.floor(rand() * N)];
    means.push(s / n);
  }
  const seTheory = sigma / Math.sqrt(n);
  // one illustrative 95% CI from a single fresh sample
  let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const v = pop[Math.floor(rand() * N)]; s += v; s2 += v * v; }
  const xbar = s / n, sd = Math.sqrt((s2 - n * xbar * xbar) / (n - 1)), se = sd / Math.sqrt(n);
  const lo = xbar - 1.96 * se, hi = xbar + 1.96 * se, covers = mu >= lo && mu <= hi;

  el.append(Plot.plot({
    height: 300, marginLeft: 50,
    x: { label: `mean diabetes % in a random sample of ${n} counties`, grid: true },
    y: { label: "frequency", grid: true },
    marks: [
      Plot.rectY(means, Plot.binX({ y: "count" }, { x: (d) => d, fill: "#6d5a8c", fillOpacity: 0.5, thresholds: 36 })),
      Plot.ruleX([mu], { stroke: "#0d1b2a", strokeWidth: 2 }),
      Plot.ruleX([mu - 1.96 * seTheory, mu + 1.96 * seTheory], { stroke: "#b5482f", strokeDasharray: "4 3" }),
    ],
  }));
  el.insertAdjacentHTML("beforeend",
    `<p class="text-sm mt-2 text-ink/80">Mean of available county estimates μ = <b>${mu.toFixed(2)}%</b> (solid). Across ${B.toLocaleString()} resamples the sample mean piles up in a near-normal heap of theoretical width σ/√n = <b>${seTheory.toFixed(2)}</b> (dashed = 95% band). One fresh sample gave a 95% CI of [${lo.toFixed(2)}, ${hi.toFixed(2)}], which ${covers ? "does" : "does <b>not</b>"} contain μ.</p>`);

  // two-sample test: Census South region vs the rest
  const SOUTH = new Set(["10", "11", "12", "13", "24", "37", "45", "51", "54", "01", "21", "28", "47", "05", "22", "40", "48"]);
  const south = [], rest = [];
  for (const f of state.counties?.features || []) {
    const x = num(f.properties.diabetes_pct); if (!Number.isFinite(x)) continue;
    const fips = String(f.properties.GEOID).padStart(5, "0").slice(0, 2);
    (SOUTH.has(fips) ? south : rest).push(x);
  }
  const m = (a) => a.reduce((p, v) => p + v, 0) / a.length;
  const vv = (a, mn) => a.reduce((p, v) => p + (v - mn) ** 2, 0) / (a.length - 1);
  const mS = m(south), mR = m(rest);
  const seD = Math.sqrt(vv(south, mS) / south.length + vv(rest, mR) / rest.length);
  const tstat = (mS - mR) / seD;
  el.insertAdjacentHTML("beforeend",
    `<p class="text-sm mt-2 text-ink/80"><b>Hypothesis test.</b> Southern counties (n = ${south.length}) average ${mS.toFixed(2)}% diabetes versus ${mR.toFixed(2)}% elsewhere (n = ${rest.length}). The difference of ${(mS - mR).toFixed(2)} points has a Welch t-statistic of <b>${tstat.toFixed(1)}</b> under an independence assumption. This is a demonstration of the Welch formula, not a calibrated significance claim: spatial dependence, modeled outcomes, missing states, and the absence of a sampling design limit this interpretation.</p>`);
}

function moranPlot(Plot) {
  const m = state.summary?.moran;
  const el = document.getElementById("moran-plot");
  if (!el) return;
  if (m && m.scatter?.length) {
    el.append(Plot.plot({
      height: 300, marginLeft: 50,
      x: { label: "county value (z)", grid: true }, y: { label: "neighbor mean (z)", grid: true },
      marks: [
        Plot.dot(m.scatter, { x: "z", y: "lag", r: 1.6, fill: "#6d5a8c", fillOpacity: 0.3 }),
        Plot.linearRegressionY(m.scatter, { x: "z", y: "lag", stroke: "#b5482f", ci: 0 }),
        Plot.ruleX([0]), Plot.ruleY([0]),
      ],
    }));
    el.insertAdjacentHTML("beforeend",
      `<p class="text-sm mt-2 text-ink/80">Moran's I = <b>${m.I?.toFixed(3)}</b> (permutation p ${"= " + m.perm_p}) across ${m.n?.toLocaleString()} contiguous counties, mean ${m.mean_neighbors} neighbors each. Strong positive spatial autocorrelation: diabetes clusters.</p>`);
  } else {
    el.innerHTML = `<p class="text-sm text-ink/60">Spatial-lag scatter is precomputed by the build pipeline (script 12).</p>`;
  }
}

function bayesPlot(Plot) {
  const el = document.getElementById('bayes-plot'); if (!el) return;
  el.innerHTML = '<div class="scenario-controls"><label for="bayes-se">Measurement standard error (percentage points)</label><input id="bayes-se" type="range" min="0.5" max="12" step="0.5" value="4"><output id="bayes-value" for="bayes-se"></output></div><div id="bayes-chart"></div><p id="bayes-caption"></p>';
  const update=()=>{
    const se=Number(el.querySelector('#bayes-se').value), result=normalPosterior(20,se,12,3);
    el.querySelector('#bayes-value').textContent=se.toFixed(1);
    const data=[{label:'Prior mean',value:12},{label:'Observed estimate',value:20},{label:'Posterior mean',value:result.mean}];
    el.querySelector('#bayes-chart').replaceChildren(Plot.plot({height:220,marginLeft:125,x:{label:'Illustrative rate (%)',domain:[0,25],grid:true},y:{label:null,domain:data.map(d=>d.label)},marks:[Plot.dot(data,{x:'value',y:'label',r:7,fill:'#397e70'}),Plot.text(data,{x:'value',y:'label',text:d=>d.value.toFixed(1)+'%',dx:26})]}));
    el.querySelector('#bayes-caption').textContent='The observation receives '+(result.weight*100).toFixed(1)+'% of the weight. Larger measurement uncertainty moves the posterior toward the stated prior. This is a teaching simulation with known assumptions, not a CDC estimator.';
  };
  el.querySelector('#bayes-se').oninput=update;update();
}

function policyPlot(Plot) {
  const el=document.getElementById('policy-plot');if(!el)return;
  const rows=(state.counties?.features||[]).map(f=>f.properties);
  el.innerHTML='<div class="scenario-controls"><label for="policy-gap">Assumed share of positive gap closed</label><input id="policy-gap" type="range" min="0" max="100" step="5" value="50"><output id="policy-value" for="policy-gap"></output></div><div id="policy-chart"></div><p id="policy-caption"></p>';
  const update=()=>{
    const share=Number(el.querySelector('#policy-gap').value)/100, bins=gapScenario(rows,share);
    el.querySelector('#policy-value').textContent=Math.round(share*100)+'%';
    if(!bins.length){el.querySelector('#policy-caption').textContent='Not enough complete county records.';return;}
    el.querySelector('#policy-chart').replaceChildren(Plot.plot({height:320,marginLeft:65,x:{label:'Poverty group (Q1 lowest)',domain:bins.map(d=>d.group)},y:{label:'Mean of county diabetes estimates (%)',grid:true},marks:[Plot.link(bins,{x1:'group',x2:'group',y1:'observed',y2:'scenario',stroke:'#aab9ae',strokeWidth:4}),Plot.dot(bins,{x:'group',y:'observed',fill:'#c66b25',r:6}),Plot.dot(bins,{x:'group',y:'scenario',fill:'#18564c',r:4})]}));
    el.querySelector('#policy-caption').textContent='Orange: observed group mean. Green: assumed scenario. '+bins.reduce((n,b)=>n+b.n,0).toLocaleString()+' complete counties; equal county weights. Ties in poverty are ordered by GEOID. The baseline is the lowest-poverty group, not necessarily the healthiest. No effects or avoided cases are estimated.';
  };el.querySelector('#policy-gap').oninput=update;update();
}

export function renderMethods() {
  const el = document.getElementById("methods-mount");
  if (!el) return;
  el.innerHTML = `
    <p><b>Geography.</b> All 3,144 county and county-equivalent units of the 50 states and DC (Census TIGER 2023). The web map carries simplified boundaries; spatial contiguity is built from the full-resolution shapefile.</p>
    <p><b>ACS 2018–2022</b> five-year estimates: median household income, poverty, education, race and ethnicity, unemployment, tenure and rent burden, health insurance. Percentages derived against their correct universes.</p>
    <p><b>CDC PLACES.</b> The pipeline identifies its input as the 2025 county release, crude adult prevalence. Release year is not measurement year. <a href="https://www.cdc.gov/places/methodology/index.html">CDC uses multilevel regression and poststratification</a>, including socioeconomic predictors, so associations with those predictors are not wholly independent evidence.</p><p><b>Coverage.</b> This snapshot has diabetes estimates for 2,956 of 3,144 county units. All 120 Kentucky and 67 Pennsylvania counties, plus one Texas county, are missing health values. Their absence is not evidence of zero disease; the extraction does not establish the reason for every omission.</p><p><b>Uncertainty and timing.</b> ACS margins of error and PLACES intervals are not shipped. Comparisons are descriptive point estimates from different observation periods. Equal county averages are not population prevalence estimates. These files are snapshots, not live feeds.</p>
    <p><b>Population</b> from the ACS county totals, used for density. It is not a sample size or an adult health denominator.</p>
    <p><b>Spatial dependence.</b> Moran's I under queen contiguity (counties sharing any boundary point are neighbors), row-standardized weights, significance from a 999-draw permutation null. Contiguity is computed on the unsimplified TIGER geometry, excluding Alaska and Hawaii by the pipeline’s regional scope choice, and dropping remaining zero-neighbor units. This does not mean all counties in those states lack neighbors.</p>
    <p><b>Inference demos</b> resample the county values with a fixed seed, so every figure is reproducible. The South/non-South contrast uses the Census definition of the South region but is descriptive; a naive independent-county test does not account for spatial dependence or modeled outcome uncertainty.</p>
    <p><b>Empirical Bayes.</b> The interactive is a hypothetical normal-normal model with user-controlled measurement error and a fixed prior. It does not use resident population as sample size and does not re-estimate PLACES.</p>
    <p class="text-ink/60">All computation is reproducible from the <code>scripts/</code> pipeline (11 national county assembly → 12 spatial dependence). California tracts and the redlining case study retain their own tract-level pipeline.</p>`;
}

// =====================================================================
// MOVEMENT III — geosocioeconometrics. These pages are framework-first:
// the math is the specification the interactive viewers (in development)
// will implement. Each fills its own prose slot.
// =====================================================================
function setSlot(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function renderGradientField() {
  setSlot("iii-grad-prose",
    P(`Movements I and II asked questions about counties: how is income distributed, do nearby counties resemble each other. Movement III changes the noun. Treat a variable as a continuous surface ${tex("Z(s)")} over the plane ${tex("s = (x, y)")}, interpolated from the county centroids. A surface has a slope at every point, and that slope carries more information than the level does.`) +
    P(`The <b>gradient</b> ${tex("\\nabla Z(s) = \\left(\\partial Z/\\partial x,\\ \\partial Z/\\partial y\\right)")} points in the direction the variable rises fastest; its magnitude ${tex("\\lVert \\nabla Z \\rVert")} is the rate of that rise. A sharp income cliff between two adjacent neighborhoods is a place where ${tex("\\lVert \\nabla Z \\rVert")} is large. Mapping the gradient turns "where are the boundaries in the data" from an eyeball judgment into a field you can compute.`) +
    `<div class="tex-block">${tex("\\nabla Z(s) = \\Big(\\tfrac{\\partial Z}{\\partial x},\\ \\tfrac{\\partial Z}{\\partial y}\\Big), \\qquad T_\\sigma(s) = G_\\sigma * \\big(\\nabla Z\\,\\nabla Z^{\\top}\\big)", true)}</div>` +
    P(`A single gradient vector cannot tell a clean border from a noisy speckle. The <b>structure tensor</b> ${tex("T_\\sigma = G_\\sigma * (\\nabla Z\\,\\nabla Z^{\\top})")} — the outer product of the gradient, smoothed over a neighborhood by a Gaussian ${tex("G_\\sigma")} — can. Its two eigenvalues ${tex("\\lambda_1 \\ge \\lambda_2")} read the local geometry: ${tex("\\lambda_1 \\gg \\lambda_2")} is a <em>frontier</em> (change along one direction, an edge), ${tex("\\lambda_1 \\approx \\lambda_2")} both large is a <em>pocket</em> (an isolated high or low), and both small is flat interior. This is the borrowed-from-image-processing core of the geosocioeconometric program: the country has edges and corners, and they are measurable.`));
}

export function renderOptimalTransport() {
  setSlot("iii-ot-prose",
    P(`Put two maps side by side: where poverty is, and where the clinics are. As probability distributions over the same space, call them ${tex("\\mu")} and ${tex("\\nu")}. <b>Optimal transport</b> asks the cheapest way to rearrange one pile of mass into the other. The minimal total cost, with squared-distance as the price of moving mass, is the squared 2-Wasserstein distance.`) +
    `<div class="tex-block">${tex("W_2^2(\\mu,\\nu) = \\inf_{\\pi \\in \\Pi(\\mu,\\nu)} \\int_{\\mathbb{R}^2 \\times \\mathbb{R}^2} \\lVert x - y \\rVert^2 \\, d\\pi(x,y)", true)}</div>` +
    P(`Unlike a correlation, ${tex("W_2")} is a genuine distance between spatial distributions: it knows that mismatch nearby is cheap and mismatch across the country is dear. The <b>Benamou–Brenier</b> reformulation rewrites that static problem as a flow — a density ${tex("\\rho_t")} and a velocity field ${tex("v_t")} obeying the continuity equation ${tex("\\partial_t \\rho + \\nabla\\!\\cdot(\\rho v) = 0")} — minimizing total kinetic energy ${tex("\\int_0^1 \\!\\int \\rho_t \\lVert v_t \\rVert^2")}.`) +
    P(`That velocity field is what I mean by <b>distributional flux</b>: not a single number but a map of arrows showing the direction and intensity of the redistribution one map would need to match another. It is the difference between knowing two geographies disagree and knowing exactly how mass would have to move to reconcile them — which is the quantity a place-based policy is actually trying to buy.`));
}

export function renderNetworks() {
  setSlot("iii-net-prose",
    P(`Make the country a graph: counties are nodes, a shared border is an edge, the weighted adjacency matrix is ${tex("W")}. With the degree matrix ${tex("D")}, the <b>graph Laplacian</b> ${tex("L = D - W")} is the discrete analogue of the ${tex("-\\nabla^2")} operator — it measures how much each county departs from the average of its neighbors. Almost everything in the first two movements is secretly a statement about ${tex("L")}.`) +
    `<div class="tex-block">${tex("L = D - W, \\qquad \\frac{\\partial u}{\\partial t} = -L\\,u, \\qquad u(t) = e^{-tL} u_0", true)}</div>` +
    P(`Run a shock through that network and it spreads by <b>diffusion</b>: the heat kernel ${tex("e^{-tL}")} is the exact solution, and at small ${tex("t")} it reaches only immediate neighbors while at large ${tex("t")} it equilibrates across the whole graph. <b>Effective distance</b> (Brockmann and Helbing's idea, ${tex("d_{\\text{eff}} = 1 - \\log p")} along the most probable path) then replaces raw mileage with how readily something actually reaches you through the network.`) +
    P(`This is the unification the program is built toward. Moran's I is a quadratic form in ${tex("W")}; the spatial-autoregressive model is ${tex("(I - \\rho W)^{-1}")}; kriging is a covariance built on graph distance. Autocorrelation, the spatial models of Movement II, and the field geometry of the gradient pages are all readings of the same operator. Centrality on this graph then ranks counties not by what they contain but by where they sit in the flow.`));
}

export function renderTopology() {
  setSlot("iii-topo-prose",
    P(`Moran's I answers one question — is there clustering, yes or no — and answers it with a single number for the whole country. But "how many distinct high-poverty regions are there, and which are robust?" is a different question, and choosing one threshold to count them is exactly the arbitrary cut Movement I warned about.`) +
    P(`<b>Persistent homology</b> removes the choice. Lower a waterline ${tex("\\tau")} down through the surface ${tex("Z(s)")} and watch the superlevel sets ${tex("\\{ s : Z(s) \\ge \\tau \\}")}. As ${tex("\\tau")} falls, islands of high value are <em>born</em>, grow, and eventually <em>merge</em>. Record the threshold at which each feature appears and the threshold at which it dies into a larger one.`) +
    `<div class="tex-block">${tex("\\{ s : Z(s) \\ge \\tau \\}, \\qquad \\text{persistence} = \\lvert \\tau_{\\text{birth}} - \\tau_{\\text{death}} \\rvert", true)}</div>` +
    P(`Plot every feature as a (birth, death) point: that is the <b>persistence diagram</b>. Features far from the diagonal lived across a wide band of thresholds — they are real structure. Features hugging the diagonal flickered in and out — they are noise. ${tex("H_0")} counts connected components (the clusters), ${tex("H_1")} counts loops (a ring of high values enclosing a low). It is a principled, threshold-free census of the shape of the country, and it is where the field-first program lands.`));
}
