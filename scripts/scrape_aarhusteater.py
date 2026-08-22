"""Scraper for aarhusteater.dk (Aarhus Teater).

The site is a client-side rendered SPA (React) -- every page, including
individual show pages, serves the same ~2KB empty HTML shell with a
<div id="root">. We found one real JSON API behind it:

  GET https://aarhusteater.dk/api/shows

which returns the full current programme (title, venue, dates, ticket
links). We could NOT find a working endpoint for cast/credits within a
reasonable search: the bundle references an Umbraco-style
`/api/content/<path>` endpoint but every path we tried 404s, and there is
no cast data embedded in /api/shows itself.

LIMITATION (documented in README): Aarhus Teater entries in the dataset
therefore have no cast -- we index the show title itself as a
"skuespiller"-tagged entry so a search for the play still finds it, but
individual actor names from this venue are not searchable.
"""

from __future__ import annotations

import json

from common import fetch

API_URL = "https://aarhusteater.dk/api/shows"
SOURCE_NAME = "Aarhus Teater"
SOURCE_SLUG = "aarhusteater.dk"


def scrape() -> list[dict]:
    entries: list[dict] = []

    print(f"[aarhusteater] fetching {API_URL}")
    try:
        body = fetch(API_URL)
    except Exception as exc:
        print(f"  ! failed to fetch API: {exc}")
        return entries

    try:
        shows = json.loads(body)
    except json.JSONDecodeError as exc:
        print(f"  ! failed to parse API response: {exc}")
        return entries

    print(f"[aarhusteater] found {len(shows)} shows (no cast data available, see module docstring)")

    for show in shows:
        title = show.get("name")
        url = show.get("url")
        if not title:
            continue
        entries.append(
            {
                "person": title,
                "role": "Forestilling (ingen rolleliste tilgængelig)",
                "profession": "skuespiller",
                "production": title,
                "venue": SOURCE_NAME,
                "url": url or "https://www.aarhusteater.dk/det-sker/forestillinger",
                "source": SOURCE_SLUG,
            }
        )

    return entries


if __name__ == "__main__":
    data = scrape()
    print(json.dumps(data[:5], ensure_ascii=False, indent=2))
    print(f"Total entries: {len(data)}")
