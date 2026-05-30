// The curriculum manifest. Each entry is one routed page: its content markup
// lives here (pure strings, no behavior); main.js attaches the mount function
// by id and wires prev/next from the `seq` order.
//
// The spine teaches statistics from scratch, in the order a serious department
// would teach it, on live national data. Three semesters of classical work come
// first and stand on their own; the spatial turn and the original research
// program (geosocioeconometrics) are held back until the foundations are real.
//
//   Semester I   — Probability & Inference    : data → distributions → the sampling distribution
//   Semester II  — Linear Models              : regression, GLMs, regularization, resampling
//   Semester III — Econometrics               : the causal question, panels, time, modern ML
//   Spatial      — When independence breaks    : Tobler, Moran, the redlining gradient
//   Geosocioeconometrics — Geometry of the field (Helfrich): gradients, transport, networks, topology
//
// County data is the running example throughout; geography is used to make a
// point, not as the subject, until the Spatial group.

import katex from "katex";

// Math baked at module load (no client-side auto-render needed for static pages).
const mi = (s) => { try { return katex.renderToString(s, { throwOnError: false, displayMode: false }); } catch { return s; } };
const md = (s) => { try { return katex.renderToString(s, { throwOnError: false, displayMode: true }); } catch { return s; } };

export const GROUPS = [
  { id: "front", label: "" },
  { id: "s1", label: "Semester I · Probability & Inference", sub: "From data to the sampling distribution" },
  { id: "s2", label: "Semester II · Linear Models", sub: "Regression, GLMs, regularization" },
  { id: "s3", label: "Semester III · Econometrics", sub: "The causal question, panels, time" },
  { id: "spatial", label: "Spatial statistics", sub: "When independence breaks" },
  { id: "geo", label: "Geosocioeconometrics", sub: "Geometry of the field (Helfrich)" },
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

// A standard *interactive* teaching module: prose slot (filled by prose.js) + a plot div.
const moduleBody = (proseId, plotId) => `
  <section id="${proseId}" class="page-body reveal">
    <div class="prose-slot"></div>
    ${plotId ? `<div id="${plotId}" class="plot"></div>` : ""}
  </section>`;

// A *scaffold* lesson: objectives panel + static prose + a placeholder for the
// interactive that will land here. Static prose means no prose.js renderer is
// needed yet; the page reads as a complete chapter from day one.
const lesson = ({ objectives, body, build, plotId }) => `
  <section class="page-body reveal">
    ${objectives && objectives.length
      ? `<aside class="objectives"><span class="obj-label">What you'll be able to do</span><ul>${objectives.map((o) => `<li>${o}</li>`).join("")}</ul></aside>`
      : ""}
    <div class="lesson-prose">${body}</div>
    ${plotId ? `<div id="${plotId}" class="plot"></div>` : ""}
    ${build ? `<div class="dev-note">${build}</div>` : ""}
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
          <p class="hero-lede reveal">A working atlas of the United States, built to <em>teach</em>. It runs three full semesters of statistics and econometrics from scratch — probability, distributions, regression, causal inference — on live national data, before it ever leans on geography. Then it breaks the assumption that counties are independent draws, and ends in a research program of my own: geosocioeconometrics.</p>
          <div class="hero-actions reveal">
            <a href="#/s1/data" class="btn btn-solid">Start the curriculum</a>
            <a href="#/atlas" class="btn btn-ghost">Open the atlas</a>
          </div>
        </div>
      </section>

      <section class="toc reveal">
        <div class="toc-intro">
          <span class="kicker">How to read this atlas</span>
          <h2 class="toc-title">Three semesters, then the field.</h2>
          <p class="toc-sub">The core is a full statistics and econometrics sequence — the same arc a department would teach, on every county in the country. Geography stays in the background as an example until the foundations are solid. Only then does the map become the object of study, and only then the original methods.</p>
        </div>
        <div class="toc-grid">
          <a class="toc-card toc-i" href="#/s1/data">
            <span class="toc-num">I–III</span>
            <h3>The statistics core</h3>
            <p>Three semesters from the ground up: probability and inference, the linear model and its modern cousins, then econometrics and causal inference. Twenty-eight chapters, every one on live national data.</p>
            <span class="toc-go">Begin Semester I →</span>
          </a>
          <a class="toc-card toc-ii" href="#/spatial/dependence">
            <span class="toc-num">IV</span>
            <h3>Spatial statistics</h3>
            <p>The classical chapters assumed counties were independent. They are not. Tobler's law made quantitative: Moran's I, the map as data, and the redlining line of 1939 still legible in today's health gradient.</p>
            <span class="toc-go">When independence breaks →</span>
          </a>
          <a class="toc-card toc-iii" href="#/geo/gradient-fields">
            <span class="toc-num">V</span>
            <h3>Geosocioeconometrics</h3>
            <p>The original program. Gradient and structure-tensor fields, optimal transport as distributional flux, networks and diffusion, and the topology of the socioeconomic surface.</p>
            <span class="toc-go">Geometry of the field →</span>
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
          <p class="rail-sub">Each preset sets a variable, a classification rule, and a region. Everything in the curriculum is built from this same national data — change the number here and the lessons downstream change with it.</p>
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

  // =====================================================================
  // SEMESTER I — PROBABILITY & INFERENCE
  // =====================================================================
  {
    id: "reading-a-map", route: "/s1/data", group: "s1", nav: "Meet the data", seq: 1,
    title: "The data, and how to read it",
    html: head({ kicker: "Semester I · 01 · The running example",
      title: "Meet the dataset",
      lede: "Every idea in this course is shown on one body of data: every county in the United States. Before any statistic, a decision — where do the color breaks go? It is the first place an analyst's assumptions become visible." })
      + moduleBody("m1", null) + chapterNav,
  },
  {
    id: "probability", route: "/s1/probability", group: "s1", nav: "Probability", seq: 2,
    title: "Probability from first principles",
    html: head({ kicker: "Semester I · 02 · Probability",
      title: "The rules of the game",
      lede: "Pick a county at random. The machinery that says how likely anything about it is — that is probability, and it rests on three short axioms." })
      + lesson({
        objectives: [
          "Set up a sample space and events for a concrete experiment",
          `Apply the Kolmogorov axioms and derive the basic rules`,
          `Compute conditional probabilities and recognize independence`,
          `Invert a conditional with Bayes' rule`,
        ],
        body: `
          <p>Draw one county at random. The sample space ${mi("\\Omega")} is the set of all 3,144 counties; an <em>event</em> is any subset of them — say, "adult diabetes above 12%." A probability is a function on events obeying three rules: it is never negative, the whole space has probability one, and the probability of a union of disjoint events is the sum of their probabilities. Everything else follows, including the complement rule ${mi("P(A^c)=1-P(A)")} and inclusion–exclusion.</p>
          <p>Conditioning rescales the world. ${md("P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}")} restricts attention to the counties where ${mi("B")} holds and re-normalizes. Two events are independent when ${mi("P(A\\cap B)=P(A)\\,P(B)")}, which is a statement about information, not about causation. And when you want to run a conditional backwards — given a county is high-poverty, how likely is it rural? — Bayes' rule does the inversion: ${md("P(A\\mid B)=\\frac{P(B\\mid A)\\,P(A)}{P(B)}.")} That single line is the engine of the Bayesian chapter at the end of this semester.</p>`,
        build: "Interactive in development: draw counties one at a time and watch empirical event frequencies converge to their probabilities, plus a 2×2 contingency explorer that makes Bayes' rule concrete.",
      }) + chapterNav,
  },
  {
    id: "random-variables", route: "/s1/random-variables", group: "s1", nav: "Random variables", seq: 3,
    title: "Random variables & expectation",
    html: head({ kicker: "Semester I · 03 · Random variables",
      title: "Turning outcomes into numbers",
      lede: "A random variable is just a number attached to each outcome. Its distribution, its mean, and its spread are the three things you will reach for again and again." })
      + lesson({
        objectives: [
          "Distinguish discrete and continuous random variables and read a pmf, pdf, and cdf",
          `Compute expectation and variance as sums and integrals`,
          `Use linearity of expectation and the variance scaling rule`,
          `Read off moments and recognize the moment generating function`,
        ],
        body: `
          <p>The median income of a randomly drawn county is a random variable: a rule that turns each outcome into a number. Its behavior is summarized by a probability mass function ${mi("p(x)")} when the values are discrete, a density ${mi("f(x)")} when they are continuous, and in both cases by the cumulative distribution function ${mi("F(x)=P(X\\le x)")}, which never decreases and runs from 0 to 1.</p>
          <p>Two summaries carry most of the weight. The expectation is the long-run average, ${md("\\mathbb{E}[X]=\\sum_x x\\,p(x)\\quad\\text{or}\\quad \\int x\\,f(x)\\,dx,")} and the variance measures spread around it, ${mi("\\mathrm{Var}(X)=\\mathbb{E}[(X-\\mu)^2]")}. Expectation is linear no matter what — ${mi("\\mathbb{E}[aX+b]=a\\,\\mathbb{E}[X]+b")} — while variance scales by the square, ${mi("\\mathrm{Var}(aX+b)=a^2\\,\\mathrm{Var}(X)")}. Higher moments and the moment generating function ${mi("M(t)=\\mathbb{E}[e^{tX}]")} package the entire distribution into one object, which is what makes the central limit theorem provable later.</p>`,
        build: "Interactive in development: a pmf / pdf / cdf trio that recomputes the mean and variance live as you reweight the distribution.",
      }) + chapterNav,
  },
  {
    id: "distributions", route: "/s1/distributions", group: "s1", nav: "Distributions", seq: 4,
    title: "A field guide to distributions",
    html: head({ kicker: "Semester I · 04 · Distributions",
      title: "One variable, 3,144 counties",
      lede: "A distribution is the full answer to a simple question: how often does each value happen? Here is the shape of a real one, and the named families it tends to resemble." })
      + moduleBody("m2", "dist-plot") + chapterNav,
  },
  {
    id: "joint-distributions", route: "/s1/joint", group: "s1", nav: "Joint & dependence", seq: 5,
    title: "Joint distributions & dependence",
    html: head({ kicker: "Semester I · 05 · Two variables at once",
      title: "When one number depends on another",
      lede: "Income and diabetes do not vary independently across counties. The joint distribution holds both at once, and from it come covariance, correlation, and the regression function." })
      + lesson({
        objectives: [
          "Move between joint, marginal, and conditional distributions",
          `Compute covariance and correlation and state what each measures`,
          `Explain why independence implies zero correlation but not the reverse`,
          `Define the conditional expectation function and see why it is the target of regression`,
        ],
        body: `
          <p>Two variables live in a joint distribution ${mi("f(x,y)")}. Sum or integrate out one variable and you recover a <em>marginal</em>; fix one variable and re-normalize and you get a <em>conditional</em> ${mi("f(y\\mid x)")}. Co-movement is measured by covariance, ${md("\\mathrm{Cov}(X,Y)=\\mathbb{E}\\big[(X-\\mu_X)(Y-\\mu_Y)\\big],")} and correlation ${mi("\\rho")} rescales it to the interval ${mi("[-1,1]")} so different pairs can be compared.</p>
          <p>Independence implies zero correlation, but the converse fails: a tidy ${mi("\\rho=0")} can hide a strong nonlinear relationship. The object that does not hide it is the conditional expectation ${mi("\\mathbb{E}[Y\\mid X=x]")}, the average of ${mi("Y")} among counties at each value of ${mi("X")}. Traced across ${mi("x")} it becomes the regression function — the single most useful curve in applied statistics, and the subject of the next chapter.</p>`,
        build: "Interactive in development: a 2-D density with marginal histograms in the margins and a slider that tunes the correlation while you watch the cloud rotate.",
      }) + chapterNav,
  },
  {
    id: "conditional-expectations", route: "/s1/conditional-expectations", group: "s1", nav: "E[Y | X]", seq: 6,
    title: "Conditional expectations",
    html: head({ kicker: "Semester I · 06 · Conditional expectations",
      title: "E[Y | X], the most useful object in statistics",
      lede: "For counties at a given income, what is the average diabetes rate? Answering that, value by value, is most of applied statistics." })
      + moduleBody("m3", "cef-plot") + chapterNav,
  },
  {
    id: "inference", route: "/s1/sampling", group: "s1", nav: "Sampling & the CLT", seq: 7,
    title: "Sampling distributions & the CLT",
    html: head({ kicker: "Semester I · 07 · Sampling distributions",
      title: "From one sample to a sampling distribution",
      lede: "If you only saw a handful of counties, how sure could you be about the whole country? The law of large numbers and the central limit theorem, shown rather than asserted." })
      + moduleBody("m5", "inference-plot") + chapterNav,
  },
  {
    id: "estimation", route: "/s1/estimation", group: "s1", nav: "Estimation", seq: 8,
    title: "Estimation: method of moments to MLE",
    html: head({ kicker: "Semester I · 08 · Estimation",
      title: "Guessing a parameter, and judging the guess",
      lede: "An estimator is a recipe that turns a sample into a number. Two recipes dominate, and three criteria decide whether either is any good." })
      + lesson({
        objectives: [
          "Distinguish an estimator from the estimand it targets",
          `Derive estimators by the method of moments and by maximum likelihood`,
          `Decompose error into bias and variance and combine them as mean squared error`,
          `State consistency, efficiency, and the Cramér–Rao lower bound`,
        ],
        body: `
          <p>The method of moments is the blunt instrument: set sample moments equal to their theoretical counterparts and solve. Maximum likelihood is the sharp one: choose the parameter that makes the data you actually observed most probable, maximizing ${md("\\ell(\\theta)=\\sum_{i} \\log f(x_i;\\theta).")} For many models the two agree; where they part, the likelihood estimator usually wins on efficiency.</p>
          <p>We judge an estimator ${mi("\\hat\\theta")} by three things. Bias is ${mi("\\mathbb{E}[\\hat\\theta]-\\theta")}; variance is its spread across samples; and mean squared error combines them, ${md("\\mathrm{MSE}(\\hat\\theta)=\\mathrm{Bias}(\\hat\\theta)^2+\\mathrm{Var}(\\hat\\theta).")} A <em>consistent</em> estimator collapses onto the truth as the sample grows. The Cramér–Rao bound sets a hard floor on how small the variance of any unbiased estimator can be, which is the standard against which efficiency is measured.</p>`,
        build: "Interactive in development: a likelihood surface you can climb by hand, beside a bias–variance dartboard that shows the two error sources trading off.",
      }) + chapterNav,
  },
  {
    id: "confidence-intervals", route: "/s1/confidence-intervals", group: "s1", nav: "Confidence intervals", seq: 9,
    title: "Confidence intervals",
    html: head({ kicker: "Semester I · 09 · Interval estimation",
      title: "A range, and what it does and doesn't mean",
      lede: "\"95% confident\" is a statement about the procedure, not about the one interval in front of you. Getting that straight is half the battle." })
      + lesson({
        objectives: [
          "Build a confidence interval from a pivot and a standard error",
          `Construct the t-interval for a mean`,
          `State the difference between coverage and a probability about one interval`,
          `Form a bootstrap interval when no formula is available`,
        ],
        body: `
          <p>A confidence interval is a procedure with a track record. Build it the same way on many samples and 95% of the intervals will cover the truth — that is what "95% confidence" means. It does <em>not</em> mean this particular interval has a 95% chance of containing the parameter; the parameter is fixed, the interval is what varies. For a mean the workhorse is ${md("\\bar x \\pm t^{*}\\,\\frac{s}{\\sqrt{n}},")} where ${mi("t^{*}")} comes from Student's distribution and ${mi("s/\\sqrt n")} is the standard error.</p>
          <p>When the sampling distribution is unknown or ugly, resample the data itself: draw with replacement, recompute the statistic thousands of times, and read the interval off the percentiles of that bootstrap distribution. We will build the interval for mean county diabetes both ways and check, by simulation, that it covers as advertised.</p>`,
        build: "Interactive in development: a repeated-sampling animation that tallies coverage as intervals stack up, with a toggle between the t-interval and the bootstrap percentile interval.",
      }) + chapterNav,
  },
  {
    id: "hypothesis-testing", route: "/s1/hypothesis-testing", group: "s1", nav: "Hypothesis testing", seq: 10,
    title: "Hypothesis tests, p-values & power",
    html: head({ kicker: "Semester I · 10 · Testing",
      title: "Is the data surprising?",
      lede: "A test asks how strange the evidence would be if nothing were going on. The p-value answers that — and almost everyone misreads it at least once." })
      + lesson({
        objectives: [
          "State a null and an alternative and choose a test statistic",
          `Interpret a p-value correctly and avoid the standard fallacy`,
          `Trade off type-I and type-II error and read a power curve`,
          `Adjust for multiplicity when testing many hypotheses at once`,
        ],
        body: `
          <p>Fix a null hypothesis ${mi("H_0")}, compute a statistic, and ask how extreme it is under the null's distribution. The p-value is ${mi("P(\\text{statistic at least this extreme}\\mid H_0)")} — not the probability that ${mi("H_0")} is true, and not the probability the result was luck. You commit a type-I error (rate ${mi("\\alpha")}) by rejecting a true null and a type-II error (rate ${mi("\\beta")}) by missing a real effect; power ${mi("1-\\beta")} rises with the sample size and the effect size.</p>
          <p>The atlas makes multiplicity unavoidable: dozens of variables across thousands of counties means thousands of possible tests, and some will look significant by chance alone. Controlling the family-wise error rate (Bonferroni and its relatives) or the false discovery rate (Benjamini–Hochberg) keeps the honest discoveries from drowning in noise.</p>`,
        build: "Interactive in development: draggable null and alternative densities whose overlap is the error you can see, with a live power curve as the sample size moves.",
      }) + chapterNav,
  },
  {
    id: "bayes", route: "/s1/bayes", group: "s1", nav: "Bayesian shrinkage", seq: 11,
    title: "Bayesian inference & shrinkage",
    html: head({ kicker: "Semester I · 11 · Bayesian thinking",
      title: "Borrowing strength across counties",
      lede: "A 20% rate measured on 500 people is barely a measurement. Shrinkage pulls the noisy local estimate toward the whole, in proportion to how little it knows." })
      + moduleBody("m7", "bayes-plot") + chapterNav,
  },

  // =====================================================================
  // SEMESTER II — LINEAR MODELS
  // =====================================================================
  {
    id: "regression", route: "/s2/regression", group: "s2", nav: "Least squares", seq: 12,
    title: "Least squares: a line and a control",
    html: head({ kicker: "Semester II · 12 · Least squares",
      title: "A line, and then a control",
      lede: "The straight-line summary of the cloud — and what happens to the slope when a second variable enters." })
      + moduleBody("m4", "reg-plot") + chapterNav,
  },
  {
    id: "matrix-regression", route: "/s2/linear-algebra", group: "s2", nav: "The model in matrix form", seq: 13,
    title: "The linear model in matrix form",
    html: head({ kicker: "Semester II · 13 · Geometry of OLS",
      title: "Regression is a projection",
      lede: "Stack the counties into a matrix and least squares becomes a single geometric act: drop a perpendicular from the data onto the space the predictors span." })
      + lesson({
        objectives: [
          "Write the linear model and the OLS estimator in matrix form",
          `Read OLS as an orthogonal projection via the hat matrix`,
          `State the Gauss–Markov theorem and what \"BLUE\" guarantees`,
          `Use Frisch–Waugh–Lovell to see what \"controlling for\" really does`,
        ],
        body: `
          <p>Stack the counties: ${mi("y")} is the outcome vector, ${mi("X")} the matrix of predictors, and the model is ${mi("y=X\\beta+\\varepsilon")}. Least squares minimizes the squared residual length ${mi("\\lVert y-X\\beta\\rVert^2")}, and the solution is ${md("\\hat\\beta=(X^{\\top}X)^{-1}X^{\\top}y.")} Geometrically, ${mi("X\\hat\\beta")} is the orthogonal projection of ${mi("y")} onto the column space of ${mi("X")}; the hat matrix ${mi("H=X(X^{\\top}X)^{-1}X^{\\top}")} is the operator that performs the drop.</p>
          <p>Under the Gauss–Markov assumptions — zero-mean, constant-variance, uncorrelated errors — OLS is BLUE, the best linear unbiased estimator, smallest variance in its class. And the Frisch–Waugh–Lovell theorem gives "controlling for" an exact meaning: a multiple-regression coefficient equals the slope of a simple regression run on the parts of both variables left over after the other predictors are partialled out.</p>`,
        build: "Interactive in development: a rotatable 3-D projection of y onto the predictor plane, with a Frisch–Waugh–Lovell panel that residualizes one variable at a time.",
      }) + chapterNav,
  },
  {
    id: "regression-inference", route: "/s2/inference", group: "s2", nav: "Inference in the model", seq: 14,
    title: "Inference in the linear model",
    html: head({ kicker: "Semester II · 14 · Standard errors & tests",
      title: "How sure are we about a slope?",
      lede: "A coefficient without a standard error is decoration. Here is where the t, the F, and the analysis of variance come from." })
      + lesson({
        objectives: [
          "Derive the variance of the OLS coefficients",
          `Test a single coefficient with a t-statistic and a joint hypothesis with an F-test`,
          `Read the ANOVA decomposition and the meaning of R-squared`,
          `Tell a confidence interval for the mean apart from a prediction interval`,
        ],
        body: `
          <p>Under homoskedastic errors the coefficient vector has variance ${mi("\\sigma^2 (X^{\\top}X)^{-1}")}; the square roots of its diagonal are the standard errors. A single coefficient is tested with ${mi("t=\\hat\\beta_j/\\,\\widehat{\\mathrm{se}}(\\hat\\beta_j)")}, and several at once — "do these three variables jointly matter?" — with an F-statistic comparing restricted and unrestricted residual sums of squares.</p>
          <p>The analysis of variance splits total variation into explained and residual parts, and ${mi("R^2")} is the explained share. Two intervals get confused constantly: a confidence interval for ${mi("\\mathbb{E}[Y\\mid x_0]")} bounds the average outcome at ${mi("x_0")}, while a prediction interval bounds a single new county and is always wider, because it must also swallow the irreducible noise ${mi("\\varepsilon")}.</p>`,
        build: "Interactive in development: a coefficient plot with toggleable error bars, and a side-by-side confidence-versus-prediction band on the fitted line.",
      }) + chapterNav,
  },
  {
    id: "diagnostics", route: "/s2/diagnostics", group: "s2", nav: "Diagnostics", seq: 15,
    title: "Regression diagnostics",
    html: head({ kicker: "Semester II · 15 · When the assumptions fail",
      title: "Reading the residuals",
      lede: "The fit can be high and the model still wrong. Diagnostics are how you catch heteroskedasticity, a single county bending the line, and predictors that duplicate each other." })
      + lesson({
        objectives: [
          "Detect heteroskedasticity and respond with robust standard errors",
          `Quantify leverage and influence with the hat values and Cook's distance`,
          `Diagnose multicollinearity with the variance inflation factor`,
          `Use residual plots to find the misspecification the R-squared hides`,
        ],
        body: `
          <p>When error variance changes across the data — rural counties noisier than dense ones — the coefficients stay unbiased but their standard errors are wrong. Heteroskedasticity-consistent (White / Huber) standard errors repair the inference without changing the fit. A single county can also dominate: leverage lives on the diagonal of the hat matrix ${mi("H")}, and Cook's distance combines leverage with residual size to flag the points that, if dropped, would move the line the most.</p>
          <p>Multicollinearity is the opposite problem — predictors that say nearly the same thing, inflating variances and making coefficients unstable. The variance inflation factor ${mi("\\mathrm{VIF}_j = 1/(1-R_j^2)")} measures how much each predictor is explained by the others. None of this shows up in ${mi("R^2")}; it shows up in the residual plots, which is why you always draw them.</p>`,
        build: "Interactive in development: a residual-versus-fitted panel and a leverage map where you can drag a county and watch the line and Cook's distance respond.",
      }) + chapterNav,
  },
  {
    id: "model-selection", route: "/s2/model-selection", group: "s2", nav: "Model selection", seq: 16,
    title: "Model selection & the bias–variance tradeoff",
    html: head({ kicker: "Semester II · 16 · Choosing a model",
      title: "Why the best in-sample fit is usually the wrong model",
      lede: "Add enough predictors and you can fit the data perfectly and predict nothing. The whole game is the tradeoff between fitting and generalizing." })
      + lesson({
        objectives: [
          "Decompose prediction error into bias, variance, and irreducible noise",
          `Tell in-sample error apart from out-of-sample error`,
          `Compare models with AIC and BIC and know how they differ`,
          `Estimate generalization error with k-fold cross-validation`,
        ],
        body: `
          <p>Expected prediction error splits three ways: ${md("\\mathbb{E}\\big[(y-\\hat f(x))^2\\big]=\\underbrace{\\text{bias}^2}_{\\text{too simple}}+\\underbrace{\\text{variance}}_{\\text{too flexible}}+\\underbrace{\\sigma^2}_{\\text{irreducible}}.")} A model too simple is biased; a model too flexible chases noise and has high variance; the sweet spot minimizes their sum. In-sample error always falls as you add terms, which is exactly why it cannot be trusted to choose among them.</p>
          <p>Two information criteria penalize complexity directly: AIC aims at predictive accuracy, BIC at recovering the true model and so penalizes parameters more heavily as the sample grows. The most honest tool, though, is cross-validation: split the counties into ${mi("k")} folds, train on ${mi("k-1")} and test on the one held out, rotate, and average. That out-of-sample error is the number that actually predicts how the model behaves on counties it has never seen.</p>`,
        build: "Interactive in development: a polynomial-degree slider that draws training and validation error diverging as the fit starts to overfit.",
      }) + chapterNav,
  },
  {
    id: "regularization", route: "/s2/regularization", group: "s2", nav: "Regularization", seq: 17,
    title: "Ridge, lasso & elastic net",
    html: head({ kicker: "Semester II · 17 · Shrinkage estimators",
      title: "Paying a price for large coefficients",
      lede: "When predictors outnumber what the data can support, deliberately shrinking the coefficients — even biasing them — predicts better. The shape of the penalty decides whether you also get variable selection for free." })
      + lesson({
        objectives: [
          "Write the ridge, lasso, and elastic-net objectives",
          `Explain the geometry that makes the lasso set coefficients exactly to zero`,
          `Connect shrinkage to the bias–variance tradeoff`,
          `Choose the penalty strength by cross-validation`,
        ],
        body: `
          <p>Ridge adds a squared-size penalty, ${md("\\hat\\beta^{\\text{ridge}}=\\arg\\min_\\beta\\ \\lVert y-X\\beta\\rVert^2+\\lambda\\lVert\\beta\\rVert_2^2,")} which pulls every coefficient toward zero without ever reaching it — ideal when predictors are collinear. The lasso uses an absolute-value penalty ${mi("\\lambda\\lVert\\beta\\rVert_1")}; its diamond-shaped constraint region has corners on the axes, so the solution often lands exactly at zero and the method selects variables as it fits. The elastic net mixes the two and keeps groups of correlated predictors together.</p>
          <p>All three trade a little bias for a large cut in variance, which is why they generalize better than plain OLS in wide problems. The penalty strength ${mi("\\lambda")} is the one knob, and it is set the honest way — by the cross-validation curve from the previous chapter, not by eye.</p>`,
        build: "Interactive in development: a coefficient-path plot as λ sweeps, with the lasso constraint diamond and the ridge circle drawn against the loss contours.",
      }) + chapterNav,
  },
  {
    id: "glm", route: "/s2/glm", group: "s2", nav: "Generalized linear models", seq: 18,
    title: "Generalized linear models",
    html: head({ kicker: "Semester II · 18 · Beyond the continuous outcome",
      title: "When the response is a yes/no or a count",
      lede: "Linear regression assumes a continuous outcome with constant-variance noise. Whether a county flips an election, or how many clinics it has, breaks both assumptions — and the GLM fixes them with one idea." })
      + lesson({
        objectives: [
          "Identify the exponential-family form and the role of a link function",
          `Fit and interpret logistic regression in odds and log-odds`,
          `Use Poisson regression for count outcomes`,
          `Estimate by maximum likelihood and assess fit with deviance`,
        ],
        body: `
          <p>A generalized linear model keeps the linear predictor ${mi("\\eta=X\\beta")} but connects it to the mean through a link function, ${mi("g(\\mu)=\\eta")}, chosen to match the outcome. For a binary response the logit link gives logistic regression, ${md("\\log\\frac{p}{1-p}=X\\beta,")} so a coefficient is a change in log-odds and its exponential is an odds ratio. For counts, the log link gives Poisson regression, ${mi("\\log\\mu=X\\beta")}, where a coefficient is a multiplicative effect on the rate.</p>
          <p>There is no closed-form solution, so the fit is by maximum likelihood, solved iteratively. Goodness of fit is read from the deviance, the GLM's generalization of the residual sum of squares, which also drives the likelihood-ratio tests that compare nested models.</p>`,
        build: "Interactive in development: a logistic curve fitted to a binary county outcome, with a toggle to read effects as probabilities, odds, or log-odds.",
      }) + chapterNav,
  },
  {
    id: "nonlinear", route: "/s2/nonlinear", group: "s2", nav: "Beyond the line", seq: 19,
    title: "Beyond the line: splines, kernels & GAMs",
    html: head({ kicker: "Semester II · 19 · Flexible regression",
      title: "Letting the data choose the shape",
      lede: "The conditional mean from Semester I was rarely a straight line. These methods let the curve bend where the data bend, while the bandwidth keeps it from chasing noise." })
      + lesson({
        objectives: [
          "See why high-degree polynomials misbehave in the tails",
          `Build a regression spline from basis functions and knots`,
          `Fit a local regression (kernel / LOESS) and read the bandwidth as a bias–variance knob`,
          `Combine smooth terms additively in a generalized additive model`,
        ],
        body: `
          <p>The quick fix for curvature is a polynomial, but high degrees swing wildly at the edges of the data and extrapolate disastrously. Regression splines do better: piece together low-degree polynomials that join smoothly at knots, giving local flexibility without global instability. Local regression takes a different route — at each point, fit a small weighted regression to the nearby counties only, with a kernel setting the weights and a bandwidth setting "nearby."</p>
          <p>That bandwidth is the bias–variance dial in disguise: too wide and the curve is biased toward a straight line, too narrow and it tracks every wiggle. Generalized additive models scale the idea to many predictors by summing smooth functions, ${mi("g(\\mu)=\\beta_0+f_1(x_1)+\\cdots+f_p(x_p)")}, keeping the interpretability of one curve per variable while letting each one bend.</p>`,
        build: "Interactive in development: a bandwidth slider on a LOESS fit to a real county relationship, with the bias-versus-variance behavior visible at the extremes.",
      }) + chapterNav,
  },
  {
    id: "resampling", route: "/s2/resampling", group: "s2", nav: "Resampling", seq: 20,
    title: "Bootstrap, jackknife & permutation",
    html: head({ kicker: "Semester II · 20 · Resampling methods",
      title: "Letting the data stand in for the population",
      lede: "When the formula for a standard error is hard, unknown, or built on assumptions you distrust, you can simulate the sampling distribution from the one sample you have." })
      + lesson({
        objectives: [
          "Run a nonparametric bootstrap and read a percentile interval",
          `Contrast the parametric bootstrap and the jackknife`,
          `Build a permutation test for a null of no association`,
          `Recognize when resampling beats a closed-form formula`,
        ],
        body: `
          <p>The bootstrap treats the sample as a stand-in for the population: draw ${mi("n")} counties with replacement, recompute the statistic, repeat thousands of times, and the spread of those replicates estimates the sampling distribution directly. The percentiles give a confidence interval with no normality assumption. The jackknife is the leave-one-out cousin, cheaper and useful for bias estimates; the parametric bootstrap resamples from a fitted model instead of from the raw data.</p>
          <p>Permutation tests answer a different question. To test whether two variables are associated, shuffle one of them to break any real link, recompute the statistic on each shuffle, and see where the observed value falls in that null distribution. It is the most assumption-light test there is, and it makes the logic of a p-value almost tangible.</p>`,
        build: "Interactive in development: a bootstrap distribution that fills in resample by resample, beside a permutation null you can shuffle on demand.",
      }) + chapterNav,
  },

  // =====================================================================
  // SEMESTER III — ECONOMETRICS
  // =====================================================================
  {
    id: "causal-inference", route: "/s3/causal", group: "s3", nav: "The causal question", seq: 21,
    title: "The causal question",
    html: head({ kicker: "Semester III · 21 · Potential outcomes",
      title: "Correlation, and the thing it isn't",
      lede: "Everything so far described the world. Econometrics asks what would happen if we changed it — a question the data alone cannot answer without a framework for the counterfactual." })
      + lesson({
        objectives: [
          "Define potential outcomes and the fundamental problem of causal inference",
          `Distinguish the average treatment effect from the effect on the treated`,
          `Explain selection bias as the gap between association and causation`,
          `Use a DAG to find confounders, colliders, and a valid adjustment set`,
        ],
        body: `
          <p>Give each county two potential outcomes: ${mi("Y(1)")} under a treatment and ${mi("Y(0)")} without it. The causal effect for that county is ${mi("Y(1)-Y(0)")}, and the fundamental problem is that we only ever see one of the two. We are left to estimate averages — the average treatment effect ${mi("\\mathbb{E}[Y(1)-Y(0)]")}, or the effect on the treated, which can differ sharply when the treated places are special.</p>
          <p>A naive comparison of treated and untreated counties confounds the effect with the reasons places got treated in the first place; that gap is selection bias. Directed acyclic graphs make the bookkeeping explicit: arrows encode assumed causal structure, a fork is a confounder you must adjust for, and a collider is a variable you must <em>not</em> condition on, because doing so manufactures association out of nothing. The backdoor criterion turns those pictures into a defensible set of controls.</p>`,
        build: "Interactive in development: a draggable DAG that highlights backdoor paths and shows which adjustment sets identify the effect and which open a collider.",
      }) + chapterNav,
  },
  {
    id: "iv", route: "/s3/instrumental-variables", group: "s3", nav: "Instrumental variables", seq: 22,
    title: "Instrumental variables & 2SLS",
    html: head({ kicker: "Semester III · 22 · Instrumental variables",
      title: "A lever you can pull when the regressor is dirty",
      lede: "When a predictor is tangled with the error term, OLS lies. An instrument is a third variable that moves the predictor without touching the outcome any other way." })
      + lesson({
        objectives: [
          "Recognize endogeneity and why it biases OLS",
          `State the relevance and exclusion conditions an instrument must satisfy`,
          `Estimate a causal effect by two-stage least squares`,
          `Interpret the local average treatment effect and spot weak instruments`,
        ],
        body: `
          <p>A regressor is endogenous when it is correlated with the error — through omitted variables, reverse causation, or measurement error — and then ${mi("\\hat\\beta_{\\text{OLS}}")} is biased no matter the sample size. An instrument ${mi("Z")} rescues identification if it satisfies two conditions: relevance, ${mi("Z")} actually shifts the suspect regressor; and exclusion, ${mi("Z")} affects the outcome only through that regressor and nothing else.</p>
          <p>Two-stage least squares operationalizes it: regress the endogenous variable on the instrument, then regress the outcome on the predicted values, isolating the clean, instrument-driven variation. The catch is interpretation. With heterogeneous effects, 2SLS recovers a local average treatment effect — the effect for the "compliers" the instrument actually moved — not the population average. And when the instrument is weak (the first stage barely moves), the estimator is both badly biased and badly behaved, so the first-stage F-statistic is not optional.</p>`,
        build: "Interactive in development: a two-stage path diagram where you weaken the instrument and watch the estimate's bias and variance blow up.",
      }) + chapterNav,
  },
  {
    id: "panel", route: "/s3/panel", group: "s3", nav: "Panel data", seq: 23,
    title: "Panel data",
    html: head({ kicker: "Semester III · 23 · Panel data",
      title: "The same county, watched over time",
      lede: "Follow places across years and you can difference away everything fixed about them — geography, culture, history — and identify effects from change rather than from cross-sectional comparison." })
      + lesson({
        objectives: [
          "Set up a panel and contrast pooled OLS with fixed and random effects",
          `Use the within transformation to remove unit-specific confounders`,
          `Decide between fixed and random effects with the Hausman logic`,
          `Cluster standard errors to respect within-unit correlation`,
        ],
        body: `
          <p>A panel observes each county over several years, ${mi("y_{it}=\\alpha_i+X_{it}\\beta+\\varepsilon_{it}")}. The fixed effect ${mi("\\alpha_i")} absorbs everything time-invariant about a place, however unmeasured. The within (demeaning) transformation subtracts each county's own average, sweeping ${mi("\\alpha_i")} out entirely, so ${mi("\\beta")} is identified purely from within-county change. Random effects instead model ${mi("\\alpha_i")} as draws from a distribution and are more efficient — but only if those effects are uncorrelated with the regressors, the assumption the Hausman test interrogates.</p>
          <p>One practical point looms over all panel work: errors are correlated within a county across years, so default standard errors are far too small. Clustering by county (or by state) corrects the inference, and getting it wrong is one of the most common ways a panel result is oversold.</p>`,
        build: "Interactive in development: a two-period panel where toggling fixed effects visibly shifts the estimated slope by removing between-county variation.",
      }) + chapterNav,
  },
  {
    id: "did", route: "/s3/difference-in-differences", group: "s3", nav: "Difference-in-differences", seq: 24,
    title: "Difference-in-differences & event studies",
    html: head({ kicker: "Semester III · 24 · Difference-in-differences",
      title: "Two differences that cancel the confounders",
      lede: "A policy hits some counties and not others. Compare the treated group's before-and-after change to the control group's, and anything common to both subtracts out — if their trends would have moved together." })
      + lesson({
        objectives: [
          "Construct the 2×2 difference-in-differences estimator",
          `State and probe the parallel-trends assumption`,
          `Read an event-study plot for pre-trends and dynamic effects`,
          `Understand why staggered adoption breaks naive two-way fixed effects`,
        ],
        body: `
          <p>The estimator is a difference of differences: ${md("\\widehat{\\delta}=\\big(\\bar y^{\\text{treat}}_{\\text{post}}-\\bar y^{\\text{treat}}_{\\text{pre}}\\big)-\\big(\\bar y^{\\text{ctrl}}_{\\text{post}}-\\bar y^{\\text{ctrl}}_{\\text{pre}}\\big).")} The first difference removes everything fixed about each group; the second removes any shock common to both periods. What it cannot remove is a difference in <em>trends</em>, which is why the whole design rests on parallel trends — the assumption that, absent treatment, the two groups would have moved in step.</p>
          <p>An event study tests that assumption by plotting effects relative to the treatment date: flat coefficients before treatment support parallel trends, and the post-period coefficients trace the effect as it builds. The modern caution is staggered adoption — when units are treated at different times, the standard two-way fixed-effects regression silently uses already-treated units as controls and can return a weighted average with negative weights. Recent estimators (Callaway–Sant'Anna, Sun–Abraham, and the Goodman-Bacon decomposition that diagnosed the problem) repair it.</p>`,
        build: "Interactive in development: an event-study plot with a draggable treatment date and a parallel-trends counterfactual you can tilt to see the bias.",
      }) + chapterNav,
  },
  {
    id: "rdd", route: "/s3/regression-discontinuity", group: "s3", nav: "Regression discontinuity", seq: 25,
    title: "Regression discontinuity",
    html: head({ kicker: "Semester III · 25 · Regression discontinuity",
      title: "A natural experiment hiding at a threshold",
      lede: "When a program switches on at a sharp cutoff — a poverty rate, a population count — counties just above and just below the line are otherwise alike, and the jump at the line is the effect." })
      + lesson({
        objectives: [
          "Identify the running variable and the assignment cutoff",
          `Distinguish sharp from fuzzy designs`,
          `Estimate the jump with local linear regression and a chosen bandwidth`,
          `Test the design with continuity and manipulation (density) checks`,
        ],
        body: `
          <p>Eligibility often turns on a threshold of a continuous "running variable" ${mi("X")}: a county qualifies if ${mi("X\\ge c")}. Right at the cutoff, places are essentially identical except for the treatment they barely did or didn't get, so the discontinuity in the outcome at ${mi("c")} estimates the causal effect there. In a sharp design treatment is a deterministic step at ${mi("c")}; in a fuzzy design crossing the cutoff only raises the probability of treatment, and the jump in the outcome is scaled by the jump in treatment, recovering a local effect by an instrumental-variables argument.</p>
          <p>Estimation fits a flexible curve on each side — local linear regression within a bandwidth of the cutoff — and reads off the gap. The design is credible only if nothing else jumps at ${mi("c")} and units cannot precisely manipulate their score to land on the favorable side; a density test at the cutoff (McCrary) checks exactly that. The effect is sharply local, valid at the threshold and not necessarily far from it.</p>`,
        build: "Interactive in development: a scatter with a draggable cutoff and bandwidth, fitting local lines on each side and reporting the estimated jump.",
      }) + chapterNav,
  },
  {
    id: "time-series", route: "/s3/time-series", group: "s3", nav: "Time series", seq: 26,
    title: "Time series",
    html: head({ kicker: "Semester III · 26 · Time series",
      title: "When the order of the data matters",
      lede: "Drop the assumption that observations are independent in time and a new set of tools appears: autocorrelation, stationarity, and models that forecast the next value from the last." })
      + lesson({
        objectives: [
          "Define stationarity and read the autocorrelation function",
          `Specify AR, MA, and ARMA models`,
          `Detect a unit root and difference a series to stationarity`,
          `Produce and evaluate an out-of-sample forecast`,
        ],
        body: `
          <p>A series is stationary when its mean, variance, and autocorrelation structure do not drift over time — the precondition that makes most time-series theory work. Autocorrelation, ${mi("\\rho_k=\\mathrm{Corr}(y_t,y_{t-k})")}, measures how today depends on ${mi("k")} periods ago, and its plot (the ACF), with the partial ACF, is how you read a series' memory. Autoregressive models regress ${mi("y_t")} on its own lags; moving-average models build it from past shocks; ARMA combines both.</p>
          <p>Many economic series are not stationary — they have a unit root and wander like a random walk, which makes ordinary regressions between them spurious. The fix is differencing: model the change ${mi("\\Delta y_t")} rather than the level, after a unit-root test (augmented Dickey–Fuller) confirms the diagnosis. Forecasts are then judged the same way everything else in this course is judged — out of sample, by holding back the most recent periods and scoring the prediction.</p>`,
        build: "Interactive in development: a simulator for AR and MA processes with live ACF/PACF plots, plus a one-step-ahead forecast against held-out values.",
      }) + chapterNav,
  },
  {
    id: "quantile-robust", route: "/s3/quantile", group: "s3", nav: "Quantile & robust", seq: 27,
    title: "Quantile & robust regression",
    html: head({ kicker: "Semester III · 27 · Beyond the mean",
      title: "When the average is the wrong summary",
      lede: "OLS models the conditional mean and lets a few extreme counties drag the line. Quantile regression models the median or the tails directly; robust regression refuses to let outliers dictate the fit." })
      + lesson({
        objectives: [
          "Model conditional quantiles with the check (pinball) loss",
          `Read how a covariate's effect differs across the distribution`,
          `Use M-estimation to bound the influence of outliers`,
          `Choose between mean, median, and quantile targets for a question`,
        ],
        body: `
          <p>Least squares minimizes squared error and so estimates the conditional mean — but a policy may care about the bottom decile of counties, not the average one. Quantile regression replaces squared error with the asymmetric check loss ${mi("\\rho_\\tau(u)=u\\,(\\tau-\\mathbf{1}\\{u<0\\})")}, whose minimizer is the conditional ${mi("\\tau")}-quantile. Fit it at several ${mi("\\tau")} and a single covariate can show a steep effect at the bottom of the distribution and a flat one at the top, structure the mean regression averages away.</p>
          <p>Robustness is the companion concern. Squared error gives a lone extreme county enormous leverage; M-estimators (Huber, for instance) cap the influence of large residuals by switching from a quadratic to a linear penalty in the tails, so the fit reflects the bulk of the data rather than its outliers. Median regression is the simplest robust case, the ${mi("\\tau=0.5")} corner of quantile regression.</p>`,
        build: "Interactive in development: a fan of fitted quantile lines across τ, with a toggle to OLS so the difference at the tails is visible.",
      }) + chapterNav,
  },
  {
    id: "ml-causal", route: "/s3/machine-learning", group: "s3", nav: "ML for causal inference", seq: 28,
    title: "Machine learning for causal inference",
    html: head({ kicker: "Semester III · 28 · The modern bridge",
      title: "Prediction in service of a causal answer",
      lede: "Flexible predictors overfit and bias naive causal estimates. The modern fix uses machine learning for the nuisance parts while protecting the one number you care about — and points straight at the geometric methods to come." })
      + lesson({
        objectives: [
          "Separate prediction problems from inference problems",
          `Explain why plugging an ML fit into a causal estimate biases it`,
          `Use double / debiased ML and Neyman orthogonality to remove that bias`,
          `Estimate heterogeneous effects with causal forests`,
        ],
        body: `
          <p>Machine learning is built to predict, not to give an unbiased coefficient with a valid standard error. Drop a flexible model directly into a treatment-effect estimate and its regularization bias leaks into the answer. Double (debiased) machine learning fixes this with two ideas: estimate the nuisance functions — the outcome model and the treatment model — with any flexible learner, but combine them in a Neyman-orthogonal score that is locally insensitive to errors in those nuisances, and use cross-fitting so the same data are not used to both learn and evaluate.</p>
          <p>The same machinery, via causal forests, estimates how the effect varies across counties — heterogeneous treatment effects rather than a single average. Reading these effects as a smooth surface over the county space is exactly the step that motivates the rest of this atlas: once an effect is a function on geography, the natural questions become geometric. That is where the spatial chapters, and then geosocioeconometrics, take over.</p>`,
        build: "Interactive in development: a cross-fitting schematic and a causal-forest effect surface over the county map, the handoff into the spatial group.",
      }) + chapterNav,
  },

  // =====================================================================
  // SPATIAL STATISTICS — when independence breaks
  // =====================================================================
  {
    id: "spatial-dependence", route: "/spatial/dependence", group: "spatial", nav: "Spatial dependence", seq: 29,
    title: "Spatial dependence",
    html: head({ kicker: "Spatial · 29 · Spatial dependence",
      title: "Nearby counties are not strangers",
      lede: "Every classical chapter treated each county as an independent draw. Tobler's first law says that is wrong — and Moran's I says exactly how wrong." })
      + moduleBody("m6", "moran-plot") + chapterNav,
  },
  {
    id: "policy", route: "/spatial/policy", group: "spatial", nav: "Policy counterfactual", seq: 30,
    title: "Policy & forecasting",
    html: head({ kicker: "Spatial · 30 · Policy impact & forecasting",
      title: "From description to counterfactual",
      lede: "Sort the country by poverty, watch diabetes climb, then ask the what-if a place-based program implies — with its assumptions in the open." })
      + moduleBody("m8", "policy-plot") + chapterNav,
  },
  {
    id: "redlining", route: "/spatial/redlining", group: "spatial", nav: "The redlining line", seq: 31,
    title: "The redlining line",
    html: `
      <section class="flagship reveal">
        <div class="flagship-inner">
          <span class="kicker kicker-light">Spatial · The flagship case</span>
          <h1 class="flagship-title">A line drawn in 1939, still legible today</h1>
          <p class="page-lede page-lede-light">The Home Owners' Loan Corporation graded neighborhoods A through D and starved the D's of investment. The grades are gone; the gradient they produced is not. Here it is, in present-day health data, at the tract scale.</p>
          <div id="redlining" class="prose-slot prose-slot-light"></div>
          <div id="redlining-mount" class="mt"></div>
        </div>
      </section>
      ${chapterNav}`,
  },

  // =====================================================================
  // GEOSOCIOECONOMETRICS — geometry of the field (Helfrich)
  // =====================================================================
  {
    id: "gradient-fields", route: "/geo/gradient-fields", group: "geo", nav: "Gradient & tensor fields", seq: 32,
    title: "Gradient & structure-tensor fields",
    html: head({ kicker: "Geosocioeconometrics · 32 · Geometry of the field",
      title: "Where the country changes fastest",
      lede: "Stop reading the map as 3,144 numbers and read it as a surface Z(s). A surface has a slope everywhere, and the slope is where the structure is." })
      + `<section class="page-body reveal">
        <div class="prose-slot" id="iii-grad-prose"></div>
        <div id="grad-plot" class="plot"></div>
        <div class="dev-note">Interactive vector-field and structure-tensor viewer in development. The math below is the specification it implements.</div>
      </section>` + chapterNav,
  },
  {
    id: "optimal-transport", route: "/geo/optimal-transport", group: "geo", nav: "Optimal transport", seq: 33,
    title: "Optimal transport & distributional flux",
    html: head({ kicker: "Geosocioeconometrics · 33 · Distributional flux",
      title: "The cost of moving one map onto another",
      lede: "Where poverty is, against where clinics are. Optimal transport measures the minimal work to reconcile the two, and the velocity field that does it is what I call distributional flux." })
      + `<section class="page-body reveal">
        <div class="prose-slot" id="iii-ot-prose"></div>
        <div class="dev-note">Sinkhorn / POT companion and the Benamou–Brenier flow viewer in development. The specification follows.</div>
      </section>` + chapterNav,
  },
  {
    id: "networks-diffusion", route: "/geo/networks-diffusion", group: "geo", nav: "Networks & diffusion", seq: 34,
    title: "Networks & diffusion",
    html: head({ kicker: "Geosocioeconometrics · 34 · Networks & diffusion",
      title: "The country as a graph that conducts",
      lede: "Counties are nodes, shared borders are edges, and the graph Laplacian governs how a shock spreads. This is the operator that quietly underwrote the spatial chapters." })
      + `<section class="page-body reveal">
        <div class="prose-slot" id="iii-net-prose"></div>
        <div class="dev-note">Heat-kernel diffusion and effective-distance viewer in development. The specification follows.</div>
      </section>` + chapterNav,
  },
  {
    id: "topology", route: "/geo/topology", group: "geo", nav: "Topology of the field", seq: 35,
    title: "Topology of the field",
    html: head({ kicker: "Geosocioeconometrics · 35 · Topology",
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
