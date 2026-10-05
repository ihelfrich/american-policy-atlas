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
        50 states and DC. It offers a developing lesson library —
        reading a choropleth, distributions, conditional expectations, regression, statistical
        inference, spatial dependence, and Bayesian shrinkage — with selected examples computed in the browser; many chapters remain reading notes. The 1939 HOLC redlining story in Los Angeles, at
        census-tract resolution, is the flagship case study. Data come from the U.S. Census ACS
        2018-2022, CDC PLACES, BLS, BEA, WorldPop, and the University of Richmond's Mapping
        Inequality project.""", "#/")

    add("data-sources", "Overview", "Where the data come from",
        """Demographics and economics are American Community Survey 2018-2022 five-year estimates:
        median household income, poverty, education, race and ethnicity, unemployment, housing
        tenure and rent burden, and health insurance from subject table S2701. Health outcomes —
        adult diabetes, obesity, and high blood pressure prevalence — are CDC PLACES model-based
        county estimates. County and tract geometry is Census TIGER/Line 2023. The redlining grades
        are from Mapping Inequality (University of Richmond), digitizing the 1939 HOLC maps.""",
        "#/apparatus/methods")

    # --- module concepts ---
    add("m1-classification", "Reading a map", "Choropleth classification (quantile, equal, Jenks)",
        """A choropleth colors each area by a number, but the same numbers tell different stories
        depending on where the color breaks fall. Quantile classification puts an equal count of
        counties in each color, which flatters skewed variables like income. Equal-interval uses
        equal value widths and is honest about magnitude but can leave classes empty. Jenks finds
        natural breaks that minimize within-class variance. None is uniquely correct; classification
        is an assumption a good analyst states out loud.""", "#/s1/data")

    inc = vs.get("median_hh_income", {})
    add("m2-distributions", "Distributions", "Distributions, mean vs. median, and skew",
        f"""A distribution is the full answer to how often each value happens. Across the counties,
        median household income has a median of {fmt_money(inc.get('median', 0))} and a mean of
        {fmt_money(inc.get('mean', 0))}. The mean sits to the right of the median because the
        distribution is right-skewed: a long tail of high-income counties drags the balance point
        upward. The median splits counties into two equal halves; the mean is the balance point.
        That mean-median gap is the skew, and it is why the choice of color breaks matters.""",
        "#/s1/distributions")

    add("m3-cef", "Conditional expectations", "E[Y|X] and the binscatter",
        """A conditional expectation, written E[Y given X], answers: for counties at a given income,
        what is the average diabetes rate? It is the most useful object in applied statistics. The
        atlas approximates it nonparametrically with a binscatter — sort counties by income, chop
        into bins, plot the average outcome in each bin — letting the data choose its own shape.
        Regression is just the straight-line summary of this same cloud.""", "#/s1/conditional-expectations")

    add("m4-regression", "Methods", "m4 regression",
        "The atlas fits diabetes estimates on income, then adjusts for poverty in the same complete-case sample. A changed coefficient is a conditional association, not proof of mediation or causation. PLACES uses socioeconomic predictors, so model construction may contribute to the association.", "#/s2/regression")

    db = vs.get("diabetes_pct", {})
    add("m5-inference", "Methods", "m5 inference",
        "The simulation draws available county diabetes estimates independently with replacement from a fixed finite population. It illustrates sampling variation, not uncertainty in CDC estimates. The descriptive South versus other counties contrast does not provide calibrated significance under spatial dependence and missing data.", "#/s1/sampling")

    add("m6-spatial", "Methods", "m6 spatial",
        "Moran’s I is 0.6025 for raw diabetes estimates on 2,921 connected counties in this snapshot, with a one-sided permutation p of 0.001 from 999 permutations. It is not a test of regression residuals. Missing states affect the graph.", "#/spatial/dependence")

    add("m7-bayes", "Methods", "m7 bayes",
        "The shrinkage lesson is a hypothetical normal-normal model. The prior mean is 12 percent with standard deviation 3 percentage points, and the observed estimate is 20 percent. The reader varies measurement standard error. Population is not sample size, and this is not a re-estimation of PLACES.", "#/s1/bayes")

    add("m8-policy", "Methods", "m8 policy",
        "The scenario sorts complete-case counties into poverty quintiles and calculates unweighted mean county diabetes estimates. A slider closes an assumed fraction of positive gaps above the lowest-poverty group. Results are descriptive percentage points, not intervention effects or avoided cases.", "#/spatial/policy")

    add("redlining", "Methods", "redlining",
        "The Los Angeles case compares modern tract health estimates grouped by the dominant historical HOLC grade. Modern tracts and historical neighborhoods differ. This descriptive comparison does not identify the causal effect of grading. Consult the linked research papers for their separate identification strategies.", "#/spatial/redlining")

    add("methods-spatial", "Methods", "methods spatial",
        "Queen weights are constructed using full-resolution county geometry. The pipeline excludes Alaska and Hawaii as a regional scope choice and drops zero-neighbor units; not all counties in those states lack land neighbors. The 999-draw permutation statistic is for raw diabetes estimates, not residuals.", "#/apparatus/methods")

    add("reproducibility", "Methods", "Reproducibility and the build pipeline",
        """Every figure is reproducible from the scripts directory: script 11 assembles the national
        county layer from ACS and CDC PLACES, script 12 computes spatial dependence on the raw TIGER
        shapefile. Inference demos resample county values with a fixed random seed so every figure is
        identical across reloads. The California tracts and redlining case study retain their own
        tract-level pipeline (scripts 10 through 60).""", "#/apparatus/methods")

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
