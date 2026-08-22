"""Shared helpers for the site scrapers: polite HTTP fetching + robots.txt checks."""

from __future__ import annotations

import time
import urllib.request
import urllib.robotparser
from urllib.parse import urljoin, urlparse

USER_AGENT = (
    "Mozilla/5.0 (compatible; ArtistSearchBot/1.0; "
    "+https://github.com/matiasbjerre-hub/artist_search)"
)

REQUEST_DELAY_SECONDS = 1.0
TIMEOUT_SECONDS = 20

_robot_parsers: dict[str, urllib.robotparser.RobotFileParser] = {}


def _robots_url(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}/robots.txt"


def allowed_by_robots(url: str) -> bool:
    """Check robots.txt for `url`. Fails open (True) if robots.txt itself
    can't be fetched, since an unreadable robots.txt is not a Disallow."""
    robots_url = _robots_url(url)
    parser = _robot_parsers.get(robots_url)
    if parser is None:
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(robots_url)
        try:
            req = urllib.request.Request(robots_url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
                parser.parse(resp.read().decode("utf-8", errors="replace").splitlines())
        except Exception:
            parser = None
        _robot_parsers[robots_url] = parser
    if parser is None:
        return True
    return parser.can_fetch(USER_AGENT, url)


MAX_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 3.0


def fetch(url: str, delay: float = REQUEST_DELAY_SECONDS) -> str:
    """Politely GET `url` as text, respecting robots.txt and a fixed request
    delay. Retries a couple of times on transient connection resets, which
    several of these sites throw occasionally under normal, non-abusive
    request rates."""
    if not allowed_by_robots(url):
        raise PermissionError(f"robots.txt disallows fetching: {url}")

    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                body = resp.read().decode(charset, errors="replace")
            if delay:
                time.sleep(delay)
            return body
        except Exception as exc:  # connection reset, timeout, etc.
            last_error = exc
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    raise last_error


def absolute_url(base: str, href: str) -> str:
    return urljoin(base, href)


# An orchestra/ensemble is usually credited by its own name rather than a
# person's, so it needs a third profession ("orkester") applied to the
# *name itself* -- on top of, and after, each source's own role-based
# skuespiller/musiker classification. Keep in sync with the ORCHESTRA_
# equivalent nowhere else -- this is the only place it's defined.
ORCHESTRA_KEYWORDS = (
    "orkester",
    "orchestra",
    "symfoniker",
    "philharmonik",
    "philharmonic",
    "ensemble",
    "kapel",
)


def is_orchestra_name(name: str) -> bool:
    lowered = name.lower()
    return any(keyword in lowered for keyword in ORCHESTRA_KEYWORDS)
