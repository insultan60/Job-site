/* Pure scraping/parsing for Metro Associates' Top Echelon careers portal — no
 * database access, so it can be imported both by the CLI script (plain node,
 * scripts/scrape-topechelon-jobs.mjs) and by the Next.js server
 * (lib/server/topechelon.ts, which owns the DB side and is what the admin
 * console's "Sync Top Echelon" button calls). Keeping the scraping/parsing
 * logic in one file means a fix to category rules or JSON-LD parsing doesn't
 * have to be made twice.
 */

/* What imported roles show as the employer. See the note in
   fetchJobPosting below for why this isn't taken from the feed. */
export const CONFIDENTIAL_CLIENT = "Confidential Client";

export const PORTAL_URL = "https://jobs.metroassoc.com/portals/3a7f6fd3-7cf7-447c-a20f-2354eb2031df";

// Checked in order — first match wins. Built from the actual job titles on
// Metro's portal; extend this if a future title doesn't match anything and
// falls through to "Other".
/* Annotated because this file is plain .mjs: without it the tuples infer as
   (RegExp | string)[], guessCategory's return widens to string | RegExp, and
   the TypeScript callers fail to compile on a category that is only ever a
   string. */
/** @type {[RegExp, string][]} */
export const CATEGORY_RULES = [
  // A resident engineer runs construction oversight on site — inspection
  // work under a different title, and the portal uses both.
  [/inspect|resident engineer/i, "CEI / Inspection"],
  [/bridge|structural/i, "Structural Engineering"],
  [/transportation|roadway|highway|traffic|dot\b|ctdot|indot|ridot|txdot|adot/i, "Transportation / DOT"],
  [/mechanical.*plumbing|\bmep\b/i, "MEP Engineering"],
  [/electrical/i, "Electrical Engineering"],
  [/mechanical|refrigeration|hvac/i, "Mechanical Engineering"],
  [/water|hydrology|wastewater/i, "Water / Hydrology"],
  [/civil|land development|land surveyor|site (civil|engineer)/i, "Civil Engineering"],
  // "Project engineer" and estimating both sit under delivery management in
  // this taxonomy; neither has a category of its own.
  [/project manager|program manager|project engineer|estimat/i, "Project Management"],
  [/architect/i, "Architecture (AEC)"],
];

export function guessCategory(title) {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(title)) return category;
  }
  return "Other";
}

export const EMPLOYMENT_TYPE_MAP = {
  "Direct Hire": "Full-time",
  "Full-time": "Full-time",
  "Part-time": "Part-time",
  Contract: "Contract",
  Temporary: "Temporary",
  Internship: "Internship",
};

/** The JobPosting `description` is a small, well-formed HTML fragment (p/ul/
 *  li/h3/strong) — not arbitrary markup — so a handful of targeted
 *  replacements is enough; no HTML-parser dependency needed for this. */
