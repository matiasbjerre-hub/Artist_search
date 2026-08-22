"use client";

import { FormEvent, useState } from "react";

import type {
  Profession,
  SearchResponse,
  ShowResult,
  SourceStatus,
} from "@/lib/types";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: SearchResponse; query: string };

export default function Home() {
  const [name, setName] = useState("");
  const [profession, setProfession] = useState<Profession>("skuespiller");
  const [onlyDenmark, setOnlyDenmark] = useState(false);
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = name.trim();
    if (!query) return;

    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({
        name: query,
        profession,
        onlyDenmark: String(onlyDenmark),
      });
      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();
      if (!response.ok) {
        setState({
          status: "error",
          message: data.message ?? "Der skete en uventet fejl.",
        });
        return;
      }
      setState({ status: "success", data, query });
    } catch {
      setState({
        status: "error",
        message: "Kunne ikke gennemføre søgningen. Tjek din forbindelse.",
      });
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Find forestillinger &amp; koncerter
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Søg på en skuespiller eller musiker og se, hvilke teaterforestillinger
            og koncerter de medvirker i.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Navn
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Henrik Prip"
              autoComplete="off"
              className="rounded-lg border border-black/10 bg-zinc-50 px-4 py-2.5 text-black outline-none focus:border-black/30 dark:border-white/10 dark:bg-black dark:text-white dark:focus:border-white/30"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Profession
            </span>
            <div className="flex gap-3">
              <ProfessionOption
                label="Skuespiller"
                value="skuespiller"
                current={profession}
                onSelect={setProfession}
              />
              <ProfessionOption
                label="Musiker"
                value="musiker"
                current={profession}
                onSelect={setProfession}
              />
              <ProfessionOption
                label="Orkester"
                value="orkester"
                current={profession}
                onSelect={setProfession}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={onlyDenmark}
              onChange={(e) => setOnlyDenmark(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 dark:border-white/20"
            />
            Kun i Danmark
          </label>

          <button
            type="submit"
            disabled={state.status === "loading"}
            className="mt-2 rounded-lg bg-black px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {state.status === "loading" ? "Søger…" : "Søg"}
          </button>
        </form>

        <Results state={state} />
      </main>
    </div>
  );
}

function ProfessionOption({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: Profession;
  current: Profession;
  onSelect: (value: Profession) => void;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
        selected
          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
          : "border-black/10 bg-zinc-50 text-zinc-700 hover:border-black/30 dark:border-white/10 dark:bg-black dark:text-zinc-300 dark:hover:border-white/30"
      }`}
    >
      {label}
    </button>
  );
}

function Results({ state }: { state: SearchState }) {
  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return <p className="text-center text-zinc-500">Søger…</p>;
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {state.message}
      </div>
    );
  }

  const { results, sources } = state.data;
  const credited = results.filter((show) => show.matchKind === "credit");
  const otherCredited = results.filter((show) => show.matchKind === "otherCredit");
  const titleOnly = results.filter((show) => show.matchKind === "title");

  return (
    <div className="flex flex-col gap-6">
      {results.length === 0 ? (
        <p className="text-center text-zinc-500">
          Ingen kommende forestillinger eller koncerter fundet for{" "}
          <span className="font-medium">{state.query}</span>.
        </p>
      ) : (
        <>
          {credited.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Medvirker i ({credited.length})
              </h2>
              <ul className="flex flex-col gap-4">
                {credited.map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </ul>
            </section>
          )}

          {otherCredited.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Krediteret i en anden rolle ({otherCredited.length})
              </h2>
              <p className="text-xs text-zinc-500">
                Samme navn står på rollelisten, men bag scenen — f.eks. som
                instruktør eller scenograf.
              </p>
              <ul className="flex flex-col gap-4">
                {otherCredited.map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </ul>
            </section>
          )}

          {titleOnly.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Navnet nævnes i titlen ({titleOnly.length})
              </h2>
              <p className="text-xs text-zinc-500">
                Her matcher navnet kun forestillingens titel — ikke en bekræftet
                rolleliste.
              </p>
              <ul className="flex flex-col gap-4">
                {titleOnly.map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <SourceNotes sources={sources} />
    </div>
  );
}

function ShowCard({ show }: { show: ShowResult }) {
  return (
    <li className="flex gap-4 overflow-hidden rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      {show.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={show.imageUrl}
          alt=""
          className="hidden h-24 w-24 flex-none rounded-lg object-cover sm:block"
        />
      )}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="font-medium text-black dark:text-zinc-50">
            {show.title}
          </h3>
          {show.credit && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {show.credit}
            </span>
          )}
        </div>

        {show.subtitle && (
          <p className="text-sm text-zinc-500">{show.subtitle}</p>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatDate(show.nextDate)}
          {show.dates.length > 1 && (
            <span className="text-zinc-500">
              {" "}
              · {show.dates.length} forestillinger
            </span>
          )}
        </p>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {[show.venueName, show.city, show.country === "Danmark" ? null : show.country]
            .filter(Boolean)
            .join(", ")}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
          {show.url && (
            <a
              href={show.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-black underline underline-offset-2 dark:text-white"
            >
              Se billetter →
            </a>
          )}
          <span className="text-xs text-zinc-500">via {show.source}</span>
        </div>
      </div>
    </li>
  );
}

function SourceNotes({ sources }: { sources: SourceStatus[] }) {
  const unavailable = sources.filter((source) => !source.ok);
  return (
    <div className="flex flex-col gap-2 border-t border-black/10 pt-4 text-xs text-zinc-500 dark:border-white/10">
      {unavailable.map((source) => (
        <p key={source.source}>⚠ {source.note}</p>
      ))}
      <p>
        Danske teaterdata kommer fra Teaterbilletter.dk (ca. 100 teatre i
        København og på Sjælland), hvor rollelister gør det muligt at søge på
        skuespillere og orkestre. MigogKBH.dk bidrager med flere Københavnske
        koncerter og forestillinger (kun titelmatch). Internationale koncerter
        kommer fra Ticketmaster.
      </p>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Dato ukendt";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Dato ukendt";

  const formatted = date.toLocaleDateString("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return time === "00:00" ? formatted : `${formatted} kl. ${time}`;
}
