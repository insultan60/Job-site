"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listAllUsers, sendBroadcast,
  type BroadcastResult, type UserProfile,
} from "@/lib/users";
import { listCustomTemplates } from "@/lib/messageTemplates";
import { allTemplates, fillTemplate, type CustomTemplate } from "@/lib/adminEmailTemplates";
import {
  AUDIENCES, countAudiences, type AudienceId,
} from "@/lib/audiences";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { LoadError, errorMessage } from "@/components/admin/LoadError";
import { Loader } from "@/components/Loader";

/* Send one message to a whole audience at once.
 *
 * The count is the point of this screen. "Send" on its own is a button you
 * press hoping for the best; "Send to 23 recruiters" is a decision, and the
 * number has to be the real one — so it comes from lib/audiences.ts, the same
 * module the server filters with, rather than from anything counted here.
 *
 * A template only supplies the starting subject and body. They stay editable,
 * exactly like the one-to-one composer, because a message that can't be
 * adjusted gets sent for the wrong situation.
 */
export function BroadcastComposer() {
  const { confirm, dialog } = useConfirm();

  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [custom, setCustom] = useState<CustomTemplate[]>([]);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);

  const [audience, setAudience] = useState<AudienceId>("all");
  const [templateId, setTemplateId] = useState("blank");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendNotify, setSendNotify] = useState(true);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  /* Only ever resolves state from inside the promise. Clearing the error
     up front instead — the obvious way to write this — is a synchronous
     setState in an effect body, which cascades a render before the fetch has
     even started. The retry button does that part, where it belongs. */
  const fetchAll = useCallback(
    () =>
      Promise.all([listAllUsers(), listCustomTemplates()])
        .then(([u, t]) => {
          setUsers(u);
          setCustom(t);
        })
        .catch((err) =>
          setLoadFailed(errorMessage(err, "Could not load the recruiter list.")),
        ),
    [],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function retry() {
    setLoadFailed(null);
    setUsers(null);
    fetchAll();
  }

  const templates = useMemo(() => allTemplates(custom), [custom]);
  const counts = useMemo(
    () => countAudiences(users ?? []),
    [users],
  );
  const recipientCount = counts[audience] ?? 0;
  const selected = AUDIENCES.find((a) => a.id === audience);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    /* Overwrites the box. Switching template is an explicit act and silently
       merging the two would produce a message that is neither. */
    setSubject(t.subject);
    setBody(t.body);
    setResult(null);
  }

  const canSend =
    Boolean(subject.trim()) &&
    Boolean(body.trim()) &&
    recipientCount > 0 &&
    (sendEmail || sendNotify) &&
    !sending;

  async function run(only?: string[]) {
    setSending(true);
    setError(null);
    try {
      const res = await sendBroadcast({
        audience,
        templateId,
        subject: subject.trim(),
        body: body.trim(),
        email: sendEmail,
        notify: sendNotify,
        ...(only ? { only } : {}),
      });
      setResult(res);
    } catch (err) {
      setError(errorMessage(err, "Could not send that."));
    } finally {
      setSending(false);
    }
  }

  async function send() {
    if (!canSend || !selected) return;
    const channels = [sendEmail ? "an email" : null, sendNotify ? "a dashboard notification" : null]
      .filter(Boolean)
      .join(" and ");
    const confirmed = await confirm({
      title: `Send to ${recipientCount} recruiter${recipientCount === 1 ? "" : "s"}?`,
      message: `Everyone under ${selected.label} gets ${channels}. There's no unsending it.`,
      note: selected.hint,
      confirmLabel: `Send to ${recipientCount}`,
    });
    if (!confirmed) return;
    await run();
  }

  if (loadFailed) {
    return <LoadError what="recruiters" message={loadFailed} onRetry={retry} />;
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      {dialog}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Send to a group</h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted">
            One message to everyone in an audience. Pick who it goes to and the count is
            what actually gets sent.
          </p>
        </div>
      </div>

      {/* Who. Deliberately the first and largest thing on the panel. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {AUDIENCES.map((a) => {
          const active = a.id === audience;
          const n = counts[a.id] ?? 0;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setAudience(a.id);
                setResult(null);
              }}
              aria-pressed={active}
              title={a.hint}
              className={`rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-primary bg-primary-soft"
                  : "border-line bg-white hover:border-ink/25"
              }`}
            >
              <span
                className={`block text-2xl font-extrabold leading-none ${
                  active ? "text-primary" : "text-ink"
                }`}
              >
                {users === null ? "—" : n}
              </span>
              <span className="mt-1 block text-xs font-semibold text-ink">{a.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">{a.hint}</span>
            </button>
          );
        })}
      </div>

      {users === null ? (
        <div className="mt-4 grid h-24 place-items-center">
          <Loader />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Start from
              </span>
              <select
                value={templateId}
                onChange={(e) => pickTemplate(e.target.value)}
                className="input mt-1 h-9 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Subject
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={255}
                className="input mt-1 h-9 text-sm"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Message
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              className="input mt-1 min-h-36 resize-y text-sm"
            />
            <span className="mt-1 block text-[11px] text-muted">
              Write {"{name}"} where each recruiter&apos;s first name should go — it&apos;s
              filled in per person, not once for the batch.
            </span>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Check checked={sendEmail} onChange={setSendEmail} label="Email" />
            <Check checked={sendNotify} onChange={setSendNotify} label="Dashboard notification" />
            {!sendEmail && !sendNotify && (
              <span className="text-xs text-coral">Pick at least one.</span>
            )}
          </div>

          {(subject.trim() || body.trim()) && (
            <div className="mt-4 rounded-lg border border-line bg-cream/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Preview — as a recruiter called Jordan sees it
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {fillTemplate(subject, "Jordan") || "(no subject)"}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {fillTemplate(body, "Jordan") || "(no message)"}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="rounded-pill bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending
                ? "Sending…"
                : `Send to ${recipientCount} recruiter${recipientCount === 1 ? "" : "s"}`}
            </button>
            {recipientCount === 0 && (
              <span className="text-xs text-muted">
                Nobody is in {selected?.label ?? "this audience"} right now.
              </span>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-coral/40 bg-coral-soft/40 px-4 py-3 text-sm text-ink">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-3 rounded-xl border border-sage/40 bg-sage-soft/40 px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                {result.sent === 0
                  ? "Nothing went out."
                  : `Sent to ${result.sent} of ${result.total} in ${result.audienceLabel}.`}
              </p>
              <p className="mt-1 text-xs text-muted">
                {result.emailed} emailed, {result.notified} notified.
                {result.skippedNoEmail > 0 &&
                  ` ${result.skippedNoEmail} had no email address on file.`}
                {result.failed.length > 0 &&
                  ` Failed: ${result.failed.map((f) => f.email || f.name).join(", ")}.`}
              </p>
              {result.remainingUids.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="text-xs text-muted">
                    {result.remainingUids.length} left — the request ran out of time.
                  </p>
                  <button
                    type="button"
                    onClick={() => run(result.remainingUids)}
                    disabled={sending}
                    className="rounded-pill border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send the rest"}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-line accent-primary"
      />
      {label}
    </label>
  );
}
