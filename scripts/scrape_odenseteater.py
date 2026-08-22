"""Scraper for odenseteater.dk (Odense Teater).

Umbraco CMS, fully server-rendered HTML. robots.txt only disallows
/App_Plugins/ and /umbraco/ (the CMS admin), so both listing pages we use
are allowed.

Cast is edited as free-form rich text under a "medvirkende" heading:

  <h4><span class="h3">medvirkende</span></h4>
  <div class="grid ...">
    <div class="w-full">
      <p><span class="tagline">skuespiller</span></p>
      <p><span class="h5">Flemming Enevold</span></p>
    </div>
    ...
  </div>

We locate the heading by text (case-insensitive) rather than a class name,
since Umbraco content editors reuse the same generic classes ("rte",
"grid", "w-full") throughout the page for unrelated sections.
"""

from __future__ import annotations

from bs4 import BeautifulSoup

from common import fetch, absolute_url

BASE_URL = "https://www.odenseteater.dk"
LISTING_URLS = [
    f"{BASE_URL}/forestillinger/",
    f"{BASE_URL}/tidligere-forestillinger/",
]
SOURCE_NAME = "Odense Teater"
SOURCE_SLUG = "odenseteater.dk"

MUSICIAN_ROLE_KEYWORDS = (
    "musiker",
    "sanger",
    "sangerinde",
    "solist",
    "dirigent",
    "kapelmester",
    "komponist",
    "orkester",
    "korleder",
    "band",
)


def classify_role(role: str) -> str:
    role_lower = role.lower()
    for kw in MUSICIAN_ROLE_KEYWORDS:
        if kw in role_lower:
            return "musiker"
    return "skuespiller"


def find_show_links(listing_html: str, listing_url: str) -> list[str]:
    soup = BeautifulSoup(listing_html, "lxml")
    links = set()
    for a in soup.select("a[href]"):
        href = a["href"]
        if href.startswith("/forestillinger/") and href.rstrip("/") != "/forestillinger":
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
    heading = next(
        (
            h
            for h in soup.find_all(["h3", "h4"])
            if "medvirkende" in h.get_text(strip=True).lower()
        ),
        None,
    )
    if heading is not None:
        container = heading.find_parent("div", class_="rte") or heading.parent
        grid = container.find_next_sibling("div") if container else None
        if grid is not None:
            for card in grid.find_all("div", recursive=False):
                role_el = card.select_one(".tagline")
                name_el = card.select_one(".h5")
                if not name_el:
                    continue
                name = " ".join(name_el.get_text(" ", strip=True).split())
                role = " ".join(role_el.get_text(" ", strip=True).split()) if role_el else ""
                if name:
                    cast.append({"name": name, "role": role})

    return {"title": title, "url": show_url, "cast": cast}


def scrape() -> list[dict]:
    entries: list[dict] = []
    show_urls: set[str] = set()

    for listing_url in LISTING_URLS:
        print(f"[odenseteater] fetching listing {listing_url}")
        try:
            html = fetch(listing_url)
        except Exception as exc:
            print(f"  ! failed to fetch listing: {exc}")
            continue
        show_urls.update(find_show_links(html, listing_url))

    print(f"[odenseteater] found {len(show_urls)} show pages")

    for show_url in sorted(show_urls):
        show = scrape_show(show_url)
        if not show:
            continue
        print(f"  - {show['title']}: {len(show['cast'])} cast members")
        for member in show["cast"]:
            entries.append(
                {
                    "person": member["name"],
                    "role": member["role"],
                    "profession": classify_role(member["role"]),
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
