"""Build the assistant's retrieval corpus.

The research-assistant panel answers questions grounded ONLY in this corpus: the
module narratives, the live national statistics, and the reading-room papers. It
is written here (not scraped from the built site) so the grounding text is stable
and reviewable. Output: app/public/data/corpus.json.

Run:  python scripts/80_build_corpus.py
"""
import json
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "app" / "public" / "data"


def load(name):
    return json.loads((DATA / name).read_text())


def fmt_money(x):
    return "$" + format(round(x), ",")


def main():
    summary = load("us_summary.json")
    papers = load("papers.json")
    vs = summary.get("varstats", {})
    moran = summary.get("moran", {})

    chunks = []

    def add(cid, section, title, text, url=""):
        chunks.append({"id": cid, "section": section, "title": title,
                       "text": " ".join(text.split()), "url": url})

    # --- what the atlas is ---
    add("about", "Overview", "What the American Policy Atlas is",
        f"""The American Policy Atlas is a teaching observatory for statistics built on every
        county in the United States: {summary.get('n_counties', 3144):,} counties across
        {summary.get('n_states', 51)} states and DC. It teaches a full statistics sequence —
        reading a choropleth, distributions, conditional expectations, regression, statistical
        inference, spatial dependence, and Bayesian shrinkage — with every method computed in the
        browser from the same national dataset. The 1939 HOLC redlining story in Los Angeles, at
        census-tract resolution, is the flagship case study. Data come from the U.S. Census ACS
        2018-2022, CDC PLACES, BLS, BEA, WorldPop, and the University of Richmond's Mapping
        Inequality project.""", "#home")

    add("data-sources", "Overview", "Where the data come from",
        """Demographics and economics are American Community Survey 2018-2022 five-year estimates:
        median household income, poverty, education, race and ethnicity, unemployment, housing
        tenure and rent burden, and health insurance from subject table S2701. Health outcomes —
        adult diabetes, obesity, and high blood pressure prevalence — are CDC PLACES model-based
        county estimates. County and tract geometry is Census TIGER/Line 2023. The redlining grades
        are from Mapping Inequality (University of Richmond), digitizing the 1939 HOLC maps.""",
        "#methods")

    # --- module concepts ---
    add("m1-classification", "Reading a map", "Choropleth classification (quantile, equal, Jenks)",
        """A choropleth colors each area by a number, but the same numbers tell different stories
        depending on where the color breaks fall. Quantile classification puts an equal count of
        counties in each color, which flatters skewed variables like income. Equal-interval uses
        equal value widths and is honest about magnitude but can leave classes empty. Jenks finds
        natural breaks that minimize within-class variance. None is uniquely correct; classification
        is an assumption a good analyst states out loud.""", "#m1")

    inc = vs.get("median_hh_income", {})
    add("m2-distributions", "Distributions", "Distributions, mean vs. median, and skew",
        f"""A distribution is the full answer to how often each value happens. Across the counties,
        median household income has a median of {fmt_money(inc.get('median', 0))} and a mean of
        {fmt_money(inc.get('mean', 0))}. The mean sits to the right of the median because the
        distribution is right-skewed: a long tail of high-income counties drags the balance point
        upward. The median splits counties into two equal halves; the mean is the balance point.
        That mean-median gap is the skew, and it is why the choice of color breaks matters.""",
        "#m2")

    add("m3-cef", "Conditional expectations", "E[Y|X] and the binscatter",
        """A conditional expectation, written E[Y given X], answers: for counties at a given income,
        what is the average diabetes rate? It is the most useful object in applied statistics. The
        atlas approximates it nonparametrically with a binscatter — sort counties by income, chop
        into bins, plot the average outcome in each bin — letting the data choose its own shape.
        Regression is just the straight-line summary of this same cloud.""", "#m3")

    add("m4-regression", "Regression", "Regression and what a control does",
        """The atlas fits diabetes prevalence on county median income, then adds present-day poverty
        as a control. The income slope shrinks substantially but does not vanish. Much of income's
        apparent link to diabetes runs through poverty, yet an independent association survives:
        income and poverty are correlated, not interchangeable. A control lets the regression keep
        the part of each variable that the other cannot explain. This is description, not a causal
        claim.""", "#m4")

    db = vs.get("diabetes_pct", {})
    add("m5-inference", "Statistical inference", "Sampling distributions, confidence intervals, hypothesis tests",
        f"""Treat all county diabetes rates as the population (mean about {db.get('mean', 0):.1f}%),
        then draw thousands of random samples and record each sample mean. The resulting sampling
        distribution is nearly normal even though county values are skewed — the Central Limit
        Theorem — and its spread is the standard error sigma over root-n, not the population standard
        deviation. A 95% confidence interval is one sample's mean plus or minus about two standard
        errors. A hypothesis test asks whether an observed gap exceeds that yardstick. The atlas
        contrasts Census-South counties against the rest and finds a difference far past any
        conventional threshold: the diabetes belt is not sampling noise.""", "#m5")

    add("m6-spatial", "Spatial dependence", "Moran's I and spatial autocorrelation",
        f"""Tobler's first law: near things are more related than distant things. Moran's I measures
        this by correlating each county's value with the average of its neighbors (its spatial lag).
        Neighbors are counties sharing a border (queen contiguity), built from the full-resolution
        Census boundary file. For adult diabetes the atlas computes Moran's I =
        {moran.get('I', 0.60):.3f} (permutation p = {moran.get('perm_p', 0.001)}), across
        {moran.get('n', 0):,} contiguous counties averaging {moran.get('mean_neighbors', 5.9)}
        neighbors each. That is strong positive spatial autocorrelation: regression residuals pool
        on the map rather than scattering, which is why a single OLS line understates uncertainty and
        why spatial models exist.""", "#m6")

    add("m7-bayes", "Bayesian thinking", "Empirical-Bayes shrinkage and small-area estimation",
        """A county of 500 people with a 20% diabetes rate is built on almost nothing. Empirical-Bayes
        small-area estimation pulls each noisy local rate toward the population-weighted national mean,
        in proportion to how little information the county carries. The posterior mean is a
        precision-weighted average: theta-hat = w*y + (1-w)*mu, with weight w = tau-squared /
        (tau-squared + v). Here v is the county's own sampling variance (large for tiny counties) and
        tau-squared is the genuine between-county variance, estimated by method of moments. Small
        counties move a lot; large counties barely budge. This is the Fay-Herriot logic behind
        official model-based small-area releases.""", "#m7")

    add("m8-policy", "Policy", "Counterfactual projection from conditional means",
        """Sort counties into five equal groups by poverty rate; diabetes climbs steadily from the
        lowest-poverty quintile to the highest. The atlas asks a transparent what-if: if a place-based
        investment closed half of each quintile's gap to the healthiest group, how many fewer adults
        would have diabetes? It applies that reduction to each quintile and counts avoided cases,
        weighting by population. This is not causal proof — it is a counterfactual built openly on the
        conditional means computed throughout the atlas. Good forecasting shows its assumptions.""",
        "#m8")

    add("redlining", "Flagship", "The 1939 redlining case study",
        """The flagship case study maps the 1939 HOLC redlining grades of Los Angeles at census-tract
        resolution and lays them beside present-day health and economic outcomes. Tracts graded "D"
        (colored red, "hazardous") in 1939 still show measurably worse outcomes today. The atlas links
        this to a national literature — most directly Aaronson, Hartley and Mazumder's
        boundary-discontinuity estimate of what the HOLC maps caused — and treats the local gradient
        as one legible instance of the spatial clustering measured nationally with Moran's I.""",
        "#redlining")

    add("methods-spatial", "Methods", "How spatial contiguity is computed",
        """Moran's I uses queen contiguity: counties sharing any boundary point are neighbors. Weights
        are row-standardized and significance comes from a 999-draw permutation null. Critically,
        contiguity is computed on the unsimplified TIGER geometry, not the simplified web map —
        simplifying boundaries breaks the shared edges and destroys the neighbor graph. Alaska and
        Hawaii are excluded because their counties have no land neighbors.""", "#methods")

    add("reproducibility", "Methods", "Reproducibility and the build pipeline",
        """Every figure is reproducible from the scripts directory: script 11 assembles the national
        county layer from ACS and CDC PLACES, script 12 computes spatial dependence on the raw TIGER
        shapefile. Inference demos resample county values with a fixed random seed so every figure is
        identical across reloads. The California tracts and redlining case study retain their own
        tract-level pipeline (scripts 10 through 60).""", "#methods")

    # --- papers ---
    for i, p in enumerate(papers.get("papers", [])):
        doi = p.get("doi", "")
        url = f"https://doi.org/{doi}" if doi else p.get("url", "")
        add(f"paper-{i}", "Reading room", f"{p.get('authors','')} ({p.get('year','')}): {p.get('title','')}",
            f"""{p.get('title','')} by {p.get('authors','')}, {p.get('venue','')} ({p.get('year','')}).
            Theme: {p.get('theme','')}. {p.get('hook','')}""", url)

    out = {"generated": date.today().isoformat(),
           "note": "Grounding corpus for the research-assistant panel. Built by scripts/80_build_corpus.py.",
           "chunks": chunks}
    (DATA / "corpus.json").write_text(json.dumps(out, ensure_ascii=False))
    print(f"wrote {len(chunks)} chunks -> {DATA / 'corpus.json'}")


if __name__ == "__main__":
    main()
