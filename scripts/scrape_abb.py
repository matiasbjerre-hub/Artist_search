"""Scraper for ab-b.dk (Amager Bio).

WordPress + Yoast SEO, robots.txt allows everything and publishes a
concert-specific sitemap we use directly instead of guessing listing
pages: https://ab-b.dk/concert-sitemap.xml lists every /k/<slug>/ page.
The WordPress REST API (/wp-json/) is blocked by a security plugin, so we
scrape the server-rendered HTML pages themselves, which is plain and
reliable:

  <h1>Clawfinger <small>(S)</small></h1>
  <div class="support-bands"><h4>Special Guests:</h4><h5>Sickret</h5></div>

As the task predicted for spillesteder, the page's own headline names the
main act; supporting acts (if listed) get their own entries.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common import fetch

SITEMAP_URL = "https://ab-b.dk/concert-sitemap.xml"
SOURCE_NAME = "Amager Bio"
SOURCE_SLUG = "ab-b.dk"

LOC_RE = re.compile(r"<loc>([^<]*)</loc>")


def find_concert_urls(sitemap_xml: str) -> list[str]:
    return sorted(set(LOC_RE.findall(sitemap_xml)))


def scrape_concert(url: str) -> dict | None:
    try:
        html = fetch(url)
    except Exception as exc:
        print(f"  ! failed to fetch {url}: {exc}")
        return None

    soup = BeautifulSoup(html, "lxml")
    h1 = soup.select_one("h1")
    if not h1:
        return None
    # Strip trailing markers like "(S)" for sold out, kept out of the name.
    for small in h1.select("small"):
        small.extract()
    title = " ".join(h1.get_text(" ", strip=True).split())

    cast = [{"name": title, "role": "Hovednavn"}] if title else []

    for support_block in soup.select(".support-bands"):
        for h5 in support_block.select("h5"):
            name = " ".join(h5.get_text(" ", strip=True).split())
            if name:
                cast.append({"name": name, "role": "Support"})

    return {"title": title, "url": url, "cast": cast}


def scrape() -> list[dict]:
    entries: list[dict] = []

    print(f"[ab-b] fetching sitemap {SITEMAP_URL}")
    try:
        sitemap_xml = fetch(SITEMAP_URL)
    except Exception as exc:
        print(f"  ! failed to fetch sitemap: {exc}")
        return entries

    urls = find_concert_urls(sitemap_xml)
    print(f"[ab-b] found {len(urls)} concert pages")

    for url in urls:
        show = scrape_concert(url)
        if not show:
            continue
        print(f"  - {show['title']}: {len(show['cast'])} act(s)")
        for member in show["cast"]:
            entries.append(
                {
                    "person": member["name"],
                    "role": member["role"],
                    "profession": "musiker",
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
    print(json.dumps(data[:8], ensure_ascii=False, indent=2))
    print(f"Total entries: {len(data)}")
