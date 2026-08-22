"""Scraper for drkoncerthuset.dk (DR Koncerthuset).

robots.txt itself returns HTTP 403 "Access Denied" from an Akamai edge
node regardless of user agent (even a plain browser UA), while the actual
/kalender/ page loads fine (HTTP 200). We could not confirm crawl
permissions from robots.txt, so we treat this source conservatively:
a single request for the calendar page, at the same request delay as
every other source, and nothing else is fetched from this domain.

The calendar page is server-rendered and embeds ALL 299 (at time of
writing) events in one place: a Vue component's props, serialized as an
HTML-escaped JSON string in a `data-component-args` attribute:

  <div data-vue-component="vue-events-list" data-component-args="{...}">

`dynamicResults` is a list of pages, each a list of event objects. Each
event's `info.label` typically reads like
"DR Vokalensemblet | Carsten Seyer-Hansen dirigent" -- ensemble and
soloist/conductor names separated by "|", which is the closest thing to
a cast list this source has. We split on "|" and treat each fragment as
one performer/ensemble credit.
"""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser

from common import fetch

CALENDAR_URL = "https://www.drkoncerthuset.dk/kalender/"
SOURCE_NAME = "DR Koncerthuset"
SOURCE_SLUG = "drkoncerthuset.dk"

NAME_ROLE_RE = re.compile(
    r"^(?P<name>.+?)\s+(?P<role>dirigent|solist|sopran(?:ist)?|tenor|bas(?:baryton)?|"
    r"alt(?:sang)?|klaver|violin(?:ist)?|cello(?:ist)?|fl[øo]jte(?:nist)?|obo(?:ist)?|"
    r"klarinet(?:tist)?|fagot(?:tist)?|horn(?:ist)?|trompet(?:ist)?|tromb[øo]n(?:ist)?|"
    r"harpe(?:nist)?|percussion(?:ist)?|guitar(?:ist)?|slagt[øo]j)\.?$",
    re.IGNORECASE,
)


def _split_name_role(fragment: str) -> tuple[str, str]:
    """Split "Rudolf Buchbinder Klaver" into ("Rudolf Buchbinder", "Klaver").
    Falls back to treating the whole fragment as the name when no known
    role word trails it (e.g. an ensemble or a pop act's own name)."""
    match = NAME_ROLE_RE.match(fragment)
    if match:
        return match.group("name").strip(), match.group("role").strip().capitalize()
    return fragment, "Medvirkende"


class _VueEventsListExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.data_json: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_dict = dict(attrs)
        if attr_dict.get("data-vue-component") == "vue-events-list":
            self.data_json = attr_dict.get("data-component-args")


def _extract_events(html_text: str) -> list[dict]:
    parser = _VueEventsListExtractor()
    parser.feed(html_text)
    if not parser.data_json:
        return []
    data = json.loads(parser.data_json)
    pages = data.get("dynamicResults", [])
    return [event for page in pages for event in page]


def scrape() -> list[dict]:
    entries: list[dict] = []

    print(f"[drkoncerthuset] fetching {CALENDAR_URL}")
    try:
        page_html = fetch(CALENDAR_URL)
    except Exception as exc:
        print(f"  ! failed to fetch calendar: {exc}")
        return entries

    events = _extract_events(page_html)
    print(f"[drkoncerthuset] found {len(events)} events")

    for event in events:
        title = event.get("title")
        if not title:
            continue
        url = "https://www.drkoncerthuset.dk" + event["url"] if event.get("url") else CALENDAR_URL
        venue = event.get("venue") or SOURCE_NAME

        label = (event.get("info") or {}).get("label") or ""
        credited = [part.strip() for part in label.split("|") if part.strip()]

        ensemble = event.get("ensembleLabel")
        if ensemble and ensemble not in credited:
            credited.insert(0, ensemble)

        if not credited:
            # No named performer -- fall back to the concert title itself,
            # same convention as a spillested where the title is the act.
            credited = [title]

        seen_names: set[str] = set()
        for fragment in credited:
            name, role = _split_name_role(fragment)
            if not name or name in seen_names:
                continue
            seen_names.add(name)
            entries.append(
                {
                    "person": name,
                    "role": "Koncert" if name == title else role,
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
    print(json.dumps(data[:8], ensure_ascii=False, indent=2))
    print(f"Total entries: {len(data)}")
