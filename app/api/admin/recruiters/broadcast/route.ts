import {
  handle, ok, jsonBody, str, bool, oneOf, BadRequest,
} from "@/lib/server/respond";
import {
  listUsers, createNotification, logAdminAction, getSetting, setSetting,
} from "@/lib/server/repo";
import { requireAdminIdentity } from "@/lib/server/auth";
import { notifyAdminMessage } from "@/lib/server/notify";
import { findTemplate, fillTemplate, type CustomTemplate } from "@/lib/adminEmailTemplates";
import { AUDIENCE_IDS, audienceById, recipientsOf, type AudienceId } from "@/lib/audiences";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Each send waits on Brevo, so this needs far more than the 10s default. The
   deadline guard below stops well inside it and reports what's left. */
export const maxDuration = 60;

/* Same rate the reminder sweep uses — Brevo is comfortable with it and it
   keeps a few hundred recipients inside maxDuration. */
const CONCURRENCY = 4;
const DEADLINE_MS = 45_000;

/* How long the same message to the same audience is refused as a duplicate.
   This is the one-button-mails-everyone problem: a double click, a retry
   after a flaky response, or two admins reaching for it the same morning all
   land as the identical email arriving twice, which is the fastest way to get
   marked as spam on a domain with no sending history. Overridable with
   `force` for the rare case where you did mean to send it again. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const DUPLICATE_KEY = "admin_broadcast_last";

type LastBroadcast = { key: string; at: number; by: string } | null;

/** Admin: send one message to a whole audience of recruiters.
 *
 *  The recipient list is computed HERE, from the audience name, against the
 *  same predicates the console counted with (lib/audiences.ts). The request
 *  never supplies addresses, so this can't be turned into a general-purpose
 *  mailer — it can only ever reach people who already have an account.
 *
 *  `only` exists for continuing a run that ran out of time, and is treated as
 *  a filter rather than a list: it's intersected with the audience, so a
 *  continuation can only ever be a subset of a real audience.
 */
