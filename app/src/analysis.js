// Descriptive calculations shared by the investigation and its regression tests.
// Every county has equal weight. Missing values never become zero.
export const number = value => value == null || value === '' ? NaN : Number(value);
export const finite = value => Number.isFinite(number(value));
export const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function median(values) {
  const a = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!a.length) return null;
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}
export function summarize(rows, key) {
  const values = rows.map(r => number(r[key])).filter(Number.isFinite);
  return { n: values.length, missing: rows.length - values.length, mean: mean(values), median: median(values) };
}
export function relationship(rows, xKey, yKey) {
  const points = rows.filter(r => finite(r[xKey]) && finite(r[yKey])).map(r => ({ ...r, x: number(r[xKey]), y: number(r[yKey]) }));
  const mx = mean(points.map(r => r.x)), my = mean(points.map(r => r.y));
  let xx = 0, yy = 0, xy = 0;
  for (const r of points) { xx += (r.x - mx) ** 2; yy += (r.y - my) ** 2; xy += (r.x - mx) * (r.y - my); }
  const valid = points.length >= 3 && xx > 0 && yy > 0;
  return { points, n: points.length, excluded: rows.length - points.length,
    r: valid ? xy / Math.sqrt(xx * yy) : null,
    slope: valid ? xy / xx : null, intercept: valid ? my - xy / xx * mx : null };
}
export function gapScenario(rows, fraction) {
  const a = rows.filter(r => finite(r.pct_poverty) && finite(r.diabetes_pct)).sort((a,b) => number(a.pct_poverty) - number(b.pct_poverty) || String(a.GEOID).localeCompare(String(b.GEOID)));
  if (a.length < 5) return [];
  const bins = Array.from({length:5}, (_, i) => {
    const bin = a.slice(Math.floor(i * a.length / 5), Math.floor((i + 1) * a.length / 5));
    return { group: `Q${i + 1}`, n: bin.length, observed: mean(bin.map(r => number(r.diabetes_pct))) };
  });
  const share = Math.max(0, Math.min(1, fraction));
  return bins.map(b => ({...b, scenario: b.observed - Math.max(0, b.observed - bins[0].observed) * share }));
}
export function normalPosterior(observed, se, priorMean, priorSD) {
  if (![observed,se,priorMean,priorSD].every(Number.isFinite) || se < 0 || priorSD <= 0) throw new Error('Invalid normal model parameters');
  const weight = priorSD ** 2 / (priorSD ** 2 + se ** 2);
  return { weight, mean: weight * observed + (1 - weight) * priorMean };
}
export function csv(rows, columns) {
  const cell = x => `"${String(x ?? '').replaceAll('"', '""')}"`;
  return [columns.map(cell).join(','), ...rows.map(r => columns.map(k => cell(r[k])).join(','))].join('\r\n');
}
