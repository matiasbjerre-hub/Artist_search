/**
 * MigogKBH.dk — Copenhagen's municipal culture-and-events calendar, indexing
 * several thousand events across theatre, concerts, comedy and dance.
 *
 * Its WordPress REST API (`/wp/v2/events`) exposes only the event's own
 * title — no cast or performer credits — so a match here is always a title
 * mention, the same weak-evidence tier as Ticketmaster. Its value is breadth:
 * it carries many small Copenhagen venues and concerts that neither
 * Teaterbilletter nor Ticketmaster list.
 *
 * There is no server-side name search, so the relevant slice of the
 * catalogue is pulled once and cached, then filtered in memory — the same
 * approach as the Teaterbilletter source.
 */

import { decodeHtmlEntities } from "../html";
import { nameMatches } from "../names";
import type { Profession, ShowResult } from "../types";

const API_BASE = "https://migogkbh.dk/wp-json/wp/v2";
const REVALIDATE_SECONDS = 6 * 60 * 60;
const MAX_PAGES = 40;
const PAGE_SIZE = 100;

/**
 * Taxonomy term IDs from migogkbh.dk's `event-category`, picked to keep the
 * crawl limited to categories relevant to acting/music — not markets, talks,
 * food tours, and the like, which make up most of the ~6,000 total events.
 */
const CATEGORY_IDS: Record<Profession, number[]> = {
  // Forestilling, Teater, Musical, Performance, Comedy, Cirkus
  skuespiller: [4077, 3561, 4143, 4253, 4163, 4627],
  // Koncerter, Musik, Klassisk Musik, Jazz, Opera, Musical
  musiker: [2766, 3900, 4301, 4188, 4141, 4143],
  orkester: [2766, 3900, 4301, 4188, 4141, 4143],
};

type WPTitle = { rendered: string };

type MigEvent = {
  id: number;
  link?: string;
  title?: WPTitle;
  start_time?: string;
  end_time?: string;
  locations?: number[];
};

type MigTerm = { id: number; name: string };

async function fetchAllPages<T>(
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("per_page", String(PAGE_SIZE));

  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= Math.min(totalPages, MAX_PAGES)) {
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      if (page === 1) throw new Error(`MigogKBH svarede ${response.status}`);
      break;
    }
    if (page === 1) {
      totalPages = Number(response.headers.get("X-WP-TotalPages") ?? "1") || 1;
    }
    items.push(...((await response.json()) as T[]));
    page += 1;
  }
  return items;
}

function termNameMap(terms: MigTerm[]): Map<number, string> {
  return new Map(terms.map((term) => [term.id, term.name]));
}

function upcomingDates(event: MigEvent, now: Date): string[] {
  const start = event.start_time ? new Date(event.start_time) : null;
  if (!start || Number.isNaN(start.valueOf()) || start < now) return [];
  return [start.toISOString()];
}

export async function searchMigogKBH(
  name: string,
  profession: Profession,
): Promise<ShowResult[]> {
  const categoryIds = CATEGORY_IDS[profession];

  const [events, venues] = await Promise.all([
    fetchAllPages<MigEvent>("events", {
      "event-category": categoryIds.join(","),
      _fields: "id,link,title,start_time,end_time,locations",
    }),
    fetchAllPages<MigTerm>("locations", { _fields: "id,name" }),
  ]);

  const venueNames = termNameMap(venues);
  const now = new Date();
  const results: ShowResult[] = [];

  for (const event of events) {
    const rawTitle = event.title?.rendered?.trim();
    if (!rawTitle) continue;
    const title = decodeHtmlEntities(rawTitle);
    if (!nameMatches(name, title)) continue;

    const dates = upcomingDates(event, now);
    if (dates.length === 0) continue;

    const venueId = event.locations?.[0];
    const venueName = venueId != null ? (venueNames.get(venueId) ?? null) : null;

    results.push({
      id: `mig-${event.id}`,
      source: "MigogKBH",
      title,
      subtitle: null,
      credit: null,
      creditedName: null,
      matchKind: "title",
      venueName,
      city: "København",
      country: "Danmark",
      dates,
      nextDate: dates[0],
      url: event.link ?? null,
      imageUrl: null,
    });
  }

  return results;
}
