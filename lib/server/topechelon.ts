import "server-only";
import { query, execute } from "@/lib/db";
import { createJob } from "@/lib/server/repo";
import { feeTierForSalary } from "@/lib/feeTiers";
import { fetchJobsFromFeed } from "../../scripts/topechelon-scrape.mjs";

/* Imports Metro Associates' live postings from its Top Echelon careers feed
   into the `jobs` table. This is the DB-touching half; the fetching/parsing
   itself lives in scripts/topechelon-scrape.mjs, shared with the CLI script
   (scripts/scrape-topechelon-jobs.mjs, for manual/scheduled runs) so a fix to
   category rules or feed parsing doesn't have to be made twice.

   Called from app/api/admin/jobs/sync-topechelon/route.ts — the admin
   console's "Sync Top Echelon" button.

   Each Top Echelon job has a stable UUID; it's stored as `te-<uuid>`, so
   re-running this is safe — an id already in the table is skipped, never
   overwritten. That also means an admin's edits to an imported job (category,
   status, added salary, etc.) survive future re-runs.

   New jobs land as status='open'. They imported as drafts until Oct 2026, so
   that nothing imported reached the public board without a human reading it
   first; the client asked for roles to go straight on. Pass
   { publish: false } to put the review step back. */

export type TopEchelonSyncResult = {
  found: number;
  added: number;
  skipped: number;
  failed: number;
  closed: number;
  /** Roles the close-out would have closed but didn't, because the set was
      large enough to suggest a partial fetch. Normally 0. */
  closeSkipped: number;
  addedJobs: { title: string; location: string; category: string }[];
  closedJobs: { title: string; location: string }[];
};

export async function runTopEchelonSync(
  { publish = true }: { publish?: boolean } = {},
): Promise<TopEchelonSyncResult> {
  const feedJobs = await fetchJobsFromFeed();
  const teIds: string[] = feedJobs.map((job) => job.teId);

  /* Guard the close-out step below. An empty list is never a legitimate
     "Metro has no open roles" signal — the portal has always listed dozens —
     so it means the fetch returned an error page or the markup changed.
     Closing every imported job on the back of that would take the whole
     board down, so refuse to act on it at all. */
  if (teIds.length === 0) {
    throw new Error(
      "Top Echelon returned no jobs — treating that as a failed fetch rather than an empty portal. Nothing was changed.",
    );
  }

  const existingRows = await query<{ id: string }>(
    `SELECT id FROM jobs WHERE id LIKE 'te-%'`,
  );
  const existingIds = new Set(existingRows.map((r) => r.id));

  /* The feed carries each role's description with the listing, so there is
     nothing left to fetch per job: the new ones are simply the ones not
     already stored. `failed` stays in the result for the callers and the
     audit log, but with no per-role request left to fail it is always 0. */
  const postings = feedJobs.filter((job) => !existingIds.has(`te-${job.teId}`));
  const skipped = feedJobs.length - postings.length;

  const addedJobs: TopEchelonSyncResult["addedJobs"] = [];
  const failed = 0;

  for (const job of postings) {
    await createJob(
      {
        title: job.title,
        company: job.company,
        category: job.category,
        location: job.location,
        remote: false,
        employmentType: job.employmentType,
        salaryMin: null,
        salaryMax: null,
        bounty: null,
        /* Top Echelon doesn't publish a salary range, so this always resolves
           to the "no range published" tier. Derived rather than hardcoded so
           that if the parser ever starts picking up a range, the fee follows
           it without a second change here. Imported jobs used to land with
           feeTier: null, which showed recruiters a role with no fee at all —
           the one number that makes them act. */
        feeTier: feeTierForSalary(null, null),
        description: job.description,
        responsibilities: "",
        requirements: "",
        faqs: "[]",
        screeningQuestions: "[]",
        hiringStages: "[]",
        status: publish ? "open" : "draft",
      },
      `te-${job.teId}`,
    );
    addedJobs.push({ title: job.title, location: job.location, category: job.category });
  }

  /* Close out roles Metro has taken down. Without this the sync only ever
     grows the board: a filled role vanishes from the portal but stays
     'open' here forever, so people keep applying to it.

     Closed rather than deleted — a job row may already have submissions
     hanging off it, and an admin can reopen one if it comes back. Drafts
     get closed too, not just open roles: a draft whose source posting is
     already gone should not be sitting in the review queue waiting to be
     published. */
  const livePortalIds = new Set(teIds.map((teId) => `te-${teId}`));
  const goneRows = await query<{ id: string; title: string; location: string }>(
    `SELECT id, title, location FROM jobs
      WHERE id LIKE 'te-%' AND status <> 'closed'`,
  );
  const gone = goneRows.filter((r) => !livePortalIds.has(r.id));

  /* Second guard on the close-out, for a fetch that came back short rather
     than empty.

     The length check at the top of this function catches a portal that
     returned an error page. It does nothing for one that returned half its
     roles because a request timed out, a page of results failed to render, or
     the markup changed partway down the list. Every role missing from that
     one run gets closed here.

     Closing is a ratchet. The importer skips ids already in the table, so a
     role closed by mistake is never reopened by a later sync, and a few short
     fetches can quietly retire most of the board. Metro withdrawing a third
     of its live roles between two syncs is not a thing that happens; a
     partial fetch is, and the two are indistinguishable from in here.

     So when the close set is implausibly large, assume the fetch and not the
     portal, and close nothing. Imports still proceed. A genuine bulk
     withdrawal just means an admin closes those by hand, which is the
     recoverable direction to fail in. */
  const closeShare = goneRows.length > 0 ? gone.length / goneRows.length : 0;
  const closeLooksWrong = gone.length > 5 && closeShare > 0.3;

  if (!closeLooksWrong) {
    for (const row of gone) {
      await execute(`UPDATE jobs SET status = 'closed' WHERE id = ?`, [row.id]);
    }
  }

  return {
    found: teIds.length,
    added: addedJobs.length,
    skipped,
    failed,
    closed: closeLooksWrong ? 0 : gone.length,
    closeSkipped: closeLooksWrong ? gone.length : 0,
    addedJobs,
    closedJobs: closeLooksWrong
      ? []
      : gone.map((r) => ({ title: r.title, location: r.location })),
  };
}
