import { handle, ok } from "@/lib/server/respond";
import { requireAdminIdentity } from "@/lib/server/auth";
import { logAdminAction } from "@/lib/server/repo";
import { runTopEchelonSync } from "@/lib/server/topechelon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fetches the portal listing plus one detail page per new job (5 at a time).
// Comfortably under a minute for Metro's current ~40-job portal; raise this
// if the portal grows a lot and the route starts timing out.
export const maxDuration = 60;

/** Admin: pull Metro's live Top Echelon postings into `jobs` as open roles.
    Same logic as `npm run scrape:topechelon`, triggered from the console
    instead of the CLI. Imported roles landed as drafts for review until
    Oct 2026; the client asked for them to go straight onto the board, so a
    sync now publishes. Pass publish: false to put the review step back. */
export function POST(req: Request) {
  return handle(async () => {
    const actor = await requireAdminIdentity(req);

    const result = await runTopEchelonSync({ publish: true });

    await logAdminAction({
      action: "jobs_synced",
      actorUid: actor.uid, actorName: actor.name, actorEmail: actor.email,
      targetUid: null, targetName: "Top Echelon", targetEmail: "",
      details:
        `${result.added} added, ${result.skipped} already imported, ${result.failed} failed (of ${result.found} found).` +
        (result.closeSkipped > 0
          ? ` Close-out skipped: ${result.closeSkipped} roles were missing from this fetch, which is too many to be a genuine withdrawal, so none were closed.`
          : ""),
    });

    return ok(result);
  });
}
