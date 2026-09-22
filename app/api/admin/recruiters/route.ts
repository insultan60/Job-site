import { handle, ok, jsonBody, BadRequest } from "@/lib/server/respond";
import {
  listUsers, getUserProfile, deleteRecruiter, countSubmissionsByRecruiter,
  isAdminUid, logAdminAction,
} from "@/lib/server/repo";
import { requireAdmin, requireAdminIdentity } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin: the recruiter roster. */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return ok(await listUsers());
  });
}

/* How many accounts one request may remove.
 *
 * Not a safety rail against a determined admin — they can send a second
 * request. It is a rail against a mis-click on "select all" with a thousand
 * rows behind it, and it keeps the request inside the function's time budget,
 * since each uid costs a profile read, a submission count, a delete and an
 * audit write. The console asks for confirmation well before this. */
const MAX_PER_REQUEST = 200;

/* Admin: delete recruiter accounts.
 *
 * Bulk by design. The list this serves fills with bot signups — dozens at a
 * time, all pending, all with an unreadable name and no submissions — and
 * removing them one page at a time was the only option.
 *
 * WHAT SURVIVES A DELETE
 *
 * Submitted candidates. submissions.recruiter_id is ON DELETE SET NULL, so
 * the submission stays and loses its recruiter attribution. Deleting a
 * spammer must never delete a client's record of a real placement, and the
 * per-uid submission count comes back in the response so the console can say
 * so out loud before anyone confirms.
 *
 * WHAT IS REFUSED
 *
 * Admin accounts, and the caller's own. Removing console access is a
 * deliberate act on the Admins page, not a side effect of tidying a list.
 *
 * Firebase Auth is untouched either way (no service-account key server-side,
 * see lib/server/auth.ts): a deleted person who signs in again gets a fresh
 * blank profile. This is a reset, not a ban.
 */
export function DELETE(req: Request) {
  return handle(async () => {
    const actor = await requireAdminIdentity(req);
    const body = await jsonBody(req);

    const raw = body.uids;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new BadRequest("Send uids: a non-empty array of recruiter ids.");
    }
    if (raw.some((u) => typeof u !== "string" || !u.trim())) {
      throw new BadRequest("Every uid must be a non-empty string.");
    }

    // De-duplicated so a repeated id cannot inflate the counts below.
    const uids = [...new Set((raw as string[]).map((u) => u.trim()))];
    if (uids.length > MAX_PER_REQUEST) {
      throw new BadRequest(
        `Too many at once — ${MAX_PER_REQUEST} is the limit per request, ${uids.length} were sent.`,
      );
    }

    const deleted: { uid: string; name: string; email: string; submissions: number }[] = [];
    const notFound: string[] = [];
    const refused: { uid: string; name: string; reason: string }[] = [];
    /* Deletes that went through but could not be written to the audit log.
       Almost always one cause: db-migrate-audit-recruiter-deleted.mjs has not
       been run against this database. */
    let auditFailed = 0;

    for (const uid of uids) {
      const recruiter = await getUserProfile(uid);
      if (!recruiter) {
        // Already gone, or never existed. Reported rather than thrown: one
        // stale row in a selection of forty should not fail the other
        // thirty-nine.
        notFound.push(uid);
        continue;
      }

      if (uid === actor.uid) {
        refused.push({ uid, name: recruiter.name || recruiter.email, reason: "This is your own account." });
        continue;
      }
      if (await isAdminUid(uid)) {
        refused.push({
          uid,
          name: recruiter.name || recruiter.email,
          reason: "Has console access — revoke it on the Admins page first.",
        });
        continue;
      }

      const submissions = await countSubmissionsByRecruiter(uid);
      const removed = await deleteRecruiter(uid);
      if (!removed) {
        notFound.push(uid);
        continue;
      }

      deleted.push({ uid, name: recruiter.name, email: recruiter.email, submissions });

      /* One entry per account, not one per batch. The audit log is where
         "where did this recruiter go" gets answered months later, and that
         question is always about one person.

         Wrapped, because the row is already gone by the time this runs. The
         action column is an ENUM under STRICT_ALL_TABLES, so on a database
         where the migration has not been applied this insert throws, handle()
         turns it into a 500, and the console reports failure for a delete
         that actually succeeded — the worst of both. Reported instead: the
         accounts are gone, the response says the audit entry is missing, and
         the admin is told to run the migration rather than left guessing. */
      try {
        await logAdminAction({
          action: "recruiter_deleted",
          actorUid: actor.uid,
          actorName: actor.name,
          actorEmail: actor.email,
          targetUid: uid,
          targetName: recruiter.name,
          targetEmail: recruiter.email,
          details:
            submissions > 0
              ? `Deleted with ${submissions} submission${submissions === 1 ? "" : "s"} (kept, recruiter cleared)`
              : "Deleted with no submissions",
        });
      } catch (err) {
        console.error("[api] recruiter delete: audit write failed", err);
        auditFailed += 1;
      }
    }

    return ok({
      deleted: deleted.length,
      /* Ids as well as names: the console drops these rows from the list it is
         already holding rather than refetching the whole roster. */
      deletedUids: deleted.map((d) => d.uid),
      deletedNames: deleted.map((d) => d.name || d.email),
      submissionsDetached: deleted.reduce((n, d) => n + d.submissions, 0),
      notFound: notFound.length,
      refused,
      auditFailed,
    });
  });
}
