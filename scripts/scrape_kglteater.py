"""Scraper for kglteater.dk (Det Kongelige Teater).

Server-rendered HTML, robots.txt allows everything (Allow: /).
The listing page /forestillinger/ links to per-show pages
(e.g. /ballet/2627/askepot/) which mix two cast sources:

  1. A "cast grid" of performer cards (used inconsistently -- some shows
     show all performers here, others only a preview with a "Se alle
     medvirkende" button that loads the rest via JavaScript we could not
     find a working API for; see README limitations):

       <div class="cast-grid-card">
         <h3 class="cast-grid-role">Dirigent</h3>
         <a class="cast-grid-name" href="/medvirkende/damian-iorio/">Damian Iorio</a>
       </div>

  2. A "contribution group" list of the creative team (director,
     choreographer, composer, designers, ...), always fully present in
     the HTML:

       <div class="contribution-group">
         <h4>Koreografi</h4>
         <ul><li><a href="/medvirkende/gregory-dean/">Gregory Dean</a></li></ul>
       </div>

  For single-artist concert pages (category "koncert") neither section is
  always populated -- the artist is simply the show title, mirroring how
  a spillested's event title names the performer. We fall back to the
  title in that case.

Roles that look like musician roles (dirigent, musiker, sanger, ...) are
tagged profession="musiker"; everything else defaults to "skuespiller"
since kglteater is primarily a theatre/ballet/opera house.
"""

from __future__ import annotations

from bs4 import BeautifulSoup

from common import fetch, absolute_url

BASE_URL = "https://www.kglteater.dk"
LISTING_URLS = [f"{BASE_URL}/forestillinger/"]
SOURCE_NAME = "Det Kongelige Teater"
SOURCE_SLUG = "kglteater.dk"

MUSICIAN_ROLE_KEYWORDS = (
    "dirigent",
    "musiker",
    "sanger",
    "sangerinde",
    "solist",
    "kapelmester",
    "komponist",
    "orkester",
    "musical director",
    "korleder",
    "koncert",
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
        # Show pages look like /<category>/<season>/<slug>/, e.g. /ballet/2627/askepot/
        parts = [p for p in href.strip("/").split("/") if p]
        if len(parts) == 3 and parts[1].isdigit() and len(parts[1]) == 4:
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
    title = _text(title_el) if title_el else show_url

    cast = []
    seen: set[tuple[str, str]] = set()

    def add(name: str, role: str) -> None:
        key = (name, role)
        if name and key not in seen:
            seen.add(key)
            cast.append({"name": name, "role": role})

    for card in soup.select(".cast-grid-card"):
        role_el = card.select_one(".cast-grid-role")
        name_el = card.select_one(".cast-grid-name")
        if not name_el:
            continue
        add(_text(name_el), _text(role_el) if role_el else "")

    for group in soup.select(".contribution-group"):
        role_el = group.select_one("h4")
        role = _text(role_el) if role_el else ""
        for li in group.select("li"):
            add(_text(li), role)

    if not cast and title:
        # No structured cast/crew found (typical for a solo concert or a
        # one-person guest show like a stand-up gig) -- same convention as
        # a spillested, where the title itself names the performer.
        role = "Koncert" if "/koncert/" in show_url else "Forestilling"
        add(title, role)

    return {"title": title, "url": show_url, "cast": cast}


def _text(el) -> str:
    return " ".join(el.get_text(" ", strip=True).split())


def scrape() -> list[dict]:
    entries: list[dict] = []
    show_urls: set[str] = set()

    for listing_url in LISTING_URLS:
        print(f"[kglteater] fetching listing {listing_url}")
        try:
            html = fetch(listing_url)
        except Exception as exc:
            print(f"  ! failed to fetch listing: {exc}")
            continue
        show_urls.update(find_show_links(html, listing_url))

    print(f"[kglteater] found {len(show_urls)} show pages")

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
