/* Imports Metro Associates' live postings from its Top Echelon careers
 * portal into JobFolder's `jobs` table.
 *
 *   node --env-file=.env.local scripts/scrape-topechelon-jobs.mjs
 *   node --env-file=.env.local scripts/scrape-topechelon-jobs.mjs --draft
 *
 * The scraping/parsing itself lives in scripts/topechelon-scrape.mjs, shared
 * with lib/server/topechelon.ts — the same logic backs the admin console's
 * "Sync Top Echelon" button, so a fix here doesn't have to be made twice.
 *
 * Each Top Echelon job has a stable UUID; we store it as `te-<uuid>` (see
 * newId() in lib/server/repo.ts, which accepts a caller-supplied id), so
 * re-running this script is safe — an id already in the table is skipped,
 * never overwritten. That also means an admin's edits to an imported job
 * (category, status, added salary, etc.) survive future re-runs.
 *
 * New jobs land as status='open' and are on the board as soon as this
 * finishes. They imported as drafts until Oct 2026; the client asked for
 * imported roles to go straight on. Pass --draft for the old review-queue
 * behaviour, matching a job an admin creates by hand (see readJobWrite in
 * app/api/admin/jobWrite.ts).
 */

import mysql from "mysql2/promise";
import { fetchJobsFromFeed } from "./topechelon-scrape.mjs";

const PUBLISH = !process.argv.includes("--draft");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    connectTimeout: 15_000,
    ...(process.env.MYSQL_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
  });

  try {
    console.log("Fetching Top Echelon careers feed...");
    const feedJobs = await fetchJobsFromFeed();
    const teIds = feedJobs.map((job) => job.teId);
    console.log(`Found ${teIds.length} postings in the feed.`);

    /* Same guard as lib/server/topechelon.ts: an empty list means the fetch
       failed, not that Metro has no roles — never close the whole board on
       the back of it. */
    if (teIds.length === 0) {
      throw new Error(
        "Top Echelon returned no jobs — treating that as a failed fetch. Nothing was changed.",
      );
    }

    const [existingRows] = await conn.query(
      `SELECT id FROM jobs WHERE id LIKE 'te-%'`,
    );
    const existingIds = new Set(existingRows.map((r) => r.id));

    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const job of feedJobs) {
      const id = `te-${job.teId}`;
      if (existingIds.has(id)) {
        skipped++;
        continue;
      }

      await conn.execute(
        `INSERT INTO jobs
           (id, title, company, category, location, remote, employment_type,
            salary_min, salary_max, bounty, fee_tier, description,
            responsibilities, requirements, faqs, screening_questions,
            hiring_stages, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, job.title, job.company, job.category, job.location,
          false, job.employmentType,
          // salary_min, salary_max, bounty, then fee_tier: 'general' is
          // what feeTierForSalary(null, null) returns in lib/feeTiers.ts.
          // Duplicated as a literal because this is a plain .mjs script and
          // can't import the TypeScript module — keep the two in step.
          null, null, null, "general",
          job.description, "", "",
          JSON.stringify([]), JSON.stringify([]), JSON.stringify([]),
          PUBLISH ? "open" : "draft",
        ],
      );
      console.log(`  + ${job.title} — ${job.location} (${job.category})`);
      added++;
    }

    /* Close out roles Metro has taken down — see the same step in
       lib/server/topechelon.ts for why closed rather than deleted. */
    const live = new Set(teIds.map((teId) => `te-${teId}`));
    const [openRows] = await conn.query(
      `SELECT id, title, location FROM jobs WHERE id LIKE 'te-%' AND status <> 'closed'`,
    );
    const gone = openRows.filter((r) => !live.has(r.id));

    /* Same partial-fetch guard as lib/server/topechelon.ts, and for the same
       reason: the length check above only catches a portal that returned
       nothing, and closing is a one-way ratchet because the importer never
       revisits an id it has already stored. Keep the two in step. */
    const closeShare = openRows.length > 0 ? gone.length / openRows.length : 0;
    const closeLooksWrong = gone.length > 5 && closeShare > 0.3;

    if (closeLooksWrong) {
      console.warn(
        `\n! ${gone.length} of ${openRows.length} imported roles are missing from this fetch.` +
        `\n  That is too many to be a genuine withdrawal, so nothing was closed.` +
        `\n  Re-run, and if the number holds, close them from the admin console.`,
      );
    } else {
      for (const row of gone) {
        await conn.execute(`UPDATE jobs SET status = 'closed' WHERE id = ?`, [row.id]);
        console.log(`  - ${row.title} — ${row.location} (gone from portal, closed)`);
      }
    }

    console.log(
      `\nDone. ${added} added, ${skipped} already imported, ` +
      `${closeLooksWrong ? 0 : gone.length} closed, ${failed} failed.` +
      (added > 0 && !PUBLISH ? "\nNew jobs are drafts. Review and publish them from the admin console." : ""),
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
