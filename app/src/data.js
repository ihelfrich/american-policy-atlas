// Data loading + shared state for the atlas.
const BASE = import.meta.env.BASE_URL;

export async function loadJSON(name) {
  const r = await fetch(`${BASE}data/${name}`);
  if (!r.ok) throw new Error(`failed to load ${name}: ${r.status}`);
  return r.json();
}

// Variable catalogue: id -> {label, unit, source, palette, group, desc, log?}.
// Mirrors the CATALOG in scripts/11_national_county.py (single source of truth);
// the `group` field drives the grouped <optgroup> picker. ACS = American
// Community Survey 2018–22 5-year; PLACES = CDC PLACES 2025 county prevalence.
const ACS = "ACS 2018–22 5-year", PLACES = "CDC PLACES 2025";
export const VARS = {
  // — Demographics —
  pop_density_km2: { label: "Population density", unit: "people / km²", group: "Demographics", source: `${ACS} + TIGER land area`, palette: "viridis", log: true,
    desc: "People per square kilometre: county population over its land area. Spans four orders of magnitude, from the empty Mountain West to Manhattan." },
  median_age: { label: "Median age", unit: "years", group: "Demographics", source: ACS, palette: "teal",
    desc: "Median age of the county population (ACS B01002)." },
  pct_hispanic: { label: "Hispanic / Latino share", unit: "%", group: "Demographics", source: ACS, palette: "purples",
    desc: "Residents identifying as Hispanic or Latino (ACS B03003)." },
  pct_black: { label: "Black share", unit: "%", group: "Demographics", source: ACS, palette: "blues",
    desc: "Residents identifying as Black or African American (ACS B02001)." },
  pct_foreign_born: { label: "Foreign-born share", unit: "%", group: "Demographics", source: ACS, palette: "purples",
    desc: "Residents born outside the United States (ACS B05002)." },
  pct_veteran: { label: "Veteran share (18+)", unit: "%", group: "Demographics", source: ACS, palette: "blues",
    desc: "Civilian veterans among adults 18 and older (ACS B21001)." },
  // — Economy —
  median_hh_income: { label: "Median household income", unit: "$", group: "Economy", source: ACS, palette: "greens",
    desc: "Median household income, ACS five-year estimate (B19013)." },
  income_per_capita: { label: "Income per capita", unit: "$", group: "Economy", source: ACS, palette: "greens",
    desc: "Per-capita income in the past 12 months (ACS B19301)." },
  gini: { label: "Income inequality (Gini)", unit: "index 0–1", group: "Economy", source: ACS, palette: "oranges",
    desc: "Gini index of household income inequality; 0 is perfect equality, 1 is maximal concentration (ACS B19083)." },
  pct_poverty: { label: "Poverty rate", unit: "%", group: "Economy", source: ACS, palette: "reds",
    desc: "People living below the federal poverty line (ACS B17001)." },
  pct_unemployed: { label: "Unemployment", unit: "%", group: "Economy", source: ACS, palette: "oranges",
    desc: "Unemployed share of the civilian labor force (ACS B23025)." },
  // — Education —
  pct_bachelor_plus: { label: "Bachelor's degree +", unit: "%", group: "Education", source: ACS, palette: "teal",
    desc: "Adults 25 and older with a bachelor's degree or higher (ACS B15003)." },
  // — Housing & mobility —
  median_home_value: { label: "Median home value", unit: "$", group: "Housing & mobility", source: ACS, palette: "amber",
    desc: "Median value of owner-occupied homes (ACS B25077)." },
  median_gross_rent: { label: "Median gross rent", unit: "$ / month", group: "Housing & mobility", source: ACS, palette: "amber",
    desc: "Median monthly gross rent including utilities (ACS B25064)." },
  rent_burden_pct: { label: "Rent burden", unit: "% of income", group: "Housing & mobility", source: ACS, palette: "reds",
    desc: "Median gross rent as a share of household income (ACS B25071)." },
  pct_renter: { label: "Renter share", unit: "%", group: "Housing & mobility", source: ACS, palette: "oranges",
    desc: "Occupied housing units that are renter-occupied (ACS B25003)." },
  pct_no_vehicle: { label: "No vehicle available", unit: "%", group: "Housing & mobility", source: ACS, palette: "purples",
    desc: "Households with no vehicle available (ACS B08201)." },
  pct_broadband: { label: "Broadband internet", unit: "%", group: "Housing & mobility", source: ACS, palette: "blues",
    desc: "Households with a broadband internet subscription (ACS B28002)." },
  // — Health access —
  pct_uninsured: { label: "Uninsured", unit: "%", group: "Health access", source: `${ACS} subject S2701`, palette: "reds",
    desc: "Population without health insurance (ACS subject table S2701)." },
  pct_disability: { label: "With a disability", unit: "%", group: "Health access", source: `${ACS} subject S1810`, palette: "oranges",
    desc: "Civilian noninstitutionalized population with a disability (ACS subject S1810)." },
  // — Chronic disease —
  diabetes_pct: { label: "Diabetes", unit: "%", group: "Chronic disease", source: PLACES, palette: "reds",
    desc: "Model-based estimate of adults with diagnosed diabetes (PLACES)." },
  obesity_pct: { label: "Obesity", unit: "%", group: "Chronic disease", source: PLACES, palette: "reds",
    desc: "Model-based estimate of adult obesity, BMI ≥ 30 (PLACES)." },
  hypertension_pct: { label: "High blood pressure", unit: "%", group: "Chronic disease", source: PLACES, palette: "reds",
    desc: "Model-based estimate of adult high blood pressure (PLACES)." },
  high_chol_pct: { label: "High cholesterol", unit: "%", group: "Chronic disease", source: PLACES, palette: "reds",
    desc: "Adults ever told they have high cholesterol (PLACES)." },
  chd_pct: { label: "Coronary heart disease", unit: "%", group: "Chronic disease", source: PLACES, palette: "reds",
    desc: "Adults with coronary heart disease (PLACES)." },
  stroke_pct: { label: "Stroke", unit: "%", group: "Chronic disease", source: PLACES, palette: "reds",
    desc: "Adults who have ever had a stroke (PLACES)." },
  copd_pct: { label: "COPD", unit: "%", group: "Chronic disease", source: PLACES, palette: "reds",
    desc: "Adults with chronic obstructive pulmonary disease (PLACES)." },
  asthma_pct: { label: "Current asthma", unit: "%", group: "Chronic disease", source: PLACES, palette: "reds",
    desc: "Adults with current asthma (PLACES)." },
  // — Behavioral & mental health —
  smoking_pct: { label: "Current smoking", unit: "%", group: "Behavioral & mental health", source: PLACES, palette: "purples",
    desc: "Adults who currently smoke (PLACES)." },
  no_exercise_pct: { label: "No leisure exercise", unit: "%", group: "Behavioral & mental health", source: PLACES, palette: "purples",
    desc: "Adults reporting no leisure-time physical activity (PLACES)." },
  depression_pct: { label: "Depression", unit: "%", group: "Behavioral & mental health", source: PLACES, palette: "purples",
    desc: "Adults with diagnosed depression (PLACES)." },
  mental_distress_pct: { label: "Frequent mental distress", unit: "%", group: "Behavioral & mental health", source: PLACES, palette: "purples",
    desc: "Adults reporting 14 or more poor mental-health days per month (PLACES)." },
  phys_distress_pct: { label: "Frequent physical distress", unit: "%", group: "Behavioral & mental health", source: PLACES, palette: "purples",
    desc: "Adults reporting 14 or more poor physical-health days per month (PLACES)." },
};

