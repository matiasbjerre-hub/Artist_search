/**
 * Teaterbilletter.dk — a Danish theatre ticket aggregator covering ~100 venues
 * in Copenhagen and Zealand.
 *
 * Its site is backed by a public JSON endpoint, `/api/events`, which returns
 * whole productions including an `accreditations` list of credited cast and
 * crew. That cast list is what makes searching by a person's name possible at
 * all — Ticketmaster only exposes the event's own title.
 *
 * The endpoint has no server-side search and pages 10 at a time (~46 pages), so
 * the whole catalogue is pulled once and cached, then filtered in memory.
 */

import { nameMatches } from "../names";
import type { Profession, ShowResult } from "../types";

const BASE_URL = "https://teaterbilletter.dk/api/events";

/** The catalogue is small and changes slowly; re-fetch a few times a day. */
const REVALIDATE_SECONDS = 6 * 60 * 60;

/** Guards against a runaway crawl if the upstream ever reports odd paging. */
const MAX_PAGES = 60;

type Accreditation = {
  positionTypeName?: string;
  positionName?: string;
  firstName?: string;
  lastName?: string;
};

type TeaterbilletterEvent = {
  eventNo: number;
  title?: string;
  subtitle?: string;
  slug?: string;
  sharelink?: string;
  exitLinkUrl?: string;
  showDates?: string[];
  accreditations?: Accreditation[];
  images?: { url?: string; orientation?: string }[];
  venue?: { name?: string; city?: string };
};

type EventsPage = {
  items?: TeaterbilletterEvent[];
  pagination?: { pageCount?: number };
};

/**
 * Credited roles that count as acting vs. music. Roles outside these sets
 * (Instruktør, Scenograf, …) are still searchable but are reported under
 * whichever profession the user picked only if they fit.
 */
const ACTING_ROLES = new Set([
  "skuespiller",
  "medvirkende",
  "performer",
  "artist",
  "vaert",
  "dukkefoerer",
  "danser",
]);

const MUSIC_ROLES = new Set([
  "musiker",
  "sanger",
  "kapelmester",
  "dirigent",
  "komponist",
  "musikalsk arrangoer",
  "kapelmester og komponist",
]);

function roleKey(role: string | undefined): string {
  return (role ?? "")
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .trim();
}

function roleFitsProfession(
  role: string | undefined,
  profession: Profession,
): boolean {
  const key = roleKey(role);
  return profession === "skuespiller"
    ? ACTING_ROLES.has(key)
    : MUSIC_ROLES.has(key);
}

async function fetchPage(page: number): Promise<EventsPage> {
  const response = await fetch(`${BASE_URL}?page=${page}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`Teaterbilletter svarede ${response.status}`);
  }
  return response.json();
}

/** Pulls every page of the catalogue. Cached by Next.js per page. */
async function fetchAllEvents(): Promise<TeaterbilletterEvent[]> {
  const first = await fetchPage(1);
  const events = [...(first.items ?? [])];

  const pageCount = Math.min(first.pagination?.pageCount ?? 1, MAX_PAGES);
  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 2)),
    );
    for (const page of rest) {
      events.push(...(page.items ?? []));
    }
  }
  return events;
}

function upcomingDates(event: TeaterbilletterEvent, now: Date): string[] {
  return (event.showDates ?? [])
    .filter((date) => {
      const parsed = new Date(date);
      return !Number.isNaN(parsed.valueOf()) && parsed >= now;
    })
    .sort();
}

function pickImage(event: TeaterbilletterEvent): string | null {
  const images = event.images ?? [];
  const landscape = images.find((img) => img.orientation === "Landscape");
  return (landscape ?? images[0])?.url ?? null;
}

function showUrl(event: TeaterbilletterEvent): string | null {
  if (event.slug) {
    return `https://teaterbilletter.dk/forestillinger/${event.slug}`;
  }
  return event.sharelink ?? event.exitLinkUrl ?? null;
}

export async function searchTeaterbilletter(
  name: string,
  profession: Profession,
): Promise<ShowResult[]> {
  const events = await fetchAllEvents();
  const now = new Date();
  const results: ShowResult[] = [];

  for (const event of events) {
    const dates = upcomingDates(event, now);
    if (dates.length === 0) continue;

    // Prefer a credit whose role matches the chosen profession. A credit in
    // some other role still counts, but is reported as weaker evidence rather
    // than being ranked alongside genuine acting/music credits.
    let chosen: Accreditation | undefined;
    let chosenFits = false;
    for (const credit of event.accreditations ?? []) {
      const fullName = `${credit.firstName ?? ""} ${credit.lastName ?? ""}`;
      if (!fullName.trim() || !nameMatches(name, fullName)) continue;
      if (roleFitsProfession(credit.positionName, profession)) {
        chosen = credit;
        chosenFits = true;
        break;
      }
      chosen ??= credit;
    }

    const matchedTitle =
      !chosen &&
      (nameMatches(name, event.title ?? "") ||
        nameMatches(name, event.subtitle ?? ""));

    if (!chosen && !matchedTitle) continue;

    const creditedName = chosen
      ? `${chosen.firstName ?? ""} ${chosen.lastName ?? ""}`.trim()
      : null;

    results.push({
      id: `tb-${event.eventNo}`,
      source: "Teaterbilletter",
      title: event.title ?? "Ukendt forestilling",
      subtitle: event.subtitle?.trim() || null,
      credit: chosen?.positionName?.trim() || null,
      creditedName: creditedName || null,
      matchKind: chosen ? (chosenFits ? "credit" : "otherCredit") : "title",
      venueName: event.venue?.name ?? null,
      city: event.venue?.city ?? null,
      country: "Danmark",
      dates,
      nextDate: dates[0] ?? null,
      url: showUrl(event),
      imageUrl: pickImage(event),
    });
  }

  return results;
}