export function htmlToText(html) {
  return html
    .replace(/<h3[^>]*>/gi, "\n\n### ")
    .replace(/<\/h3>/gi, " ###\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* Top Echelon's "Careers Page XML Feed" for the same portal.
 *
 * The portal id here (98b4920e...) differs from PORTAL_URL's (3a7f6fd3...).
 * Both are aliases for the same portal and a job id resolves under either;
 * the feed is only published against this one.
 *
 * Public, not a secret: fetched unauthenticated, and the ATS prints it in the
 * admin UI for pasting into a website. */
export const FEED_URL =
  "https://bb3api.topechelon.com/api/v1/cp_xml_feed/98b4920e-874e-4ce2-b4d8-d7e203321579";

/** One field out of a <job> block. Top Echelon CDATA-wraps the free-text
 *  fields (positiontitle, description, city) and leaves the short controlled
 *  ones bare (state, country, dateposted, the type flags), so both shapes
 *  have to be handled. A regex that assumes CDATA silently returns nothing
 *  for half the fields. */
function field(block, tag) {
  const m = block.match(
    new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`),
  );
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

/** The feed carries three Yes/No flags rather than a type string. Direct hire
 *  is overwhelmingly what Metro posts, and is what every imported role was
 *  hardcoded to before, so it stays the fallback. */
function employmentTypeFromFlags(block) {
  if (field(block, "contract") === "Yes") return EMPLOYMENT_TYPE_MAP.Contract;
  if (field(block, "temptoperm") === "Yes") return EMPLOYMENT_TYPE_MAP.Temporary;
  return EMPLOYMENT_TYPE_MAP["Direct Hire"];
}

/* Reads every live role in one request.
 *
 * WHY THE FEED AND NOT THE PORTAL HTML
 *
 * fetchJobIds below scrapes PORTAL_URL for job ids, then fetchJobPosting
 * fetches each role's page and parses its JSON-LD: one request to list, one
 * per role, about forty in all. Both halves depend on a third party's markup.
 * The listing regex pulls ids out of hrefs, so a portal that renders
 * partially, paginates, or restyles returns a short list rather than an
 * error, and the caller's close-out step reads "short list" as "these roles
 * were withdrawn" and closes them. That is the likeliest explanation for a
 * board carrying more closed roles than the portal has live ones.
 *
 * The feed publishes title, description, city, state, country, posting date,
 * job id and type flags as named fields, which is what it exists for. One
 * request, no per-role fetches, and nothing that depends on how the portal
 * looks. The jobid is the same UUID the portal uses, so ids already stored as
 * `te-<uuid>` still match and nothing re-imports as a duplicate.
 *
 * A short feed is still possible in principle, which is why the callers keep
 * their guards on the close-out rather than trusting this.
 */
export async function fetchJobsFromFeed() {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  return [...xml.matchAll(/<job>([\s\S]*?)<\/job>/g)]
    .map((m) => m[1])
    .map((block) => {
      const title = field(block, "positiontitle") || "Untitled role";
      const city = field(block, "city");
      const state = field(block, "state");
      return {
        teId: field(block, "jobid"),
        title,
        /* Deliberately not the feed's publisher name — see CONFIDENTIAL_CLIENT
           above for why imported roles don't carry the agency's branding. */
        company: CONFIDENTIAL_CLIENT,
        category: guessCategory(title),
        location: [city, state].filter(Boolean).join(", "),
        description: htmlToText(field(block, "description")),
        employmentType: employmentTypeFromFlags(block),
      };
    })
    /* A block with no jobid can't be stored under a stable id, so it would
       re-import as a new row on every run. Drop it rather than churn. */
    .filter((job) => job.teId);
}

export async function fetchJobIds() {
  const res = await fetch(PORTAL_URL);
  if (!res.ok) throw new Error(`Portal fetch failed: ${res.status}`);
  const html = await res.text();
  const ids = [...html.matchAll(/\/jobs\/([a-f0-9-]{36})/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

export async function fetchJobPosting(teId) {
  const url = `${PORTAL_URL}/jobs/${teId}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const html = await res.text();
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return null;

  let posting;
  try {
    posting = JSON.parse(match[1]);
  } catch {
    return null;
  }

  const addr = posting.jobLocation?.address ?? {};
  const location = [addr.addressLocality, addr.addressRegion].filter(Boolean).join(", ");

  return {
    teId,
    title: posting.title ?? "Untitled role",
    /* Deliberately NOT posting.hiringOrganization.name.
     *
     * The source portal lists the recruiting agency as the hiring
     * organization, so every imported role arrived branded with that
     * agency's name and put it on the front of the JobFolder board.
     * JobFolder is its own brand and shouldn't advertise anyone else's.
     *
     * "Confidential Client" is also what these postings say about
     * themselves — most carry a "Confidential search, do not repost" line —
     * so it's accurate rather than merely anonymous. An admin can set a real
     * client name per job in the wizard, and that survives re-imports. */
    company: CONFIDENTIAL_CLIENT,
    category: guessCategory(posting.title ?? ""),
    location,
    description: htmlToText(posting.description ?? ""),
  };
}

/** Fetch job detail pages a few at a time — sequential would run 40+ external
 *  fetches back to back, which is slow and, for the admin route, risks the
 *  serverless request-duration limit. */
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
