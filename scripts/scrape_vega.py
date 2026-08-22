"""Scraper for vega.dk (VEGA / Store VEGA / Lille VEGA / Ideal Bar).

vega.dk (not www) redirects and allows everything in robots.txt
("Disallow:" empty). The site is Next.js, server-rendered: the calendar
page embeds a `<script id="__NEXT_DATA__">` JSON blob with
`props.pageProps.initialEvents`, a Payload-CMS-shaped page of events
(title, venue, dates, slug, support-act "contributor").

LIMITATION (documented in README): pagination is driven by a client-side
"Load more" button calling `/api/events`, which always returned HTTP 500
for us however we called it, and `?page=N` on the calendar URL is ignored
server-side (it always returns page 1). We could not find a working way
to fetch pages beyond the first, so this only captures the ~25 nearest
upcoming events (out of ~200 total) rather than the full calendar. A
headless-browser network sniff to find the real client-side call was
attempted but this environment's outbound network only reaches Chromium
through a proxy Chromium itself refuses to route through.

As the task note predicts for spillesteder, the event title *is* the
performing artist for the main act; any listed support act
(`contributor.contributor`) is added as a second entry.
"""

from __future__ import annotations

import json
import re

from common import fetch

CALENDAR_URL = "https://vega.dk/en/calendar/"
SOURCE_NAME = "VEGA"
SOURCE_SLUG = "vega.dk"

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S
)


def scrape() -> list[dict]:
    entries: list[dict] = []

    print(f"[vega] fetching {CALENDAR_URL}")
    try:
        html = fetch(CALENDAR_URL)
    except Exception as exc:
        print(f"  ! failed to fetch calendar: {exc}")
        return entries

    match = NEXT_DATA_RE.search(html)
    if not match:
        print("  ! could not find __NEXT_DATA__ in page")
        return entries

    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        print(f"  ! failed to parse __NEXT_DATA__: {exc}")
        return entries

    initial_events = data.get("props", {}).get("pageProps", {}).get("initialEvents", {})
    items = initial_events.get("data", [])
    total = initial_events.get("totalDocs", len(items))
    print(f"[vega] got {len(items)} of {total} total events (see module docstring for why)")

    for event in items:
        title = event.get("title")
        slug = event.get("slug")
        venue = (event.get("venue") or {}).get("name", SOURCE_NAME)
        if not title:
            continue
        url = f"https://vega.dk/en/event/{slug}" if slug else CALENDAR_URL
        entries.append(
            {
                "person": title,
                "role": "Hovednavn",
                "profession": "musiker",
                "production": title,
                "venue": venue,
                "url": url,
                "source": SOURCE_SLUG,
            }
        )

        contributor = event.get("contributor") or {}
        support_name = contributor.get("contributor")
        if support_name:
            entries.append(
                {
                    "person": support_name,
                    "role": contributor.get("label") or "Support",
                    "profession": "musiker",
                    "production": title,
                    "venue": venue,
                    "url": url,
                    "source": SOURCE_SLUG,
                }
            )

    return entries


if __name__ == "__main__":
    data = scrape()
    print(json.dumps(data[:5], ensure_ascii=False, indent=2))
    print(f"Total entries: {len(data)}")
