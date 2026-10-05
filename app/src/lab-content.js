export const STUDIES=[
  {
    id:'health',index:'01',title:'Income & health',headline:'Income and diabetes.',
    x:'median_hh_income',y:'diabetes_pct',step:10000,
    exposure:'$10,000 higher median household income',outcome:'adult diabetes prevalence',
    intro:'Higher-income counties generally have lower estimated diabetes prevalence. How much of that relationship remains when the comparison accounts for state, age, and population density?',
    hypothesis:'Higher county incomes are associated with lower adult diabetes prevalence.',
    mechanism:'Income can shape housing, working conditions, food, and access to care. Ill health can also reduce earnings. Migration and local institutions may influence both.',
    design:'A policy that changes income through a credible eligibility rule or rollout could offer useful variation. A stronger design would follow people or places over time, examine pre-policy trends, and account for migration and spillovers.',
    measurement:'PLACES uses demographic and socioeconomic information to estimate local health outcomes. Associations with related predictors partly reflect that modeling process. County median age cannot substitute for the full adult age distribution.',
    question:'What part of the income–health relationship would persist under a credible change in income?',
    need:'Policy timing and eligibility; longitudinal outcomes; a defensible comparison group.',
  },
  {
    id:'housing',index:'02',title:'Income & housing',headline:'The cost of staying.',
    x:'median_hh_income',y:'rent_burden_pct',step:10000,
    exposure:'$10,000 higher median household income',outcome:'median rent-to-income share',
    intro:'Higher incomes can ease housing pressure. They can also coincide with higher rents. Compare the county-level relationship under different assumptions about place and population.',
    hypothesis:'Higher county incomes are associated with a lower median share of renter income spent on rent.',
    mechanism:'Earnings, housing supply, and local demand can pull rent burdens in different directions. Household sorting and displacement also change who remains in a county, and therefore its measured median.',
    design:'Start with a specific change in housing supply or assistance. Establish its timing and comparison group, examine prior trends, and measure displacement. Renter-level income and rent would align the two sides of the comparison.',
    measurement:'Median household income describes all households. Median rent share describes cash-rent renters with a computable ratio. It is not the proportion of renters spending more than 30% of their income.',
    question:'Does a specific housing intervention reduce pressure on existing renters, or change who lives there?',
    need:'Renter-level outcomes; policy timing; housing supply; migration and displacement measures.',
  },
  {
    id:'access',index:'03',title:'Poverty & broadband',headline:'The geography of connection.',
    x:'pct_poverty',y:'pct_broadband',step:10,
    exposure:'10 percentage points higher poverty',outcome:'household broadband subscription share',
    intro:'Counties with more poverty tend to have fewer broadband subscriptions. A subscription rate alone cannot distinguish cost, infrastructure, skills, or demand. Begin with the pattern; identify what it leaves unresolved.',
    hypothesis:'Higher county poverty is associated with fewer household broadband subscriptions.',
    mechanism:'Affordability, network availability, digital skills, and local labor markets may all matter. Subscription data show take-up, not whether a connection is available or reliable.',
    design:'Distinguish an infrastructure rollout from an affordability intervention. Link credible rollout or eligibility variation to service coverage, prices, and household subscriptions, with checks for selection and spillovers.',
    measurement:'Poverty counts people; broadband subscriptions count households. County aggregates do not establish whether residents in poverty belong to the households without subscriptions.',
    question:'Would lower prices or better infrastructure change subscriptions in the places with the largest gaps?',
    need:'Service availability and quality; prices; intervention timing; household-level subscriptions.',
  },
];