// Build grouped <optgroup> markup for a <select>, preserving catalogue order.
export function groupedOptions(selected) {
  const groups = {};
  for (const [id, v] of Object.entries(VARS)) (groups[v.group] ??= []).push([id, v.label]);
  return Object.entries(groups).map(([g, items]) =>
    `<optgroup label="${g}">` +
    items.map(([id, label]) => `<option value="${id}"${id === selected ? " selected" : ""}>${label}</option>`).join("") +
    `</optgroup>`).join("");
}

// color ramps (5-class), low -> high
export const RAMPS = {
  viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  greens: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"],
  reds: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"],
  blues: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
  purples: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"],
  oranges: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"],
  teal: ["#edf8fb", "#b2e2e2", "#66c2a4", "#2ca25f", "#006d2c"],
  amber: ["#fff7e6", "#fee0a6", "#fdc15c", "#e89324", "#b25e09"],
};

export const HOLC_COLORS = { A: "#76a865", B: "#7cb5bd", C: "#d9b84b", D: "#c0504d" };

export const state = {
  counties: null,      // national county FeatureCollection (atlas base)
  caTracts: null,      // California tracts w/ HOLC grade (redlining case study)
  summary: null,       // us_summary.json (national distribution stats)
  caSummary: null,     // atlas_summary.json (CA case-study stats: Moran, HOLC gradient)
  variable: "median_hh_income",
  classifier: "quantile",
};
