import { NextRequest, NextResponse } from "next/server";

export type Profession = "skuespiller" | "musiker";

export type ShowResult = {
  id: string;
  name: string;
  date: string | null;
  time: string | null;
  venueName: string | null;
  city: string | null;
  country: string | null;
  url: string | null;
  imageUrl: string | null;
  genre: string | null;
};

const CLASSIFICATION_BY_PROFESSION: Record<Profession, string> = {
  skuespiller: "Arts & Theatre",
  musiker: "Music",
};

const TICKETMASTER_EVENTS_URL =
  "https://app.ticketmaster.com/discovery/v2/events.json";

function isProfession(value: string | null): value is Profession {
  return value === "skuespiller" || value === "musiker";
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "missing_api_key",
        message:
          "TICKETMASTER_API_KEY er ikke sat på serveren. Tilføj en gratis nøgle fra developer-acct.ticketmaster.com som miljøvariabel.",
      },
      { status: 500 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get("name")?.trim() ?? "";
  const professionParam = searchParams.get("profession");
  const onlyDenmark = searchParams.get("onlyDenmark") === "true";

  if (!name) {
    return NextResponse.json(
      { error: "missing_name", message: "Indtast et navn at søge på." },
      { status: 400 },
    );
  }
  if (!isProfession(professionParam)) {
    return NextResponse.json(
      {
        error: "invalid_profession",
        message: "Profession skal være 'skuespiller' eller 'musiker'.",
      },
      { status: 400 },
    );
  }

  const url = new URL(TICKETMASTER_EVENTS_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("keyword", name);
  url.searchParams.set(
    "classificationName",
    CLASSIFICATION_BY_PROFESSION[professionParam],
  );
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", "20");
  url.searchParams.set("startDateTime", new Date().toISOString().slice(0, 19) + "Z");
  if (onlyDenmark) {
    url.searchParams.set("countryCode", "DK");
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message: "Kunne ikke kontakte Ticketmaster lige nu. Prøv igen om lidt.",
      },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "upstream_error",
        message: `Ticketmaster svarede med fejl (${upstreamResponse.status}).`,
      },
      { status: 502 },
    );
  }

  const data = await upstreamResponse.json();
  const events = data?._embedded?.events ?? [];

  const results: ShowResult[] = events.map((event: TicketmasterEvent) => {
    const venue = event._embedded?.venues?.[0];
    const image = pickBestImage(event.images);
    return {
      id: event.id,
      name: event.name,
      date: event.dates?.start?.localDate ?? null,
      time: event.dates?.start?.localTime ?? null,
      venueName: venue?.name ?? null,
      city: venue?.city?.name ?? null,
      country: venue?.country?.name ?? null,
      url: event.url ?? null,
      imageUrl: image,
      genre: event.classifications?.[0]?.genre?.name ?? null,
    };
  });

  return NextResponse.json({ results });
}

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  images?: { url: string; width: number; ratio?: string }[];
  classifications?: { genre?: { name?: string } }[];
  _embedded?: {
    venues?: {
      name?: string;
      city?: { name?: string };
      country?: { name?: string };
    }[];
  };
};

function pickBestImage(
  images: TicketmasterEvent["images"],
): string | null {
  if (!images || images.length === 0) return null;
  const wide = images.find((img) => img.ratio === "16_9" && img.width >= 640);
  return (wide ?? images[0]).url;
}
