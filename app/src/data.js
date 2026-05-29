// Data loading + shared state for the atlas.
const BASE = import.meta.env.BASE_URL;

export async function loadJSON(name) {
  const r = await fetch(`${BASE}data/${name}`);
  if (!r.ok) throw new Error(`failed to load ${name}: ${r.status}`);
  return r.json();
}

// Variable catalogue: id -> {label, desc, fmt, palette, source}
export const VARS = {
  pop_density_km2: { label: "Population density", unit: "people / km²", source: "ACS 2018–22 + TIGER land area", palette: "viridis", log: true,
    desc: "People per square kilometre: county population divided by its land area. Runs across four orders of magnitude, from empty western counties to Manhattan." },
  median_hh_income: { label: "Median household income", unit: "$", source: "ACS 2018–22", palette: "greens",
    desc: "Median household income, American Community Survey five-year estimate." },
  pct_poverty: { label: "Poverty rate", unit: "%", source: "ACS 2018–22", palette: "reds",
    desc: "Share of people below the federal poverty line." },
  pct_hispanic: { label: "Hispanic / Latino share", unit: "%", source: "ACS 2018–22", palette: "purples",
    desc: "Share of residents identifying as Hispanic or Latino." },
  pct_black: { label: "Black share", unit: "%", source: "ACS 2018–22", palette: "blues",
    desc: "Share of residents identifying as Black or African American." },
  pct_bachelor_plus: { label: "Bachelor's degree +", unit: "%", source: "ACS 2018–22", palette: "teal",
    desc: "Share of adults 25+ with a bachelor's degree or higher." },
  pct_unemployed: { label: "Unemployment", unit: "%", source: "ACS 2018–22", palette: "oranges",
    desc: "Unemployed share of the civilian labor force." },
  pct_uninsured: { label: "Uninsured", unit: "%", source: "ACS S2701", palette: "reds",
    desc: "Share of the population without health insurance (subject table S2701)." },
  pct_renter: { label: "Renter share", unit: "%", source: "ACS 2018–22", palette: "oranges",
    desc: "Share of occupied housing units that are renter-occupied." },
  diabetes_pct: { label: "Diabetes prevalence", unit: "%", source: "CDC PLACES 2025", palette: "reds",
    desc: "Model-based estimate of diagnosed diabetes among adults." },
  obesity_pct: { label: "Obesity prevalence", unit: "%", source: "CDC PLACES 2025", palette: "reds",
    desc: "Model-based estimate of adult obesity (BMI ≥ 30)." },
  hypertension_pct: { label: "High blood pressure", unit: "%", source: "CDC PLACES 2025", palette: "reds",
    desc: "Model-based estimate of adult high blood pressure." },
};

// color ramps (5-class), low -> high
export const RAMPS = {
  viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  greens: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"],
  reds: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"],
  blues: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
  purples: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"],
  oranges: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"],
  teal: ["#edf8fb", "#b2e2e2", "#66c2a4", "#2ca25f", "#006d2c"],
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
