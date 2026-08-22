"""Scraper for migogkbh.dk — Copenhagen's municipal culture-and-events
calendar, indexing several thousand events across theatre, concerts, comedy
and dance.

Ported from a source another session built independently on this repo's old
Next.js branch (see git history) while this branch moved to a static site.
Its WordPress REST API (`/wp/v2/events`) exposes only the event's own title
-- no cast or performer credits -- so entries here are always a title
match, the weakest evidence tier, same as an Aarhus Teater or VEGA title
fallback elsewhere in this repo. Its value is breadth: it carries many
small Copenhagen venues and concerts none of the other seven sources list.

robots.txt is empty (no restrictions). There is no server-side name search,
so the relevant slice of the catalogue (theatre/music categories only, out
of ~6,000 total events covering everything from markets to food tours) is
pulled once here, same as every other source in this repo.
"""

from __future__ import annotations

import html
import json
from datetime import datetime
from urllib.parse import urlencode

from common import fetch

API_BASE = "https://migogkbh.dk/wp-json/wp/v2"
PAGE_SIZE = 100
MAX_PAGES = 40
SOURCE_NAME = "MigogKBH"
SOURCE_SLUG = "migogkbh.dk"

# Taxonomy term IDs from migogkbh.dk's "event-category", picked to keep the
# crawl limited to theatre/music-relevant categories -- not markets, talks,
# food tours, and the like, which make up most of the ~6,000 total events.
CATEGORY_IDS = {
    # Forestilling, Teater, Musical, Performance, Comedy, Cirkus
    "skuespiller": ["4077", "3561", "4143", "4253", "4163", "4627"],
    # Koncerter, Musik, Klassisk Musik, Jazz, Opera, Musical
    "musiker": ["2766", "3900", "4301", "4188", "4141", "4143"],
}


def _fetch_all_pages(path: str, params: dict) -> list[dict]:
    items: list[dict] = []
    page = 1
    while page <= MAX_PAGES:
        query = urlencode({**params, "per_page": PAGE_SIZE, "page": page})
        url = f"{API_BASE}/{path}?{query}"
        body = fetch(url)
        batch = json.loads(body)
        items.extend(batch)
        if len(batch) < PAGE_SIZE:
            # A short (or empty) page means we've reached the end. Some of
            # this API's endpoints 400 on a page number past the end rather
            # than returning [] (unlike /locations), so a short page is the
            # only reliable stop signal.
            break
        page += 1
    return items


def _venue_names() -> dict[int, str]:
    terms = _fetch_all_pages("locations", {"_fields": "id,name"})
    return {t["id"]: t["name"] for t in terms}


def _is_upcoming(event: dict) -> bool:
    start_time = event.get("start_time")
    if not start_time:
        return False
    try:
        start = datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return False
    return start >= datetime.now()


def scrape() -> list[dict]:
    entries: list[dict] = []

    print("[migogkbh] fetching venue names")
    try:
        venue_names = _venue_names()
    except Exception as exc:
        print(f"  ! failed to fetch locations: {exc}")
        venue_names = {}

    for profession, category_ids in CATEGORY_IDS.items():
        print(f"[migogkbh] fetching events for {profession}")
        try:
            events = _fetch_all_pages(
                "events",
                {
                    "event-category": ",".join(category_ids),
                    "_fields": "id,link,title,start_time,end_time,locations",
                },
            )
        except Exception as exc:
            print(f"  ! failed to fetch {profession} events: {exc}")
            continue

        print(f"  {len(events)} {profession} events fetched")
        kept = 0
        for event in events:
            if not _is_upcoming(event):
                continue
            title = html.unescape((event.get("title") or {}).get("rendered") or "").strip()
            if not title:
                continue
            location_ids = event.get("locations") or []
            venue = venue_names.get(location_ids[0]) if location_ids else None
            entries.append(
                {
                    "person": title,
                    "role": "Forestilling" if profession == "skuespiller" else "Koncert",
                    "profession": profession,
                    "production": title,
                    "venue": venue or SOURCE_NAME,
                    "url": event.get("link") or "https://migogkbh.dk/kalender/",
                    "source": SOURCE_SLUG,
                }
            )
            kept += 1
        print(f"  {kept} upcoming")

    return entries


if __name__ == "__main__":
    data = scrape()
    print(json.dumps(data[:5], ensure_ascii=False, indent=2))
    print(f"Total entries: {len(data)}")
