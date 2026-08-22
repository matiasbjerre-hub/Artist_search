export type Profession = "skuespiller" | "musiker" | "orkester";

export type SourceName = "Teaterbilletter" | "Ticketmaster" | "MigogKBH";

/** Why a show showed up for the searched person, strongest evidence first. */
export type MatchKind =
  /** Credited by name in a role matching the chosen profession. */
  | "credit"
  /** Credited by name, but in some other role (e.g. director, designer). */
  | "otherCredit"
  /** Only the show's own title/description mentioned the name. */
  | "title";

export type ShowResult = {
  id: string;
  source: SourceName;
  title: string;
  subtitle: string | null;
  /** The role the person is credited with, e.g. "Skuespiller". */
  credit: string | null;
  /** The credited name exactly as the source spells it. */
  creditedName: string | null;
  matchKind: MatchKind;
  venueName: string | null;
  city: string | null;
  country: string | null;
  /** Upcoming performance dates, ISO strings, ascending. */
  dates: string[];
  nextDate: string | null;
  url: string | null;
  imageUrl: string | null;
};

export type SourceStatus = {
  source: SourceName;
  ok: boolean;
  /** Human-readable Danish explanation shown when a source is unavailable. */
  note?: string;
};

export type SearchResponse = {
  results: ShowResult[];
  sources: SourceStatus[];
};

export function isProfession(value: unknown): value is Profession {
  return value === "skuespiller" || value === "musiker" || value === "orkester";
}