export function POST(req: Request) {
  return handle(async () => {
    const actor = await requireAdminIdentity(req);
    const startedAt = Date.now();

    const body = await jsonBody(req);
    const audienceId = oneOf<AudienceId>(body.audience, AUDIENCE_IDS, "audience");
    const subject = str(body.subject, "subject", { required: true, max: 255 });
    const message = str(body.body, "body", { required: true, max: 20000 });

    /* Two channels, one action — the same reasoning as the single-recruiter
       composer. Email leaves the product and can bounce or be filtered; the
       dashboard copy is the one that survives and records being read. */
    const sendEmail = body.email === undefined ? true : bool(body.email);
    const sendNotification = body.notify === undefined ? true : bool(body.notify);
    if (!sendEmail && !sendNotification) {
      throw new BadRequest("Choose at least one of email or dashboard notification.");
    }

    // A continuation of an earlier run, not a fresh send.
    let only: Set<string> | null = null;
    if (body.only !== undefined && body.only !== null) {
      if (!Array.isArray(body.only)) throw new BadRequest("only must be an array of uids.");
      only = new Set(body.only.filter((u): u is string => typeof u === "string"));
    }

    const audience = audienceById(audienceId);
    if (!audience) throw new BadRequest("Unknown audience.");

    /* Duplicate guard. Skipped for a continuation, which is by definition the
       same message to the same audience and is exactly what we want to allow. */
    const duplicateKey = `${audienceId}|${subject}`;
    if (!only && !bool(body.force)) {
      const last = await getSetting<LastBroadcast>(DUPLICATE_KEY, null);
      if (last && last.key === duplicateKey && Date.now() - last.at < DUPLICATE_WINDOW_MS) {
        const minutes = Math.max(1, Math.round((Date.now() - last.at) / 60000));
        throw new BadRequest(
          `"${subject}" already went to ${audience.label} ${minutes} minute${minutes === 1 ? "" : "s"} ago` +
            `${last.by ? `, sent by ${last.by}` : ""}. Send it again only if you meant to.`,
        );
      }
    }

    const users = await listUsers();
    let recipients = recipientsOf(audienceId, users);
    if (only) recipients = recipients.filter((u) => only.has(u.uid));

    /* Only the button survives from the template at this point — the subject
       and body arrive already edited, so a stale template can't override what
       the admin actually typed and read back in the preview. */
    const custom = await getSetting<CustomTemplate[]>("admin_message_templates", []);
    const template = findTemplate(str(body.templateId, "templateId", { max: 64 }), custom);
    const button = template?.cta
      ? { label: template.cta.label, url: `${SITE_URL}${template.cta.path}` }
      : undefined;

    // Nothing to do — say so plainly rather than logging an empty send.
    if (recipients.length === 0) {
      return ok({
        audience: audienceId,
        audienceLabel: audience.label,
        total: 0, sent: 0, emailed: 0, notified: 0,
        failed: [], skippedNoEmail: 0, remainingUids: [],
      });
    }

    let emailed = 0;
    let notified = 0;
    let skippedNoEmail = 0;
    const sentNames: string[] = [];
    const failed: { name: string; email: string }[] = [];
    let cursor = 0;

    async function worker() {
      while (cursor < recipients.length) {
        if (Date.now() - startedAt > DEADLINE_MS) return;
        const person = recipients[cursor++];

        // Nothing to deliver to this one: email-only send, no address on file.
        if (sendEmail && !sendNotification && !person.email) {
          skippedNoEmail++;
          continue;
        }

        const filledSubject = fillTemplate(subject, person.name);
        const filledBody = fillTemplate(message, person.name);
        let reached = false;

        /* The notification goes first: it's the durable half. If Brevo is
           down the recruiter still gets the message where they sign in, and
           the admin is told the email didn't go rather than left guessing. */
        if (sendNotification) {
          try {
            await createNotification({
              recipientUid: person.uid,
              title: filledSubject,
              body: filledBody,
              link: template?.cta?.path ?? "",
              source: "admin",
              authorName: actor.name,
            });
            notified++;
            reached = true;
          } catch (err) {
            console.error("[broadcast] notification failed for", person.uid, err);
          }
        }

        if (sendEmail) {
          if (!person.email) {
            skippedNoEmail++;
          } else {
            try {
              await notifyAdminMessage({
                toName: person.name,
                toEmail: person.email,
                subject: filledSubject,
                body: filledBody,
                ...(button ? { button } : {}),
              });
              emailed++;
              reached = true;
            } catch (err) {
              console.error("[broadcast] email failed for", person.email, err);
            }
          }
        }

        if (reached) sentNames.push(person.name || person.email);
        else failed.push({ name: person.name, email: person.email });
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, recipients.length) }, worker),
    );

    /* Everything a worker claimed has finished by now — the deadline is only
       checked before claiming — so whatever is still past the cursor is what
       genuinely didn't go out. Handing the uids back is what lets the console
       continue without mailing the first batch a second time. */
    const remainingUids = recipients.slice(cursor).map((u) => u.uid);

    if (sentNames.length > 0 || failed.length > 0) {
      await setSetting(DUPLICATE_KEY, {
        key: duplicateKey,
        at: Date.now(),
        by: actor.name || actor.email,
      } satisfies NonNullable<LastBroadcast>);

      /* One entry per run, not one per recipient: forty rows per click would
         bury every other admin action in the log. */
      await logAdminAction({
        action: "broadcast_sent",
        actorUid: actor.uid, actorName: actor.name, actorEmail: actor.email,
        targetUid: null,
        targetName: `${sentNames.length} recruiter${sentNames.length === 1 ? "" : "s"}`,
        targetEmail: "",
        details:
          `"${subject}" to ${audience.label}.` +
          ` ${emailed} emailed, ${notified} notified.` +
          (skippedNoEmail ? ` ${skippedNoEmail} had no email address.` : "") +
          (failed.length ? ` Failed: ${failed.map((f) => f.email || f.name).join(", ")}.` : "") +
          (remainingUids.length ? ` ${remainingUids.length} left unsent (ran out of time).` : ""),
      });
    }

    return ok({
      audience: audienceId,
      audienceLabel: audience.label,
      total: recipients.length,
      sent: sentNames.length,
      emailed,
      notified,
      failed,
      skippedNoEmail,
      remainingUids,
    });
  });
}