export function labTemplate(){return `
  <div class="lab-topline"><span>RESEARCH / COUNTY STUDIES</span><span>Public data. Explicit assumptions.</span></div>
  <header class="lab-header-v3">
    <div><div class="lab-study-tabs" aria-label="Choose a study">${STUDIES.map(s=>`<button data-study="${s.id}"><small>${s.index}</small>${s.title}</button>`).join('')}</div><h1 id="lab-title"></h1><p id="lab-intro" class="lab-deck"></p></div>
    <aside class="study-metadata"><span class="meta-label">THE COMPARISON</span><p id="lab-exposure"></p><div><span id="lab-source-period"></span><span>U.S. counties</span></div><button id="lab-pause" class="text-control">Try prediction mode <span>↗</span></button></aside>
  </header>
  <div class="lab-section-nav"><div><button data-jump="lab-analysis">01 Analysis</button><button data-jump="lab-diagnostics">02 Diagnostics</button><button data-jump="lab-place-section">03 Place</button><button data-jump="lab-research">04 Research notes</button></div><button id="lab-share" class="text-control">Copy view ↗</button></div>
  <section class="prediction-panel" id="lab-prediction" hidden><div><span class="meta-label">A QUESTION BEFORE THE ESTIMATE</span><h2 id="lab-hypothesis"></h2><p>What direction do you expect after accounting for state, median age, and density, with equal county weights?</p></div><div class="prediction-actions">${[['lower','Lower'],['little','Near zero'],['higher','Higher']].map(([v,l])=>`<button data-predict="${v}">${l}</button>`).join('')}<button id="lab-skip" class="text-control">Show the analysis →</button></div></section>
  <p id="lab-prediction-note" class="prediction-note" role="status"></p>
  <div id="lab-results">
    <section id="lab-analysis" class="analysis-section">
      <div class="analysis-toolbar"><div id="lab-sample"></div><label id="lab-measure">Health estimate <select id="lab-outcome"><option value="crude">Crude prevalence</option><option value="adjusted">Age-adjusted prevalence</option></select></label></div>
      <div class="lab-workspace">
        <aside class="specification-rail"><div class="rail-intro"><span class="meta-label">MODEL COMPARISON</span><h2>What changes<br> with the specification?</h2><p>Each row uses the same counties. Select a model to inspect its estimate and residuals.</p></div><div class="mobile-model-control"><label for="lab-model-select">Selected model</label><select id="lab-model-select"></select><button id="lab-model-expand" aria-expanded="false" aria-controls="lab-specs">Show all eight estimates +</button></div><div id="lab-axis" class="spec-axis"></div><div id="lab-specs"></div><p class="rail-footnote">Point estimates, in percentage points per stated exposure increment. The spread across models measures sensitivity to these choices; it is not an uncertainty interval.</p></aside>
        <div class="analysis-stage"><div class="estimate-band"><div><span id="lab-model-name" class="meta-label"></span><div class="estimate-value"><strong id="lab-value"></strong><span>percentage<br>points</span></div><p id="lab-estimate-caption"></p></div><div class="estimate-context"><div id="lab-fit-metrics"></div><p id="lab-shift" role="status"></p></div></div>
          <div class="map-title-row"><div><span class="meta-label">RESIDUAL GEOGRAPHY</span><h3>Where the model falls short.</h3></div><span class="live-view-label"><i></i>Linked to selected model</span></div>
          <div id="lab-map" class="county-map"></div><div id="lab-map-legend" class="residual-legend"></div><p id="lab-map-note" class="figure-caption"></p><button id="lab-selected-place" class="text-control" data-jump="lab-place-section"></button>
          <div class="outlier-heading">Largest absolute residuals <span>Observed minus fitted · pp</span></div><div id="lab-outliers" class="lab-outliers"></div>
        </div>
      </div>
    </section>
    <section id="lab-diagnostics" class="diagnostics-section"><div class="section-heading"><div><span class="meta-label">02 / MODEL DIAGNOSTICS</span><h2>Look beyond the coefficient.</h2></div><p>A stable sign can coexist with a poor fit or geographic dependence. Inspect the variation behind the estimate and how sensitive it is to individual states.</p></div>
      <div class="diagnostic-grid"><div class="partial-panel"><div class="panel-label"><h3>The relationship after adjustment</h3><span id="lab-partial-tag"></span></div><div id="lab-partial"></div><p class="figure-caption">Both axes remove the adjustments included in the selected model. With no controls, this simply centers the data. The fitted line recovers the selected coefficient. Every county has the same dot size; the regression still uses the selected weights. Click a point to inspect its county.</p></div>
      <div class="sensitivity-panel"><span class="meta-label">GEOGRAPHIC SENSITIVITY</span><h3>Does one state carry the result?</h3><p>Refit the same specification, omitting each state in turn. The dashed line is the full-sample estimate.</p><div id="lab-sensitivity" aria-busy="true"></div><p id="lab-sensitivity-note" class="figure-caption" role="status"></p><div id="lab-state-influence"></div><p class="figure-caption">These are deletion diagnostics, not out-of-sample predictions or confidence intervals. Omitting a state changes the sample; it does not identify a state-level causal effect.</p></div></div>
    </section>
    <section id="lab-place-section" class="place-section-v3"><div class="section-heading"><div><span class="meta-label">03 / COUNTY DETAIL</span><h2>A county in context.</h2></div><p>Inspect the observed estimate, its fitted value, and the county’s influence on the association.</p></div><div class="place-grid"><div class="place-main"><div class="county-picker"><label>Find a county<input type="search" id="lab-search" placeholder="County or state" /></label><label>Select a county<select id="lab-county"></select></label></div><div id="lab-place-detail"></div></div><div class="measurement-panel"><span class="meta-label">MEASUREMENT</span><div id="lab-interval"></div></div></div></section>
    <section id="lab-research" class="research-section"><div class="section-heading"><div><span class="meta-label">04 / INTERPRETATION & RESEARCH DESIGN</span><h2>What the comparison establishes.</h2></div><p>The estimates describe relationships among places. A policy claim needs a separate argument about how the relevant variation arose.</p></div>
      <div class="research-grid"><article><span class="note-number">01</span><h3 id="lab-reading-title"></h3><p id="lab-reading"></p><p id="lab-measurement"></p></article><article><span class="note-number">02</span><h3>Competing explanations</h3><p id="lab-mechanism"></p><h4 id="lab-next-question"></h4></article><article><span class="note-number">03</span><h3>Evidence for a stronger design</h3><p id="lab-design"></p><p id="lab-data-needed" class="data-needed"></p></article></div>
      <details class="methods-disclosure"><summary><span>Methods, definitions & source record</span><span>Read the technical notes +</span></summary><div id="lab-methods"></div></details>
    </section>
    <section class="research-notebook"><div><span class="meta-label">RESEARCH RECORD</span><h2>Take the analysis with you.</h2><p>Save the estimates, sample, diagnostic results, and choices behind this view. Your notes stay in this browser and are excluded from shared links.</p><div class="lab-export-actions"><button id="lab-export">Estimates CSV ↗</button><button id="lab-sample-export">Sample CSV ↗</button><button id="lab-record">Full research record ↗</button></div><span id="lab-status" role="status"></span></div><div><label for="lab-notes">Research notes</label><textarea id="lab-notes" rows="6" placeholder="What changed your interpretation? Which alternative explanation deserves a closer look?"></textarea><p class="figure-caption">Saved on this device when browser storage is available.</p></div></section>
  </div>`;}
