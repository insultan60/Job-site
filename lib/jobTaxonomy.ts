import type { Job } from "./jobs";

/* Turns the job board into browsable landing pages — one per discipline and
 * one per state.
 *
 * Why these exist: /jobs is a single client-rendered page behind filters, so
 * search engines see one URL no matter how many roles are on it. Someone
 * searching "civil engineering jobs texas" has nothing to land on. These
 * pages give each real query its own indexable URL, built from data the
 * board already holds.
 *
 * Everything here is derived from live jobs rather than from a fixed list,
 * so a page only exists while it has roles on it. An empty landing page is
 * worse than no page: it wastes crawl budget and reads as abandoned.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    // "Transportation / DOT" -> "transportation-dot", "AWS / DevOps" -> "aws-devops"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Locations arrive as "Hartford, Connecticut" or occasionally
   "Bridgeport or Stratford, Connecticut" — the state is always the last
   comma-separated part. Anything without a comma has no state we can trust,
   and is left out rather than guessed at. */
export function stateOf(location: string): string | null {
  const parts = location.split(",");
  if (parts.length < 2) return null;
  const state = parts[parts.length - 1].trim();
  return state.length > 1 ? state : null;
}

export type Facet = {
  /** The human name, e.g. "Civil Engineering" or "Texas". */
  name: string;
  slug: string;
  count: number;
};

function tally(values: (string | null)[]): Facet[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: slugify(name), count }))
    .filter((f) => f.slug.length > 0)
    /* Busiest first: these lists double as the internal-linking block at the
       bottom of every landing page, and the pages with the most roles are the
       ones worth passing authority to. */
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* Catch-all buckets don't get a landing page. Nobody searches "other jobs",
   and a page titled that competes with nothing while diluting the set of
   URLs worth crawling. The roles still appear on /jobs and on their own
   state page — only the discipline landing page is withheld. */
const NON_LANDING_CATEGORIES = new Set(["other", "uncategorised", "uncategorized"]);

export function categoryFacets(jobs: Job[]): Facet[] {
  return tally(jobs.map((j) => j.category)).filter(
    (f) => !NON_LANDING_CATEGORIES.has(f.name.trim().toLowerCase()),
  );
}

export function stateFacets(jobs: Job[]): Facet[] {
  return tally(jobs.map((j) => stateOf(j.location)));
}

export function jobsInCategory(jobs: Job[], slug: string): Job[] {
  return jobs.filter((j) => slugify(j.category) === slug);
}

export function jobsInState(jobs: Job[], slug: string): Job[] {
  /* Washington, DC is its own location route. Job locations may store it
     either as the postal abbreviation or its full jurisdiction name. */
  const locationSlugs = slug === "washington-dc"
    ? ["dc", "district-of-columbia"]
    : [slug, STATE_ABBREVIATIONS[slug]].filter((value): value is string => Boolean(value));

  return jobs.filter((j) => {
    const state = stateOf(j.location);
    return state !== null && locationSlugs.includes(slugify(state));
  });
}

/* The job feed contains both full state names ("Alabama") and USPS
   abbreviations ("AL"). State landing pages must count both formats. */
const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
  hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms", missouri: "mo",
  montana: "mt", nebraska: "ne", nevada: "nv", "new-hampshire": "nh", "new-jersey": "nj",
  "new-mexico": "nm", "new-york": "ny", "north-carolina": "nc", "north-dakota": "nd", ohio: "oh",
  oklahoma: "ok", oregon: "or", pennsylvania: "pa", "rhode-island": "ri", "south-carolina": "sc",
  "south-dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
  virginia: "va", washington: "wa", "west-virginia": "wv", wisconsin: "wi", wyoming: "wy",
};

/** Reverses slugify well enough for a fallback heading — used only on a page
    whose roles have all closed, which is noindexed anyway. Won't restore
    punctuation ("transportation-dot" comes back as "Transportation Dot"),
    and doesn't need to. */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
