"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listMessages, setMessageHandled, setMessageSleeping, replyToMessage, type ContactMessage,
} from "@/lib/messages";
import { Loader } from "@/components/Loader";
import { LoadError, errorMessage } from "@/components/admin/LoadError";
import { ReplyBox } from "@/components/admin/ReplyBox";
import { adminRoutes } from "@/lib/routes";
import { formatDate } from "@/lib/dates";
import { SortSelect } from "@/components/SortSelect";
import { applySort, textAsc, textDesc, dateDesc, dateAsc, type SortOption } from "@/lib/sorting";

/* Contact-form enquiries.
 *
 * These were written to the `messages` table and emailed onward, and that
 * was it — no page in the console read them. So a lead only really existed
 * in whoever's inbox the notification reached, and when that address turned
 * out not to exist, leads were landing nowhere anybody looked.
 *
 * This is the copy of record: the row is written before the email is
 * attempted (see POST /api/messages), so an enquiry shows up here whether
 * the notification email worked or not.
 */

type Tab = "new" | "handled" | "sleeping" | "spam" | "all";

/* Sleeping is its own tab rather than a filter on the other two: the whole
   point of parking a thread is that it leaves the working lists, so it has
   to be somewhere you only look when you go looking. */
const TABS: { value: Tab; label: string }[] = [
  { value: "new", label: "Needs a reply" },
  { value: "handled", label: "Handled" },
  { value: "sleeping", label: "Sleeping" },
  /* Scored at intake, never emailed onward, and kept out of every other tab.
     It is a tab rather than a delete because the scoring is a heuristic: a
     false positive has to be recoverable by looking, not lost. */
  { value: "spam", label: "Spam" },
  { value: "all", label: "All" },
];

