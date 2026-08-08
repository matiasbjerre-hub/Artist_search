/**
 * Ticketmaster Discovery API — broad international coverage of concerts and
 * large-venue shows.
 *
 * Ticketmaster indexes events, not people, so a hit here only means the
 * person's name appears in the event's own title. That is reliable for
 * headline musicians and solo shows, and weak for ensemble casts — which is
 * why Teaterbilletter carries the actor side of this app.
 */

import type { Profession, ShowResult } from "../types";

const EVENTS_URL = "https://app.ticketmaster.com/discovery/v2/events.json";

const CLASSIFICATION_BY_PROFESSION: Record<Profession, string> = {
  skuespiller: "Arts & Theatre",
  musiker: "Music",
};

type TicketmasterEvent = {
  id: string;
  name?: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  images?: { url: string; width: number; ratio?: string }[];
  _embedded?: {
    venues?: {
      name?: string;
      city?: { name?: string };
      country?: { name?: string };
    }[];
  };
};

function pickImage(images: TicketmasterEvent["images"]): string | null {
  if (!images?.length) return null;
  const wide = images.find((img) => img.ratio === "16_9" && img.width >= 640);
  return (wide ?? images[0]).url;
}

function startISO(event: TicketmasterEvent): string | null {
  const start = event.dates?.start;
  if (!start?.localDate) return null;
  return `${start.localDate}T${start.localTime ?? "00:00:00"}`;
}

export class TicketmasterError extends Error {}

export async function searchTicketmaster(
  name: string,
  profession: Profession,
  options: { apiKey: string; onlyDenmark: boolean },
): Promise<ShowResult[]> {
  const url = new URL(EVENTS_URL);
  url.searchParams.set("apikey", options.apiKey);
  url.searchParams.set("keyword", name);
  url.searchParams.set(
    "classificationName",
    CLASSIFICATION_BY_PROFESSION[profession],
  );
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", "30");
  url.searchParams.set("startDateTime", `${new Date().toISOString().slice(0, 19)}Z`);
  if (options.onlyDenmark) {
    url.searchParams.set("countryCode", "DK");
  }

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new TicketmasterError("Kunne ikke kontakte Ticketmaster.");
  }

  if (response.status === 401) {
    throw new TicketmasterError("Ticketmaster-nøglen blev afvist.");
  }
  if (!response.ok) {
    throw new TicketmasterError(
      `Ticketmaster svarede med fejl (${response.status}).`,
    );
  }

  const data = await response.json();
  const events: TicketmasterEvent[] = data?._embedded?.events ?? [];

  return events.map((event) => {
    const venue = event._embedded?.venues?.[0];
    const start = startISO(event);
    return {
      id: `tm-${event.id}`,
      source: "Ticketmaster" as const,
      title: event.name ?? "Ukendt begivenhed",
      subtitle: null,
      credit: null,
      creditedName: null,
      matchKind: "title" as const,
      venueName: venue?.name ?? null,
      city: venue?.city?.name ?? null,
      country: venue?.country?.name ?? null,
      dates: start ? [start] : [],
      nextDate: start,
      url: event.url ?? null,
      imageUrl: pickImage(event.images),
    };
  });
}
