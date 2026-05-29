"""
Phase F — RSS snapshot for the atlas "Live wire" panel.

Client-side RSS is unreliable (CORS, rate limits), so we pull at build time and
freeze a compact JSON the frontend can fetch statically. A daily GitHub Actions
cron re-runs this to keep the snapshot fresh.

Feeds are grouped into three lanes the UI renders as columns:
  data     official statistical-agency release calendars / news
  research new working papers and policy briefs
  news     general economics + California policy coverage

Writes: app/public/data/feeds.json
"""
from pathlib import Path
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import re
import feedparser

BASE = Path(__file__).resolve().parents[1]
APP = BASE / "app" / "public" / "data"
APP.mkdir(parents=True, exist_ok=True)

# (lane, source label, url). Lane drives which column the item lands in.
FEEDS = [
    # ---- official data releases -------------------------------------------
    ("data", "BLS", "https://www.bls.gov/feed/bls_latest.rss"),
    ("data", "BEA", "https://apps.bea.gov/rss/rss.xml"),
    ("data", "Census Bureau", "https://www.census.gov/economic-indicators/indicator.xml"),
    ("data", "Census Newsroom", "https://www.census.gov/newsroom/press-releases.xml"),
    ("data", "Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ("data", "FRED Blog", "https://fredblog.stlouisfed.org/feed/"),
    ("data", "CA Dept of Finance", "https://dof.ca.gov/feed/"),
    # ---- research / working papers ----------------------------------------
    ("research", "NBER New Working Papers", "https://back.nber.org/rss/new.xml"),
    ("research", "SF Fed Economic Letter", "https://www.frbsf.org/feed/?post_type=economic-letter"),
    ("research", "PPIC", "https://www.ppic.org/feed/"),
    # ---- general economics + CA policy news -------------------------------
    ("news", "CalMatters", "https://calmatters.org/feed/"),
    ("news", "LA Times California", "https://www.latimes.com/california/rss2.0.xml"),
    ("news", "The Economist Finance", "https://www.economist.com/finance-and-economics/rss.xml"),
]

# Some agencies (BLS) hard-block automated clients; a browser UA recovers the rest.
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")

PER_FEED = 6          # max items kept per feed
SNIPPET_CHARS = 220   # summary truncation
TAG_RE = re.compile(r"<[^>]+>")


def clean(text: str) -> str:
    if not text:
        return ""
    text = TAG_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:SNIPPET_CHARS] + ("…" if len(text) > SNIPPET_CHARS else "")


def iso_date(entry):
    for key in ("published", "updated", "pubDate"):
        val = entry.get(key)
        if val:
            try:
                dt = parsedate_to_datetime(val)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).isoformat()
            except (TypeError, ValueError):
                pass
    if entry.get("published_parsed"):
        try:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
        except (TypeError, ValueError):
            pass
    return None


lanes = {"data": [], "research": [], "news": []}
ok, fail = [], []

for lane, source, url in FEEDS:
    try:
        parsed = feedparser.parse(url, agent=UA)
        entries = parsed.entries[:PER_FEED]
        if not entries:
            fail.append(source)
            continue
        for e in entries:
            lanes[lane].append({
                "source": source,
                "title": clean(e.get("title", "")),
                "url": e.get("link", ""),
                "date": iso_date(e),
                "summary": clean(e.get("summary", "") or e.get("description", "")),
            })
        ok.append(f"{source} ({len(entries)})")
    except Exception as exc:  # network/parse failures shouldn't break the build
        fail.append(f"{source}: {exc}")

# sort each lane newest-first; items with no date sink to the bottom
for lane in lanes:
    lanes[lane].sort(key=lambda x: x["date"] or "", reverse=True)

payload = {
    "generated": datetime.now(timezone.utc).isoformat(),
    "lanes": lanes,
    "counts": {k: len(v) for k, v in lanes.items()},
}
json.dump(payload, open(APP / "feeds.json", "w"), indent=0)

print(f"wrote feeds.json — data:{len(lanes['data'])} research:{len(lanes['research'])} news:{len(lanes['news'])}")
print(f"  ok:   {', '.join(ok)}")
if fail:
    print(f"  miss: {', '.join(fail)}")
