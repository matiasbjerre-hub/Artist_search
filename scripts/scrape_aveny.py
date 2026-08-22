"""Scraper for aveny-t.dk (Aveny-T).

Squarespace site. robots.txt disallows /api/, /search, /config, /account,
and several query-string patterns (?format=ical etc); the /forestillinger
listing and individual show pages are otherwise fully server-rendered
and allowed.

Each show page has a rich-text credits block like:

  <strong>ISCENESÆTTELSE</strong> Jørgen Carlslund
  <strong>MEDVIRKENDE</strong> Jan Overgaard Mogensen, Carl Martin Norén, Cipa Pape
  <strong>KOMPONIST</strong> Marie Rørbæk

There is no per-name markup, just a label followed by a comma-separated
list of names until the next <br> or the end of the paragraph, so we
extract it with a regex over the label text.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common import fetch, absolute_url

BASE_URL = "https://www.aveny-t.dk"
LISTING_URL = f"{BASE_URL}/forestillinger"
SOURCE_NAME = "Aveny-T"
SOURCE_SLUG = "aveny-t.dk"

# label -> (role shown to users, profession)
CREDIT_LABELS = {
    "MEDVIRKENDE": ("Medvirkende", "skuespiller"),
    "SKUESPILLERE": ("Skuespiller", "skuespiller"),
    "KOMPONIST": ("Komponist", "musiker"),
    "MUSIKER": ("Musiker", "musiker"),
    "MUSIKERE": ("Musiker", "musiker"),
    "SANGER": ("Sanger", "musiker"),
}

LABEL_PATTERN = re.compile(
    r"<strong>\s*(" + "|".join(re.escape(k) for k in CREDIT_LABELS) + r")\s*</strong>\s*([^<]*)",
    re.IGNORECASE,
)


def find_show_links(listing_html: str, listing_url: str) -> list[str]:
    soup = BeautifulSoup(listing_html, "lxml")
    links = set()
    for a in soup.select("a[href]"):
        href = a["href"]
        if href.startswith("/forestillinger/") and "?" not in href and href != "/forestillinger/":
            links.add(absolute_url(listing_url, href))
    return sorted(links)


def scrape_show(show_url: str) -> dict | None:
    try:
        html = fetch(show_url)
    except Exception as exc:
        print(f"  ! failed to fetch {show_url}: {exc}")
        return None

    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("h1")
    title = " ".join(title_el.get_text(" ", strip=True).split()) if title_el else show_url

    cast = []
    for label, (role, profession) in CREDIT_LABELS.items():
        for m in re.finditer(
            rf"<strong>\s*{re.escape(label)}\s*</strong>\s*([^<]*)", html, re.IGNORECASE
        ):
            names_blob = m.group(1)
            for name in names_blob.split(","):
                name = name.strip(" \t\r\n.")
                if name:
                    cast.append({"name": name, "role": role, "profession": profession})

    if not cast and title:
        # No credits block matched (typical for a single-artist concert
        # night, e.g. "KONCERT I KULISSEN: FABER") -- same fallback as the
        # other theatre sources: index the title itself so the artist is
        # still findable, even though it's not split out of the title text.
        cast.append({"name": title, "role": "Koncert", "profession": "musiker"})

    return {"title": title, "url": show_url, "cast": cast}


def scrape() -> list[dict]:
    entries: list[dict] = []

    print(f"[aveny-t] fetching listing {LISTING_URL}")
    try:
        html = fetch(LISTING_URL)
    except Exception as exc:
        print(f"  ! failed to fetch listing: {exc}")
        return entries

    show_urls = find_show_links(html, LISTING_URL)
    print(f"[aveny-t] found {len(show_urls)} show pages")

    for show_url in show_urls:
        show = scrape_show(show_url)
        if not show:
            continue
        print(f"  - {show['title']}: {len(show['cast'])} credited")
        for member in show["cast"]:
            entries.append(
                {
                    "person": member["name"],
                    "role": member["role"],
                    "profession": member["profession"],
                    "production": show["title"],
                    "venue": SOURCE_NAME,
                    "url": show["url"],
                    "source": SOURCE_SLUG,
                }
            )

    return entries


if __name__ == "__main__":
    import json

    data = scrape()
    print(json.dumps(data[:5], ensure_ascii=False, indent=2))
    print(f"Total entries: {len(data)}")