const SORTS: SortOption<ContactMessage>[] = [
  { value: "newest", label: "Newest first", compare: dateDesc((m) => m.createdAt) },
  { value: "oldest", label: "Oldest first", compare: dateAsc((m) => m.createdAt) },
  { value: "az", label: "Subject A–Z", compare: textAsc((m) => m.subject) },
  { value: "za", label: "Subject Z–A", compare: textDesc((m) => m.subject) },
  { value: "sender", label: "Sender A–Z", compare: textAsc((m) => m.name) },
];

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("new");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listMessages()
      .then(setMessages)
      .catch((err) => setError(errorMessage(err, "The server did not respond. Please try again.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      new: messages.filter((m) => !m.handled && !m.sleeping && !m.spam).length,
      handled: messages.filter((m) => m.handled && !m.sleeping && !m.spam).length,
      sleeping: messages.filter((m) => m.sleeping && !m.spam).length,
      spam: messages.filter((m) => m.spam).length,
      all: messages.length,
    }),
    [messages],
  );

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const matched = messages.filter((m) => {
      // Spam is excluded from every working tab, and only visible in its own.
      if (tab !== "spam" && tab !== "all" && m.spam) return false;
      if (tab === "new" && (m.handled || m.sleeping)) return false;
      if (tab === "handled" && (!m.handled || m.sleeping)) return false;
      if (tab === "sleeping" && !m.sleeping) return false;
      if (tab === "spam" && !m.spam) return false;
      if (!term) return true;
      return [m.name, m.email, m.subject, m.message].join(" ").toLowerCase().includes(term);
    });
    return applySort(matched, SORTS, sort);
  }, [messages, tab, q, sort]);

  async function toggleHandled(m: ContactMessage) {
    const next = !m.handled;
    /* Optimistic, rolled back on failure — the same pattern as the recruiter
       toggles, so a slow connection doesn't make the tick feel broken. */
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, handled: next } : x)));
    setBusyId(m.id);
    try {
      await setMessageHandled(m.id, next);
    } catch (err) {
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, handled: !next } : x)));
      setError(errorMessage(err, "Could not update that inquiry."));
    } finally {
      setBusyId(null);
    }
  }

  /* Park a thread, or bring it back. Nothing is deleted — the row, its
     replies and the sender's own copy at /dashboard/enquiries all stay, and
     an inbound reply wakes it by itself (see addInboundReply). */
  async function toggleSleeping(m: ContactMessage) {
    const next = !m.sleeping;
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, sleeping: next } : x)));
    setBusyId(m.id);
    try {
      await setMessageSleeping(m.id, next);
    } catch (err) {
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, sleeping: !next } : x)));
      setError(errorMessage(err, "Could not update that inquiry."));
    } finally {
      setBusyId(null);
    }
  }

  async function sendReply(m: ContactMessage, text: string) {
    const { emailed } = await replyToMessage(m.id, text);
    setReplyingId(null);
    /* Replying marks it handled server-side, so reload rather than patching
       two pieces of state by hand and risking them disagreeing. */
    await load();
    setNotice(
      emailed
        ? `Reply sent to ${m.email}.`
        : `Reply saved, but the email to ${m.email} didn't send. Check the Brevo settings.`,
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow uppercase">Inbox</p>
          <h1 className="mt-1.5 text-xl font-extrabold tracking-tight text-ink">Inquiries</h1>
          <p className="mt-1 text-xs text-muted">
            Everything sent through the contact form on jobfolder.com.
            {counts.new > 0 && ` ${counts.new} still to answer.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <SortSelect options={SORTS} value={sort} onChange={setSort} className="h-9" />
        <div className="relative w-full max-w-xs">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input h-9 pl-9 text-xs"
            placeholder="Search name, email, message…"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            width="13"
            height="13"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-pill border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.value
                ? "border-primary bg-primary text-white"
                : "border-line bg-white text-ink hover:border-ink/25"
            }`}
          >
            {t.label}
            <span
              className={`ml-1.5 tabular-nums ${tab === t.value ? "text-white/70" : "text-muted"}`}
            >
              {counts[t.value]}
            </span>
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary-soft/50 px-4 py-3 text-sm text-ink">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-3 text-xs font-semibold text-primary hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <LoadError what="inquiries" message={error} onRetry={load} />}

      {loading ? (
        <div className="grid h-48 place-items-center rounded-2xl border border-line bg-white">
          <Loader />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <h2 className="font-bold text-ink">
            {messages.length === 0 ? "No inquiries yet" : "Nothing here"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {messages.length === 0
              ? "Messages sent through the contact form will appear here."
              : "No inquiry matches this filter or search."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((m) => (
            <li
              key={m.id}
              className={`rounded-xl border bg-white p-4 transition-colors ${
                m.sleeping ? "border-line opacity-70" : m.handled ? "border-line" : "border-primary/30"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={adminRoutes.message(m.id)}
                    className="block truncate text-[15px] font-semibold text-ink transition-colors hover:text-primary"
                  >
                    {m.subject || "(no subject)"}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {m.name || "(no name)"}
                    {" · "}
                    <a href={`mailto:${m.email}`} className="text-primary hover:underline">
                      {m.email}
                    </a>
                    {" · "}
                    {formatDate(m.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.sleeping && (
                    <span className="rounded-pill bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                      Asleep
                    </span>
                  )}
                  {!m.handled && !m.sleeping && (
                    <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      New
                    </span>
                  )}
                  <Link
                    href={adminRoutes.message(m.id)}
                    className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => setReplyingId(replyingId === m.id ? null : m.id)}
                    className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
                  >
                    {replyingId === m.id ? "Cancel" : "Reply"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleHandled(m)}
                    disabled={busyId === m.id}
                    className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      m.handled
                        ? "border border-line text-muted hover:border-ink/25 hover:text-ink"
                        : "bg-primary text-white hover:bg-primary-dark"
                    }`}
                  >
                    {m.handled ? "Reopen" : "Mark handled"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSleeping(m)}
                    disabled={busyId === m.id}
                    className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-ink/25 hover:text-ink disabled:opacity-50"
                  >
                    {m.sleeping ? "Wake" : "Sleep"}
                  </button>
                </div>
              </div>

              {/* whitespace-pre-wrap: the sender's line breaks are the only
                  structure a plain-text message has. */}
              {m.message && (
                <p className="mt-3 whitespace-pre-wrap border-t border-line pt-3 text-sm leading-relaxed text-ink">
                  {m.message}
                </p>
              )}

              {m.replies.length > 0 && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  {/* Ours sit indented and tinted; theirs stay flush left
                      against a neutral ground, so the direction of a thread
                      is readable at a glance rather than by reading names. */}
                  {m.replies.map((r) => (
                    <div
                      key={r.id}
                      className={
                        r.direction === "in"
                          ? "rounded-lg border border-line bg-cream/50 p-3"
                          : "ml-6 rounded-lg bg-primary-soft/50 p-3"
                      }
                    >
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-wide ${
                          r.direction === "in" ? "text-muted" : "text-primary"
                        }`}
                      >
                        {r.direction === "in"
                          ? `${r.adminName || "They"} replied`
                          : `${r.adminName || "JobFolder"} replied`}
                        {" · "}
                        {formatDate(r.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {replyingId === m.id && (
                <div className="mt-3 border-t border-line pt-3">
                  <ReplyBox
                    onCancel={() => setReplyingId(null)}
                    onSend={(text) => sendReply(m, text)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
