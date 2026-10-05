// Reproducible, bounded supplement to the existing snapshot. No credentials.
// Run from the repository root: node scripts/12_diabetes_evidence.mjs
import fs from 'node:fs/promises';
const endpoint = 'https://data.cdc.gov/resource/swc5-untb.json';
const query = new URLSearchParams({
  '$select': 'locationid,year,datavaluetypeid,data_value,low_confidence_limit,high_confidence_limit,totalpop18plus',
  '$where': "measureid='DIABETES' AND year='2023'",
  '$limit': '10000', '$order': 'locationid,datavaluetypeid',
});
const response = await fetch(`${endpoint}?${query}`, {signal: AbortSignal.timeout(30000)});
if (!response.ok) throw new Error(`CDC ${response.status}`);
const records = await response.json();
if (records.length >= 10000 || records.length < 5800) throw new Error('Unexpected coverage or possible truncation');
const county = {};
for (const r of records) {
  const kind = {CrdPrv:'crude',AgeAdjPrv:'adjusted'}[r.datavaluetypeid];
  if (!kind) throw new Error('Unexpected prevalence type');
  const entry = county[r.locationid] ||= {adult_population:Number(r.totalpop18plus)};
  if (Object.hasOwn(entry,kind)) throw new Error('Duplicate geography and estimate type');
  if (r.data_value == null) { entry[kind] = null; continue; }
  const v = [r.data_value,r.low_confidence_limit,r.high_confidence_limit].map(Number);
  if (!v.every(Number.isFinite) || v[1] > v[0] || v[2] < v[0]) throw new Error('Invalid interval');
  entry[kind] = {estimate:v[0],low:v[1],high:v[2]};
}
const atlas = JSON.parse(await fs.readFile('app/public/data/us_counties.min.geojson','utf8'));
let matched = 0;
for (const {properties:p} of atlas.features) {
  if (p.diabetes_pct == null) continue;
  if (county[p.GEOID]?.crude.estimate !== p.diabetes_pct) throw new Error(`Snapshot mismatch: ${p.GEOID}`);
  if (!county[p.GEOID].adjusted) throw new Error(`Missing standardized estimate: ${p.GEOID}`);
  matched++;
}
const result = {source:endpoint,query:query.toString(),release:'2025',survey_year:2023,
  accessed:new Date().toISOString(),matched_existing:matched,
  description:'Diabetes crude and age-adjusted prevalence with CDC model-based 95% confidence intervals; not intervals for Atlas regression coefficients.',county};
await fs.writeFile('app/public/data/diabetes_evidence.json',JSON.stringify(result));
console.log(`${matched} existing county values exactly reproduced; ${Object.keys(county).length} source geographies with intervals.`);
