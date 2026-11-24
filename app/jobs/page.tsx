"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/ui";
import { Loader } from "@/components/Loader";
import { listOpenJobs, type Job } from "@/lib/jobs";
import { getCategories, DEFAULT_CATEGORIES } from "@/lib/categories";
import {
  getBoardFilters, statesFor, DEFAULT_FILTERS, type BoardFilters,
} from "@/lib/boardFilters";
import { formatPay } from "@/components/jobFormat";
import { timeAgo } from "@/lib/dates";
import { FEE_TIERS, feeTierMeta, feeTierAmount } from "@/lib/feeTiers";
import { useSavedJobs } from "@/lib/savedJobs";
import { jobsInState, slugify } from "@/lib/jobTaxonomy";

/* The state list and the pay ceiling used to be hardcoded here. They now come
   from lib/boardFilters (defaults) and the console (overrides), so the board
   and the admin screen can't disagree about them. */

const SORTS = ["newest", "fee"] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABEL: Record<Sort, string> = { newest: "Newest post", fee: "Highest fee" };

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Seed the search box from ?q= so links into a pre-filtered board work — this
     is the URL the sitelinks SearchAction in lib/seo.ts points at. Read during
     the initial render rather than in an effect, which would cause a second
     render pass. The Suspense boundary this needs lives in ./layout.tsx. */
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [feeTiers, setFeeTiers] = useState<Set<string>>(new Set());
  const [stateFilter, setStateFilter] = useState("All");
  const [remote, setRemote] = useState(false);
  const [onsite, setOnsite] = useState(false);
  const [minSalary, setMinSalary] = useState(0);
  const { saved, toggle: toggleSaved } = useSavedJobs();
  const [view, setView] = useState<"board" | "list">("board");
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    listOpenJobs()
      .then(setJobs)
      .catch(() => setError("Could not load roles right now."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { getCategories().then(setCategories); }, []);
  /* Job types, the pay ceiling and the location list are all set in the
     console. Both helpers swallow their own errors and return defaults, so a
     failed read leaves a working filter bar rather than empty dropdowns. */
  useEffect(() => { getBoardFilters().then(setFilters); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const stateSlug = stateFilter !== "All" ? slugify(stateFilter) : null;
    const rows = jobs.filter((j) => {
      if (onlySaved && !saved.has(j.id)) return false;
      if (remote && !onsite && !j.remote) return false;
      if (onsite && !remote && j.remote) return false;
      /* State pages accept both full names and USPS abbreviations, for example
         "Arizona" and "AZ". Reuse that same matching logic here so the board
         cannot undercount a state when the job feed uses its abbreviation. */
      if (stateSlug && jobsInState([j], stateSlug).length === 0) return false;
      if (types.size && !types.has(j.employmentType)) return false;
      if (cats.size && !cats.has(j.category)) return false;
      if (feeTiers.size && !(j.feeTier && feeTiers.has(j.feeTier))) return false;
      if (minSalary > 0 && (j.salaryMax ?? j.salaryMin ?? 0) < minSalary) return false;
      if (needle) {
        const hay = `${j.title} ${j.company} ${j.category} ${j.location} ${j.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    if (sort === "fee") {
      return [...rows].sort((a, b) => (feeTierAmount(b.feeTier) ?? 0) - (feeTierAmount(a.feeTier) ?? 0));
    }
    return rows; // API already orders newest-first
  }, [jobs, q, cats, types, feeTiers, stateFilter, remote, onsite, minSalary, onlySaved, saved, sort]);

  const activeCount =
    cats.size + types.size + feeTiers.size + (stateFilter !== "All" ? 1 : 0) +
    (remote ? 1 : 0) + (onsite ? 1 : 0) + (minSalary > 0 ? 1 : 0);

  function toggleIn(set: Set<string>, key: string, apply: (s: Set<string>) => void) {
    const n = new Set(set);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    apply(n);
  }
  function clearAll() {
    setQ(""); setCats(new Set()); setTypes(new Set()); setFeeTiers(new Set());
    setStateFilter("All"); setRemote(false); setOnsite(false); setMinSalary(0);
  }

  // Per-option counts for the sidebar checkboxes — honest, computed from what
  // actually loaded, same idea as the old "honest sidebar" this replaces.
  const countByCategory = useMemo(() => countOf(jobs.map((j) => j.category)), [jobs]);
  const countByType = useMemo(() => countOf(jobs.map((j) => j.employmentType)), [jobs]);
  const countByFeeTier = useMemo(
    () => countOf(jobs.map((j) => j.feeTier).filter((t): t is string => Boolean(t))),
    [jobs],
  );
  const remoteCount = useMemo(() => jobs.filter((j) => j.remote).length, [jobs]);
  const onsiteCount = jobs.length - remoteCount;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">
        <Container className="py-8 lg:py-10">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Open roles
            </span>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Engineering &amp; DOT jobs
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted">
              Civil, structural, transportation and technical roles — each one
              showing the recruiter fee you earn on a successful hire.
            </p>
          </div>

          {/* search + sort */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-2 shadow-[0_20px_50px_-35px_rgba(23,19,15,0.4)]">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search</span>
              <input
                className="h-11 w-full rounded-xl border-0 bg-transparent pl-10 text-sm text-ink outline-none placeholder:text-muted"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, company, location…"
              />
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </label>
            <div className="hidden h-8 w-px bg-line sm:block" />
            <label className="flex shrink-0 items-center gap-2 pr-2 text-sm">
              <span className="text-muted">Sort</span>
              <select
                className="rounded-lg border-0 bg-transparent py-2 pr-6 text-sm font-semibold text-ink outline-none"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                {SORTS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
              </select>
            </label>
          </div>

          {/* body: left filter sidebar + listing */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="lg:sticky lg:top-32 lg:self-start">
              <div className="space-y-5 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:pr-2 lg:[-ms-overflow-style:none] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
                {activeCount > 0 && (
                <button
                  onClick={clearAll}
                  className="text-sm font-semibold text-coral hover:opacity-80"
                >
                  Clear all filters
                </button>
              )}

              <FilterGroup title="Job type">
                {filters.employmentTypes.map((t) => (
                  <FilterCheck
                    key={t}
                    label={t}
                    count={countByType.get(t) ?? 0}
                    checked={types.has(t)}
                    onChange={() => toggleIn(types, t, setTypes)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Location">
                <FilterCheck label="Remote" count={remoteCount} checked={remote} onChange={() => setRemote((v) => !v)} />
                <FilterCheck label="Onsite" count={onsiteCount} checked={onsite} onChange={() => setOnsite((v) => !v)} />
                <select
                  className="input mt-2 h-9 text-sm"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                >
                  <option value="All">All US locations</option>
                  {statesFor(filters).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FilterGroup>

              <FilterGroup title="Category">
                <div className="space-y-2">
                  {categories.map((c) => (
                    <FilterCheck
                      key={c}
                      label={c}
                      count={countByCategory.get(c) ?? 0}
                      checked={cats.has(c)}
                      onChange={() => toggleIn(cats, c, setCats)}
                    />
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup title="Recruiter fee">
                {FEE_TIERS.map((t) => (
                  <FilterCheck
                    key={t.value}
                    label={`$${t.amount.toLocaleString()} — ${t.label}`}
                    count={countByFeeTier.get(t.value) ?? 0}
                    checked={feeTiers.has(t.value)}
                    onChange={() => toggleIn(feeTiers, t.value, setFeeTiers)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Pay">
                <p className="text-sm font-semibold text-ink">
                  {minSalary === 0 ? "Any salary" : `$${minSalary.toLocaleString()}+`}
                </p>
                <input
                  type="range"
                  min={0}
                  max={filters.salaryMax}
                  step={5000}
                  value={minSalary}
                  onChange={(e) => setMinSalary(Number(e.target.value))}
                  className="mt-2 w-full accent-ink"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted">
                  <span>$0</span>
                  <span>${filters.salaryMax.toLocaleString()}+</span>
                </div>
              </FilterGroup>
              </div>
            </aside>

            {/* listing */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink">
                  {loading ? "…" : filtered.length} job{filtered.length === 1 ? "" : "s"} found
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full border border-line p-1">
                    <ViewBtn active={view === "list"} onClick={() => setView("list")} label="List" />
                    <ViewBtn active={view === "board"} onClick={() => setView("board")} label="Board" />
                  </div>
                  <button
                    onClick={() => setOnlySaved((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                      onlySaved ? "border-primary bg-primary-soft text-primary" : "border-line text-ink hover:bg-black/[0.03]"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill={onlySaved ? "currentColor" : "none"} aria-hidden>
                      <path d="M5 3h10v14l-5-3.5L5 17V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                    Saved ({saved.size})
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {error ? (
                  <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>
                ) : loading ? (
                  <div className="grid h-64 place-items-center rounded-2xl border border-line"><Loader /></div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line p-12 text-center">
                    <h3 className="font-bold text-ink">
                      {onlySaved ? "No saved jobs yet" : jobs.length === 0 ? "No open roles right now" : "No roles match your filters"}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {onlySaved ? "Bookmark roles to see them here." : "Try clearing some filters."}
                    </p>
                  </div>
                ) : view === "board" ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((job) => (
                      <JobCard key={job.id} job={job} saved={saved.has(job.id)} onSave={() => toggleSaved(job.id)} />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-line rounded-2xl border border-line bg-white">
                    {filtered.map((job) => (
                      <JobListRow key={job.id} job={job} saved={saved.has(job.id)} onSave={() => toggleSaved(job.id)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

/* ---- job card ---- */
function JobCard({ job, saved, onSave }: { job: Job; saved: boolean; onSave: () => void }) {
  return (
    <div className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_20px_50px_-30px_rgba(23,19,15,0.35)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary"
          >
            {initials(job.company || job.title)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">{job.company || "Confidential"}</span>
              <span title="JobFolder-vetted role" className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-primary text-white">
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <p className="text-xs text-muted">Posted {timeAgo(job.createdAt)}</p>
          </div>
        </div>
        <button type="button" onClick={onSave} aria-label={saved ? "Remove bookmark" : "Save job"}
          className={`shrink-0 transition-colors ${saved ? "text-primary" : "text-muted hover:text-ink"}`}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill={saved ? "currentColor" : "none"} aria-hidden>
            <path d="M5 3h10v14l-5-3.5L5 17V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <Link href={`/jobs/${job.id}`} className="mt-3 text-lg font-bold leading-snug text-ink group-hover:text-primary">
        {job.title}
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <Meta icon="M4 7h12v9H4zM7 7V5h6v2" text={job.employmentType} />
        <Meta icon="M10 2a5 5 0 015 5c0 3.5-5 9-5 9S5 10.5 5 7a5 5 0 015-5zM10 9a2 2 0 100-4 2 2 0 000 4z" text={job.remote ? "Remote" : job.location || "Onsite"} />
        <Tag>{job.category}</Tag>
      </div>

      {/* Recruiter fee — the thing a recruiter scans for first, so it sits
          right under the title/meta, not buried at the card's bottom. */}
      {(() => {
        const tier = feeTierMeta(job.feeTier);
        return tier ? (
          <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-pill bg-sage-soft px-3 py-1.5 text-sm font-bold text-ink">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M10 2v16M14.5 5.5H8.25a2.25 2.25 0 000 4.5h3.5a2.25 2.25 0 010 4.5H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Recruiter Fee: ${tier.amount.toLocaleString()}
          </div>
        ) : null;
      })()}

      {job.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{job.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="shrink-0 text-sm font-semibold text-muted">{formatPay(job)}</p>
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill bg-cream px-3.5 py-1.5 text-sm font-semibold text-ink transition-colors group-hover:bg-primary group-hover:text-white"
        >
          View &amp; work position
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/* ---- compact list row — dense, scannable rows for recruiters skimming a
   lot of roles at once; the fee is what they're scanning for, so it sits
   right-aligned where the eye lands after the title. ---- */
function JobListRow({ job, saved, onSave }: { job: Job; saved: boolean; onSave: () => void }) {
  const tier = feeTierMeta(job.feeTier);
  return (
    <div className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-cream/40">
      <span
        title="Open role"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-sage bg-sage-soft text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-ink group-hover:text-primary">{job.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {job.company || "Confidential"} · {job.remote ? "Remote" : job.location || "Onsite"} · {job.employmentType}
        </p>
      </Link>

      {tier && (
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-lg font-extrabold text-primary">${tier.amount.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-muted">Posted {timeAgo(job.createdAt)}</p>
          <span className="mt-1 inline-block rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
            Success fee
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onSave}
        aria-label={saved ? "Remove bookmark" : "Save job"}
        className={`shrink-0 transition-colors ${saved ? "text-primary" : "text-muted hover:text-ink"}`}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill={saved ? "currentColor" : "none"} aria-hidden>
          <path d="M5 3h10v14l-5-3.5L5 17V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/** Up to two initials from a company name, for the card avatar. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d={icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {text}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-lg bg-cream px-2.5 py-1 text-xs font-medium text-muted">{children}</span>;
}

/* ---- left filter sidebar ---- */
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterCheck({
  label, count, checked, onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-ink">
        <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-ink" />
        {label}
      </span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
        checked ? "bg-primary-soft text-primary" : "bg-cream text-muted"
      }`}>
        {count}
      </span>
    </label>
  );
}

function ViewBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${active ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
      {label}
    </button>
  );
}

/* ---- helpers ---- */
function countOf(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return map;
}
