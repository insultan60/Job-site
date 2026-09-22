"use client";

import { useCallback, useEffect, useState } from "react";
import { listAdminAuditLog, type AdminAuditEntry, type AdminAuditAction } from "@/lib/users";
import { Loader } from "@/components/Loader";
import { LoadError, errorMessage } from "@/components/admin/LoadError";
import { formatDate, timeAgo } from "@/lib/dates";

const ACTION_LABEL: Record<AdminAuditAction, string> = {
  grant: "Granted",
  revoke: "Revoked",
  invite: "Invited",
  invite_claimed: "Invite claimed",
  invite_cancelled: "Invite cancelled",
  recruiter_verified: "Verified",
  recruiter_unverified: "Un-verified",
  recruiter_suspended: "Suspended",
  recruiter_reinstated: "Reinstated",
  recruiter_deleted: "Account deleted",
  site_builder_unlocked: "Site builder unlocked",
  site_builder_locked: "Site builder locked",
  job_deleted: "Job deleted",
  jobs_synced: "Jobs synced",
  submission_status_changed: "Status changed",
  profile_reminder_sent: "Reminder sent",
  email_sent: "Email sent",
  broadcast_sent: "Broadcast sent",
};

const ACTION_STYLE: Record<AdminAuditAction, string> = {
  grant: "bg-sage-soft text-ink",
  invite_claimed: "bg-sage-soft text-ink",
  revoke: "bg-coral-soft text-coral",
  invite_cancelled: "bg-cream text-muted",
  invite: "bg-primary-soft text-primary",
  recruiter_verified: "bg-sage-soft text-ink",
  recruiter_unverified: "bg-cream text-muted",
  recruiter_suspended: "bg-coral-soft text-coral",
  recruiter_reinstated: "bg-sage-soft text-ink",
  recruiter_deleted: "bg-coral text-white",
  site_builder_unlocked: "bg-primary-soft text-primary",
  site_builder_locked: "bg-cream text-muted",
  job_deleted: "bg-coral-soft text-coral",
  jobs_synced: "bg-primary-soft text-primary",
  submission_status_changed: "bg-primary-soft text-primary",
  profile_reminder_sent: "bg-cream text-muted",
  email_sent: "bg-primary-soft text-primary",
  broadcast_sent: "bg-primary-soft text-primary",
};

/** The verb phrase after the target's name — kept as a lookup rather than a
    chain of per-action JSX conditions, since it's the same "{target} {verb}
    by {actor}" shape for every action except the two invite ones, which read
    more naturally in their own voice. */
const ACTION_VERB: Partial<Record<AdminAuditAction, string>> = {
  grant: "was granted admin access",
  revoke: "had admin access revoked",
  invite_cancelled: "'s invite was cancelled",
  recruiter_verified: "was verified",
  recruiter_unverified: "was un-verified",
  recruiter_suspended: "was suspended",
  recruiter_reinstated: "was reinstated",
  recruiter_deleted: "had their account deleted",
  site_builder_unlocked: "had the website builder unlocked",
  site_builder_locked: "had the website builder locked",
  job_deleted: "was deleted",
  jobs_synced: "was synced",
  submission_status_changed: "'s status was changed",
  profile_reminder_sent: "was sent a profile reminder",
  email_sent: "was emailed",
  broadcast_sent: "were sent a broadcast",
};

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listAdminAuditLog());
    } catch (err) {
      setError(errorMessage(err, "The server didn't respond. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <p className="eyebrow uppercase">Access</p>
        <h1 className="mt-1.5 text-xl font-extrabold tracking-tight text-ink">
          Audit log
        </h1>
        <p className="mt-1 text-xs text-muted">
          Every sensitive action taken from this console — admin access,
          recruiter controls, job removal, and submission status changes —
          most recent first.
        </p>
      </div>

      {error && <LoadError what="the audit log" message={error} onRetry={load} />}

      {loading ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-line bg-white">
          <Loader />
        </div>
      ) : error ? null : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <h2 className="font-bold text-ink">No activity yet</h2>
          <p className="mt-1 text-sm text-muted">
            Admin actions taken from this console will show up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-3.5">
              <span
                className={`mt-0.5 inline-flex shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-semibold ${ACTION_STYLE[entry.action]}`}
              >
                {ACTION_LABEL[entry.action]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  <span className="font-semibold">
                    {entry.targetName || entry.targetEmail || "Unknown"}
                  </span>
                  {entry.action === "invite" && " was invited"}
                  {entry.action === "invite_claimed" && " claimed a pending invite"}
                  {ACTION_VERB[entry.action] ?? ""}
                  {entry.action !== "invite_claimed" && (
                    <>
                      {" "}by{" "}
                      <span className="font-semibold">
                        {entry.actorName || entry.actorEmail || "system"}
                      </span>
                    </>
                  )}
                </p>
                {entry.details && (
                  <p className="mt-0.5 text-xs text-muted">{entry.details}</p>
                )}
                <p className="mt-0.5 text-xs text-muted" title={formatDate(entry.createdAt)}>
                  {timeAgo(entry.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
