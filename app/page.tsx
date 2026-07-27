"use client";

import { FormEvent, useState } from "react";
import type { Profession, ShowResult } from "./api/search/route";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; results: ShowResult[] };

export default function Home() {
  const [name, setName] = useState("");
  const [profession, setProfession] = useState<Profession>("skuespiller");
  const [onlyDenmark, setOnlyDenmark] = useState(false);
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({
        name: name.trim(),
        profession,
        onlyDenmark: String(onlyDenmark),
      });
      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setState({
          status: "error",
          message: data.message ?? "Der skete en uventet fejl.",
        });
        return;
      }
      setState({ status: "success", results: data.results });
    } catch {
      setState({
        status: "error",
        message: "Kunne ikke gennemføre søgningen. Tjek din forbindelse.",
      });
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Find forestillinger & koncerter
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Søg på en skuespiller eller musiker og få en liste over deres
            kommende teaterforestillinger og koncerter.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Navn
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Sidse Babett Knudsen"
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

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
          Data leveres af Ticketmasters database og dækker derfor ikke
          nødvendigvis alle danske teatre og spillesteder.
        </p>
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

  if (state.results.length === 0) {
    return (
      <p className="text-center text-zinc-500">
        Ingen kommende forestillinger eller koncerter fundet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {state.results.map((show) => (
        <li
          key={show.id}
          className="flex gap-4 overflow-hidden rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
        >
          {show.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={show.imageUrl}
              alt=""
              className="hidden h-24 w-24 flex-none rounded-lg object-cover sm:block"
            />
          )}
          <div className="flex flex-1 flex-col gap-1">
            <h2 className="font-medium text-black dark:text-zinc-50">
              {show.name}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatDate(show.date, show.time)}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {[show.venueName, show.city, show.country]
                .filter(Boolean)
                .join(", ")}
            </p>
            {show.url && (
              <a
                href={show.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm font-medium text-black underline underline-offset-2 dark:text-white"
              >
                Køb billet →
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatDate(date: string | null, time: string | null): string {
  if (!date) return "Dato ukendt";
  const formatted = new Date(`${date}T${time ?? "00:00:00"}`).toLocaleDateString(
    "da-DK",
    { weekday: "short", day: "numeric", month: "long", year: "numeric" },
  );
  return time ? `${formatted} kl. ${time.slice(0, 5)}` : formatted;
}
