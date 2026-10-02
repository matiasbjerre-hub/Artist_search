"""Run every source scraper and merge the results into data/events.json.

Usage: python3 scripts/build_data.py
(run from the repo root, or anywhere -- paths are resolved relative to
this file).
"""

from __future__ import annotations

import json
import sys
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import is_orchestra_name
import scrape_kglteater
import scrape_aveny
import scrape_aarhusteater
import scrape_odenseteater
import scrape_vega
import scrape_drkoncerthuset
import scrape_abb
import scrape_migogkbh

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "events.json"

SCRAPERS = [
    ("kglteater.dk", scrape_kglteater.scrape),
    ("aveny-t.dk", scrape_aveny.scrape),
    ("aarhusteater.dk", scrape_aarhusteater.scrape),
    ("odenseteater.dk", scrape_odenseteater.scrape),
    ("vega.dk", scrape_vega.scrape),
    ("drkoncerthuset.dk", scrape_drkoncerthuset.scrape),
    ("ab-b.dk", scrape_abb.scrape),
    ("migogkbh.dk", scrape_migogkbh.scrape),
]


def _search_key(name: str) -> str:
    """Danish-tolerant search key matching index.html's foldName(): "søren",
    "soren" and "soeren" must all produce the same key, so both the
    diacritic-dropped and transliterated spellings fold together. Keep this
    in sync with foldName() in index.html."""
    s = name.lower()
    s = s.replace("aa", "a").replace("ae", "a").replace("oe", "o")
    s = s.replace("å", "a").replace("æ", "a").replace("ø", "o")
    normalized = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _load_previous_entries() -> dict[str, list[dict]]:
    """Entries from the last good events.json, grouped by source. Used as a
    fallback so one source failing (network, changed HTML, rate limit) in an
    unattended scheduled run keeps that source's old data instead of wiping
    it from the site."""
    try:
        previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    grouped: dict[str, list[dict]] = {}
    for entry in previous.get("entries", []):
        grouped.setdefault(entry.get("source", ""), []).append(entry)
    return grouped


def main() -> None:
    all_entries: list[dict] = []
    summary: list[dict] = []
    previous = _load_previous_entries()
    fresh_sources = 0

    for name, scrape_fn in SCRAPERS:
        print(f"=== {name} ===")
        start = time.time()
        try:
            entries = scrape_fn()
        except Exception as exc:  # a single source failing should not kill the build
            print(f"  !! {name} scraper crashed: {exc}")
            entries = []
        elapsed = time.time() - start
        stale = False
        if entries:
            fresh_sources += 1
        elif previous.get(name):
            entries = previous[name]
            stale = True
            print(f"  !! {name} returned nothing -- keeping {len(entries)} entries from the previous run")
        print(f"=== {name}: {len(entries)} entries in {elapsed:.1f}s ===\n")
        summary.append({"source": name, "entries": len(entries), "stale": stale})
        all_entries.extend(entries)

    if fresh_sources == 0:
        # Every source failed (e.g. the runner has no network): leave the
        # existing file untouched rather than rewriting it with a new date.
        print("!! No source returned fresh data -- events.json left unchanged")
        sys.exit(1)

    for entry in all_entries:
        entry["searchKey"] = _search_key(entry["person"])
        # An orchestra/ensemble is credited by its own name, not a person's --
        # promote it to the third profession regardless of what its source
        # tagged it as (e.g. drkoncerthuset.dk's "DR Symfoniorkestret" comes
        # through as an ordinary "musiker" credit otherwise).
        if entry["profession"] != "orkester" and is_orchestra_name(entry["person"]):
            entry["profession"] = "orkester"

    output = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sources": summary,
        "entries": all_entries,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {len(all_entries)} entries to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
