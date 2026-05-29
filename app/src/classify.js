// Choropleth classification: quantile, equal-interval, and Jenks (natural breaks).
// Returns an array of 4 break values that split data into 5 classes.

function clean(values) {
  return values.filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
}

export function quantileBreaks(values, k = 5) {
  const s = clean(values);
  const br = [];
  for (let i = 1; i < k; i++) br.push(s[Math.floor((i / k) * s.length)]);
  return br;
}

export function equalBreaks(values, k = 5) {
  const s = clean(values);
  const lo = s[0], hi = s[s.length - 1], step = (hi - lo) / k;
  const br = [];
  for (let i = 1; i < k; i++) br.push(lo + i * step);
  return br;
}

// Jenks natural breaks (Fisher-Jenks), classic dynamic-programming version.
export function jenksBreaks(values, k = 5) {
  let s = clean(values);
  // subsample for speed if huge
  if (s.length > 3000) {
    const step = Math.ceil(s.length / 3000);
    s = s.filter((_, i) => i % step === 0);
  }
  const n = s.length;
  if (n <= k) return quantileBreaks(values, k);
  const mat1 = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  const mat2 = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity));
  for (let i = 1; i <= k; i++) { mat1[1][i] = 1; mat2[1][i] = 0; }
  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1;
      const val = s[i3 - 1];
      s2 += val * val; s1 += val; w += 1;
      const variance = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= k; j++) {
          if (mat2[l][j] >= variance + mat2[i4][j - 1]) {
            mat1[l][j] = i3;
            mat2[l][j] = variance + mat2[i4][j - 1];
          }
        }
      }
    }
    mat1[l][1] = 1; mat2[l][1] = s2 - (s1 * s1) / w;
  }
  const br = [];
  let kk = n;
  for (let j = k; j >= 2; j--) {
    const id = mat1[kk][j] - 1;
    br.push(s[id]);
    kk = mat1[kk][j] - 1;
  }
  return br.reverse();
}

export function breaksFor(method, values) {
  if (method === "equal") return equalBreaks(values);
  if (method === "jenks") return jenksBreaks(values);
  return quantileBreaks(values);
}

// build a maplibre 'step' color expression from breaks + ramp.
// MapLibre's `step` requires strictly ascending stops, but tie-heavy or capped
// variables can yield duplicate quantile breaks. Collapse duplicates and pair
// each surviving break with its ramp color so the expression stays valid.
export function stepExpression(prop, breaks, ramp) {
  const stops = [];
  let last = -Infinity;
  breaks.forEach((b, i) => {
    if (Number.isFinite(b) && b > last) { stops.push([b, ramp[i + 1]]); last = b; }
  });
  const step = ["step", ["to-number", ["get", prop]], ramp[0]];
  stops.forEach(([b, c]) => { step.push(b, c); });
  return ["case", ["==", ["get", prop], null], "#d8d8d2", step];
}

export function fmtVal(v, unit) {
  if (v == null || !Number.isFinite(v)) return "n/a";
  if (unit === "$") return "$" + Math.round(v).toLocaleString();
  if (unit === "people / km²") return Math.round(v).toLocaleString();
  if (unit === "%") return v.toFixed(1) + "%";
  return v.toLocaleString();
}
