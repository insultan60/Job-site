"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type State = {
  name: string;
  slug: string;
  count: number;
};

export function StateDirectory({ states }: { states: State[] }) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");

  const visibleStates = useMemo(() => {
    const search = query.trim().toLowerCase();

    return states
      .filter((state) => availability === "all" || state.count > 0)
      .filter((state) => !search || state.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availability, query, states]);

  return (
    <>
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Browse by location</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Select a state</h2>
      </div>

      <div className="mb-7 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-2 shadow-[0_20px_50px_-35px_rgba(23,19,15,0.4)]">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search states</span>
          <input
            className="h-11 w-full rounded-xl border-0 bg-transparent pl-10 text-sm text-ink outline-none placeholder:text-muted"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a state or Washington, DC…"
          />
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </label>
        <div className="hidden h-8 w-px bg-line sm:block" />
        <label className="flex shrink-0 items-center gap-2 pr-2 text-sm">
          <span className="text-muted">Show</span>
          <select
            className="rounded-lg border-0 bg-transparent py-2 pr-6 text-sm font-semibold text-ink outline-none"
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option value="all">All locations</option>
            <option value="open">Locations with open roles</option>
          </select>
        </label>
      </div>

      {visibleStates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStates.map((state) => (
            <Link
              key={state.slug}
              href={`/jobs/state/${state.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-line bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_32px_-24px_rgba(23,19,15,0.45)]"
            >
              <span className="absolute left-0 top-0 h-full w-1 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">State jobs</p>
                  <h3 className="mt-2 text-xl font-bold text-ink transition-colors group-hover:text-primary">
                    {state.name}
                  </h3>
                </div>
                <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                  {state.count}
                </span>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                <span className="text-sm text-muted">
                  {state.count === 1 ? "1 position available" : `${state.count} positions available`}
                </span>
                <span className="text-sm font-bold text-primary">View roles</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
          <p className="font-semibold text-ink">No locations found</p>
          <button type="button" onClick={() => { setQuery(""); setAvailability("all"); }} className="mt-2 text-sm font-semibold text-primary hover:underline">
            Clear search and filters
          </button>
        </div>
      )}
    </>
  );
}
