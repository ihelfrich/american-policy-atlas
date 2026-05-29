"""
Phase H3 — research-network dispatch feed.

The atlas is one node in a federated network of Ian Helfrich's public research
observatories. Rather than scrape each sibling's (undocumented, drifting) live
data endpoints from the browser — which would ship broken cards and risks
surfacing numbers we can't verify — we keep a curated, version-controlled
manifest of real, public sibling sites and enrich it at build time with two
honest, checkable facts: whether the site is currently live, and when its repo
was last pushed. A daily GitHub Actions cron re-runs this so liveness and
freshness stay current.

Each node links out to a sibling observatory and back to the hub. The "signal"
line is a hand-written, true one-liner describing what that node tracks; we never
fabricate a live metric here.

Writes: app/public/data/dispatch.json
"""
from pathlib import Path
from datetime import datetime, timezone
import json
import urllib.request
import urllib.error

BASE = Path(__file__).resolve().parents[1]
APP = BASE / "app" / "public" / "data"
APP.mkdir(parents=True, exist_ok=True)

OWNER = "ihelfrich"
HUB = "https://ihelfrich.github.io/"

# Curated network. Every entry is a real, PUBLIC repo with a live GitHub Pages
# site (private repos are excluded — their Pages 404 for visitors). Blurbs are
# drawn from each repo's own description; signals are hand-written and true.
NODES = [
    {
        "repo": "worldscope",
        "title": "WorldScope",
        "url": "https://ihelfrich.github.io/worldscope/",
        "blurb": "Daily global political, economic, and OSINT briefing engine.",
        "signal": "Tracks ~18 sections of open-source signal — executive orders, sanctions, markets, conflict — into one daily diff.",
        "tags": ["osint", "briefing", "daily"],
    },
    {
        "repo": "econscope",
        "title": "EconScope",
        "url": "https://ihelfrich.github.io/econscope/",
        "blurb": "Unified economic-intelligence platform: 50+ data sources, a DuckDB warehouse, full audit trail.",
        "signal": "The data spine — FRED, BEA, BLS, Census and more, normalized and queryable, that feeds the rest of the network.",
        "tags": ["economics", "data", "warehouse"],
    },
    {
        "repo": "stl-digital-twin",
        "title": "St. Louis Digital Twin",
        "url": "https://ihelfrich.github.io/stl-digital-twin/",
        "blurb": "A 3D digital twin of St. Louis — live aircraft, transit, traffic, and weather on CesiumJS.",
        "signal": "A live city model: the same place the atlas uses for its Delmar Divide case study, rendered as a real-time research instrument.",
        "tags": ["geospatial", "st-louis", "real-time"],
    },
    {
        "repo": "redlining-health-la",
        "title": "Redlining & Health, LA",
        "url": "https://ihelfrich.github.io/redlining-health-la/",
        "blurb": "Interactive stats practicum: 1939 LA HOLC grades against present-day census-tract health.",
        "signal": "The single-city practicum this national atlas grew out of — the redlining flagship in its original Los Angeles form.",
        "tags": ["redlining", "practicum", "teaching"],
    },
    {
        "repo": "hantavirus-observatory",
        "title": "Hantavirus Observatory",
        "url": "https://ihelfrich.github.io/hantavirus-observatory/",
        "blurb": "A 16-panel epidemiological SPA: case surveillance, wastewater signals, genomic phylogeny, and composite outbreak risk.",
        "signal": "Shows the observatory pattern applied to disease surveillance — the same scrollytelling-plus-live-data shape as this atlas.",
        "tags": ["epidemiology", "surveillance", "observatory"],
    },
    {
        "repo": "eo14405-contagion",
        "title": "EO 14405 Contagion",
        "url": "https://ihelfrich.github.io/eo14405-contagion/",
        "blurb": "A network-contagion model of how EO 14405 shifts stablecoin run-risk from commercial banks onto the Fed's balance sheet.",
        "signal": "Network methods on a financial-stability question — the graph-theory side of the toolkit this atlas teaches spatially.",
        "tags": ["networks", "finance", "contagion"],
    },
    {
        "repo": "us-nmtc-viewer",
        "title": "US NMTC Viewer",
        "url": "https://ihelfrich.github.io/us-nmtc-viewer/",
        "blurb": "Every New Markets Tax Credit project, FY2001–2022, as a browser-based Cesium viewer.",
        "signal": "The blended-finance dataset behind Helfrich (2026) on the rural mobilization gap.",
        "tags": ["dataset", "blended-finance", "viewer"],
    },
    {
        "repo": "inference-lab",
        "title": "Inference Lab",
        "url": "https://ihelfrich.github.io/inference-lab/",
        "blurb": "Applied causal inference for the spatial social sciences: DiD, RDD, IV, synthetic control, networks, R and Stata side by side.",
        "signal": "Where the methods this atlas demonstrates get their full causal-inference treatment.",
        "tags": ["causal-inference", "methods", "textbook"],
    },
    {
        "repo": "metric-sovereignty",
        "title": "Metric Sovereignty",
        "url": "https://ihelfrich.github.io/metric-sovereignty/",
        "blurb": "Social choice, AI directives, and capitalist democracy — a living essay.",
        "signal": "The theory end of the network: what it means to govern by a metric, when every map here is one.",
        "tags": ["social-choice", "ai-governance", "essay"],
    },
]

UA = {"User-Agent": "atlas-dispatch-builder (+https://ihelfrich.github.io/american-policy-atlas/)"}


def check_live(url, timeout=12):
    """True if the URL responds 2xx/3xx. Best-effort; network failure -> None."""
    req = urllib.request.Request(url, headers=UA, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return 200 <= r.status < 400
    except urllib.error.HTTPError as e:
        return 200 <= e.code < 400
    except Exception:
        return None


def repo_pushed_at(repo, timeout=12):
    """Last push date (YYYY-MM-DD) from the public GitHub API; None on failure."""
    url = f"https://api.github.com/repos/{OWNER}/{repo}"
    req = urllib.request.Request(url, headers={**UA, "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.load(r)
        return (data.get("pushed_at") or "")[:10] or None
    except Exception:
        return None


def main():
    out = []
    for n in NODES:
        live = check_live(n["url"])
        pushed = repo_pushed_at(n["repo"])
        out.append({
            "repo": n["repo"],
            "title": n["title"],
            "url": n["url"],
            "repo_url": f"https://github.com/{OWNER}/{n['repo']}",
            "blurb": n["blurb"],
            "signal": n["signal"],
            "tags": n["tags"],
            # `live` is None when the check itself failed (offline build): the UI
            # treats None as "unknown" and still renders the card.
            "live": live,
            "updated": pushed,
        })
        flag = {True: "live", False: "down", None: "unknown"}[live]
        print(f"  [{n['repo']:24}] {flag:7} pushed={pushed}")

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "hub": HUB,
        "note": (
            "Curated manifest of Ian Helfrich's public research observatories. "
            "Liveness and last-push dates are checked at build time; signal lines "
            "are descriptive, not live metrics."
        ),
        "nodes": out,
    }
    dest = APP / "dispatch.json"
    dest.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"[dispatch] wrote {len(out)} nodes -> {dest}")


if __name__ == "__main__":
    main()
