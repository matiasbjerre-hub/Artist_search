import { NextRequest, NextResponse } from "next/server";

import { searchMigogKBH } from "@/lib/sources/migogkbh";
import { searchTeaterbilletter } from "@/lib/sources/teaterbilletter";
import { searchTicketmaster, TicketmasterError } from "@/lib/sources/ticketmaster";
import { isProfession, type SearchResponse, type ShowResult, type SourceStatus } from "@/lib/types";

/**
 * Results from every source that answered are merged. A source failing is not
 * fatal: Teaterbilletter and MigogKBH need no credentials, so the app stays
 * useful even with no Ticketmaster key configured.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const name = params.get("name")?.trim() ?? "";
  const profession = params.get("profession");
  const onlyDenmark = params.get("onlyDenmark") === "true";

  if (!name) {
    return NextResponse.json(
      { error: "missing_name", message: "Indtast et navn at søge på." },
      { status: 400 },
    );
  }
  if (!isProfession(profession)) {
    return NextResponse.json(
      {
        error: "invalid_profession",
        message:
          "Profession skal være 'skuespiller', 'musiker' eller 'orkester'.",
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.TICKETMASTER_API_KEY;

  const [teaterbilletter, migogkbh, ticketmaster] = await Promise.allSettled([
    searchTeaterbilletter(name, profession),
    searchMigogKBH(name, profession),
    apiKey
      ? searchTicketmaster(name, profession, { apiKey, onlyDenmark })
      : Promise.reject(new TicketmasterError("no_key")),
  ]);

  const results: ShowResult[] = [];
  const sources: SourceStatus[] = [];

  if (teaterbilletter.status === "fulfilled") {
    results.push(...teaterbilletter.value);
    sources.push({ source: "Teaterbilletter", ok: true });
  } else {
    sources.push({
      source: "Teaterbilletter",
      ok: false,
      note: "Kunne ikke hente danske teaterforestillinger lige nu.",
    });
  }

  if (migogkbh.status === "fulfilled") {
    results.push(...migogkbh.value);
    sources.push({ source: "MigogKBH", ok: true });
  } else {
    sources.push({
      source: "MigogKBH",
      ok: false,
      note: "Kunne ikke hente Københavns begivenhedskalender lige nu.",
    });
  }

  if (ticketmaster.status === "fulfilled") {
    const events = onlyDenmark
      ? ticketmaster.value.filter((event) => event.country === "Denmark")
      : ticketmaster.value;
    results.push(...events);
    sources.push({ source: "Ticketmaster", ok: true });
  } else {
    sources.push({
      source: "Ticketmaster",
      ok: false,
      note: apiKey
        ? "Ticketmaster kunne ikke kontaktes."
        : "Ingen Ticketmaster-nøgle konfigureret — koncerter i udlandet mangler.",
    });
  }

  // Strongest evidence first — a confirmed acting/music credit beats a credit
  // in another role, which in turn beats a bare title mention. Then by date.
  const rank = { credit: 0, otherCredit: 1, title: 2 } as const;
  results.sort((a, b) => {
    if (a.matchKind !== b.matchKind) {
      return rank[a.matchKind] - rank[b.matchKind];
    }
    if (!a.nextDate) return 1;
    if (!b.nextDate) return -1;
    return a.nextDate.localeCompare(b.nextDate);
  });

  const body: SearchResponse = { results, sources };
  return NextResponse.json(body);
}
