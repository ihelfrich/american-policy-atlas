# Atlas audit and revision, October 5, 2026

This revision makes the existing prototype a question-led learning tool. It does not establish external validation, refresh source data, or complete the entire lesson library.

## Findings and corrections

| Finding | Cause and consequence | Correction and preventive check |
|---|---|---|
| Unsupported avoided-case totals | Adult modeled prevalence was multiplied by total population, then a descriptive gap was presented as an intervention effect. | Removed case counts. The slider now closes explicitly hypothetical gaps between equal-count poverty groups; tests cover both endpoints and absence of case totals. |
| Misleading empirical Bayes demonstration | County population was treated as survey sample size for already modeled PLACES estimates. | Replaced with a hypothetical normal-model demonstration with explicit uncertainty; tested analytical weights and invalid inputs. |
| Hidden health coverage gaps | Missing joined records disappeared from summaries without a prominent explanation. | Show available/total counts and excluded pairs. Tests assert 2,956 health observations of 3,144 geographies and the 188 missing records: Kentucky 120, Pennsylvania 67, Texas 1. The cause of each source omission remains unresolved. |
| Overstated causal interpretation | Adjusted associations and a descriptive policy slider implied mediation or effects. | Reworded lessons, methods, and assistant corpus; clarify ecological inference, modeled outcomes, source periods, and equal county weights. |
| Inconsistent statistical presentation | Raw-scale fits appeared on a log axis; even-sized medians used one middle observation; Monte Carlo p-values were overstated. | Match fit and axes, use the mean of two central values, and report the stored Moran p-value as 0.001. Tests cover known fits, missingness, and degenerate scopes. |
| Product claims exceeded implementation | The landing page presented an extensive completed curriculum and blanket author verification. | Present a working prototype with three usable investigations; retain unfinished chapters as reading notes. Remove the unsupported verification claim. |
| Map projection failure during revision | GeoJSON ring winding differed from the D3 spherical convention. | Reverse copied polygon rings for display, leaving source data intact; visually checked the national map. |

## Experience added

Three starting questions cover prosperity and health, income and housing burden, and poverty and broadband. Each has a linked county map, scatterplot, state and variable selectors, two-place comparison, source notes, alternative-explanation prompts, locally saved notes, complete-case CSV export, and shareable view URLs. The landing page, navigation, mobile layout, focus treatment, and reduced-motion behavior were revised.

## Verification

- Seven automated tests pass, including all 33 stored variable means and nonmissing counts, unique geography IDs, analytical calculations, and CSV quoting.
- Production build succeeds with the GitHub Pages repository base path. Deployment runs tests before building.
- Browser checks passed for national and state scopes, an entirely missing health state, question changes, county search and comparisons, copyable URLs and reload persistence, both corrected sliders, locally persisted notes, and mobile width at 390px without horizontal overflow.
- No browser console errors observed during these checks. These are focused checks, not exhaustive accessibility or cross-browser certification.
- CSV generation is unit tested. The in-app browser did not return a completed download event, so end-to-end file download remains unverified there.

## Remaining limits and next work

The data remains the existing ACS 2018–2022 / PLACES 2025-release snapshot. Source survey periods, adult denominators, geographic vintages, and model predictors need careful alignment before any substantive research claim. Confidence intervals and ACS margins of error are not shipped; the UI states this. The upstream extraction and geospatial modeling pipeline was not rerun. The missing health records should be traced to the source/join before the next data release. Advanced lessons remain uneven, and the existing assistant and WebGL atlas retain their prior architecture. This revision is appropriate for demonstrating exploratory teaching, not causal policy evaluation.

The revision is local pending Dr. Helfrich's review and publication approval. No Bruce Cahan email was sent.
