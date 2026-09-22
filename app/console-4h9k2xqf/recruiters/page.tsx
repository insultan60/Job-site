"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { adminRoutes } from "@/lib/routes";
import {
  listAllUsers, sendProfileReminderToAll, deleteRecruiters,
  type BulkReminderResult, type BulkDeleteResult, type UserProfile,
} from "@/lib/users";
import { listAllSubmissions, type Submission } from "@/lib/submissions";
import { Loader } from "@/components/Loader";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { LoadError, errorMessage } from "@/components/admin/LoadError";
import { formatDate } from "@/lib/dates";
import { profileCompletion } from "@/lib/profileCompletion";
import { SortSelect } from "@/components/SortSelect";
import { applySort, textAsc, textDesc, dateDesc, dateAsc, numberAsc, type SortOption } from "@/lib/sorting";
import {
  RECRUITER_STATUS_TABS as STATUS_TABS, recruitersStatusHref, type RecruiterStatusTab as StatusTab,
} from "@/lib/recruiterStatus";

function fmtDate(u: UserProfile): string {
  return formatDate(u.createdAt);
}

// 3 columns x 8 rows at the widest breakpoint — a page of cards that fits
// comfortably without scrolling forever once there are hundreds of recruiters.
const PAGE_SIZE = 24;

/* "Least complete" is here, not just on the profile meter, because this page
   is where an admin decides who to chase — sorting by it turns the list into
   the shortlist for the reminder button above it. */
const SORTS: SortOption<UserProfile>[] = [
  { value: "newest", label: "Newest first", compare: dateDesc((u) => u.createdAt) },
  { value: "oldest", label: "Oldest first", compare: dateAsc((u) => u.createdAt) },
  { value: "az", label: "Name A–Z", compare: textAsc((u) => u.name) },
  { value: "za", label: "Name Z–A", compare: textDesc((u) => u.name) },
  { value: "company", label: "Company A–Z", compare: textAsc((u) => u.company) },
  {
    value: "incomplete",
    label: "Least complete",
    compare: numberAsc((u) => profileCompletion(u).percent),
  },
];

const STATUS_META: Record<
  StatusTab,
  { label: string; ring: string; iconWrap: string; icon: React.ReactNode }
> = {
  all: {
    label: "All recruiters",
    ring: "border-primary bg-primary-soft",
    iconWrap: "bg-primary text-white",
    icon: (
      <path d="M3 6h5v5H3zM12 6h5v5h-5zM3 15h5v5H3zM12 15h5v5h-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    ),
  },
  pending: {
    label: "Pending verification",
    ring: "border-coral bg-coral-soft",
    iconWrap: "bg-coral text-white",
    icon: (
      <>
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 7v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  verified: {
    label: "Verified",
    ring: "border-sage bg-sage-soft",
    iconWrap: "bg-sage text-ink",
    icon: <path d="M6 11.5l3.2 3.2L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  suspended: {
    label: "Suspended",
    ring: "border-coral bg-coral",
    iconWrap: "bg-white/20 text-white",
    icon: (
      <>
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 6l10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
};

export default function AdminRecruitersPage() {
  return (
    <Suspense fallback={<div className="grid h-48 place-items-center"><Loader /></div>}>
      <RecruitersList />
    </Suspense>
  );
}

function RecruitersList() {
  const searchParams = useSearchParams();
  const status = (STATUS_TABS as readonly string[]).includes(searchParams.get("status") ?? "")
    ? (searchParams.get("status") as StatusTab)
    : "all";

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [reminding, setReminding] = useState(false);
  const [reminderResult, setReminderResult] = useState<BulkReminderResult | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  /* Selection for bulk delete. A Set of uids rather than a flag on each row:
     the selection has to survive paging and re-sorting, and the rows are
     recreated on every filter change. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<BulkDeleteResult | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    Promise.all([listAllUsers(), listAllSubmissions()])
      .then(([u, s]) => {
        setUsers(u);
        setSubs(s);
      })
      .catch((err) =>
        setError(errorMessage(err, "The server didn't respond. Please try again.")),
      )
      .finally(() => setLoading(false));
  }, []);

  // How many candidates each recruiter has submitted.
  const countByRecruiter = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subs) m.set(s.recruiterId, (m.get(s.recruiterId) ?? 0) + 1);
    return m;
  }, [subs]);

  /* Who the button would chase. Deliberately ignores the server's cooldown
     — duplicating that window here would just be a second copy to drift. The
     result banner reports what was actually skipped. */
  const incomplete = useMemo(
    () => users.filter((u) => !u.suspended && !profileCompletion(u).isComplete).length,
    [users],
  );

  async function remindEveryone() {
    if (
      !(await confirm({
        title: `Email ${incomplete} recruiter${incomplete === 1 ? "" : "s"}?`,
        message:
          "Everyone with an unfinished profile gets a reminder. Completed profiles, suspended accounts and anyone reminded in the last few days are skipped automatically.",
        note: "This sends real email and can't be undone.",
        confirmLabel: "Send reminders",
      }))
    ) {
      return;
    }

    setReminderError(null);
    setReminderResult(null);
    setReminding(true);
    try {
      const result = await sendProfileReminderToAll();
      setReminderResult(result);
      // Pull fresh rows so the reminder timestamps (and so the next run's
      // cooldown) reflect what just happened.
      if (result.sent > 0) listAllUsers().then(setUsers).catch(() => {});
    } catch (err) {
      setReminderError(errorMessage(err, "Could not send the reminders."));
    } finally {
      setReminding(false);
    }
  }

  const statusCounts = useMemo(() => {
    const pending = users.filter((u) => !u.verified).length;
    const suspended = users.filter((u) => u.suspended).length;
    return { all: users.length, pending, verified: users.length - pending, suspended };
  }, [users]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const matched = users.filter((u) => {
      if (status === "pending" && u.verified) return false;
      if (status === "verified" && !u.verified) return false;
      if (status === "suspended" && !u.suspended) return false;
      if (!term) return true;
      return [u.name, u.email, u.company, u.headline, u.location]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    return applySort(matched, SORTS, sort);
  }, [users, q, status, sort]);

  // Any change to the search term or status filter invalidates the current
  // page — otherwise "page 3" could silently show nothing after narrowing
  // results. Adjusted during render (same pattern as the recruiter-facing
  // jobs board), not an effect: an effect would render page 3 of the new
  // results for one frame before snapping back to page 1.
  const filterKey = `${status} ${q} ${sort}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /* ---------------------------------------------------------- selection */

  function toggleOne(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  const pageSelected = paginated.filter((u) => selected.has(u.uid)).length;
  const allPageSelected = paginated.length > 0 && pageSelected === paginated.length;

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) for (const u of paginated) next.delete(u.uid);
      else for (const u of paginated) next.add(u.uid);
      return next;
    });
  }

  /* Everything the current filter matches, not just this page — the point of
     the status tabs is that "Pending verification" is the bot pile, and
     clearing it 24 at a time is the problem this button exists to solve. */
  function selectAllMatching() {
    setSelected(new Set(shown.map((u) => u.uid)));
  }

  const selectedUsers = useMemo(
    () => users.filter((u) => selected.has(u.uid)),
    [users, selected],
  );
  const selectedWithSubmissions = useMemo(
    () => selectedUsers.filter((u) => (countByRecruiter.get(u.uid) ?? 0) > 0),
    [selectedUsers, countByRecruiter],
  );

  async function deleteSelected() {
    const n = selectedUsers.length;
    if (n === 0) return;

    const attached = selectedWithSubmissions.reduce(
      (sum, u) => sum + (countByRecruiter.get(u.uid) ?? 0),
      0,
    );

    /* The warning that matters is not "this is permanent" — it is that some
       of these people did real work. Named, not counted, when it is a handful:
       recognising one name is what stops the wrong click. */
    const withWork =
      selectedWithSubmissions.length === 0
        ? ""
        : selectedWithSubmissions.length <= 3
          ? ` ${selectedWithSubmissions
              .map((u) => u.name || u.email)
              .join(", ")} submitted ${attached} candidate${attached === 1 ? "" : "s"} between them — those submissions stay, but lose their recruiter.`
          : ` ${selectedWithSubmissions.length} of them submitted ${attached} candidate${attached === 1 ? "" : "s"} between them — those submissions stay, but lose their recruiter.`;

    if (
      !(await confirm({
        title: `Delete ${n} recruiter account${n === 1 ? "" : "s"}?`,
        message: `The account, profile and anything only they had (saved candidates, their recruiter website, their leads) is removed.${withWork}`,
        note: "This cannot be undone. Admin accounts and your own are skipped automatically.",
        confirmLabel: `Delete ${n}`,
        tone: "danger",
      }))
    ) {
      return;
    }

    setDeleteError(null);
    setDeleteResult(null);
    setDeleting(true);
    try {
      const result = await deleteRecruiters(selectedUsers.map((u) => u.uid));
      setDeleteResult(result);
      // Drop the rows locally rather than refetching: the server has already
      // told us exactly which ids went.
      const gone = new Set(result.deletedUids);
      setUsers((prev) => prev.filter((u) => !gone.has(u.uid)));
      // Anything refused stays selected, so it is still in front of the admin
      // with the reason showing.
      setSelected(new Set(result.refused.map((r) => r.uid)));
    } catch (err) {
      setDeleteError(errorMessage(err, "Could not delete those accounts."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {dialog}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow uppercase">People</p>
          <h1 className="mt-1.5 text-xl font-extrabold tracking-tight text-ink">
            Recruiters
          </h1>
          <p className="mt-1 text-xs text-muted">
            Everyone who has signed up to refer candidates. {users.length} total.
          </p>
        </div>
        <div className="flex w-full max-w-lg items-center gap-2 sm:w-auto">
        <button
          type="button"
          onClick={remindEveryone}
          disabled={reminding || incomplete === 0}
          className="shrink-0 rounded-pill bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
          title={
            incomplete === 0
              ? "Every recruiter's profile is complete"
              : "Email everyone with an unfinished profile"
          }
        >
          {reminding ? "Sending…" : `Remind ${incomplete} incomplete`}
        </button>
        <SortSelect options={SORTS} value={sort} onChange={setSort} className="h-9" />
        <div className="relative w-full max-w-xs">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input h-9 pl-9 text-xs"
            placeholder="Search name, company, location…"
          />
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        </div>
      </div>

      {reminderError && (
        <div className="mb-4 rounded-xl border border-coral bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">
          {reminderError}
        </div>
      )}

      {reminderResult && (
        <div className="mb-4 rounded-xl border border-sage bg-sage-soft px-4 py-3">
          <p className="text-sm font-bold text-ink">
            {reminderResult.sent === 0
              ? "No reminders sent — nobody was due one."
              : `Reminder sent to ${reminderResult.sent} recruiter${reminderResult.sent === 1 ? "" : "s"}.`}
          </p>
          <p className="mt-1 text-xs text-muted">
            Skipped {reminderResult.skippedComplete} already complete,{" "}
            {reminderResult.skippedSuspended} suspended, {reminderResult.skippedRecent} reminded in
            the last {reminderResult.cooldownDays} days.
            {reminderResult.failed > 0 && ` ${reminderResult.failed} failed to send.`}
            {reminderResult.remaining > 0 &&
              ` ${reminderResult.remaining} still to go — run it again to finish.`}
          </p>
          {reminderResult.sentTo.length > 0 && (
            <p className="mt-1 text-xs text-muted">Sent to: {reminderResult.sentTo.join(", ")}</p>
          )}
        </div>
      )}

      {deleteError && (
        <div className="mb-4 rounded-xl border border-coral bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">
          {deleteError}
        </div>
      )}

      {deleteResult && (
        <div className="mb-4 rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-sm font-bold text-ink">
            {deleteResult.deleted === 0
              ? "Nothing was deleted."
              : `Deleted ${deleteResult.deleted} account${deleteResult.deleted === 1 ? "" : "s"}.`}
          </p>
          {deleteResult.deleted > 0 && (
            <p className="mt-1 text-xs text-muted">
              {deleteResult.deletedNames.slice(0, 6).join(", ")}
              {deleteResult.deletedNames.length > 6 &&
                ` and ${deleteResult.deletedNames.length - 6} more`}
              .
              {deleteResult.submissionsDetached > 0 &&
                ` ${deleteResult.submissionsDetached} submission${
                  deleteResult.submissionsDetached === 1 ? " was" : "s were"
                } kept and no longer show a recruiter.`}
            </p>
          )}
          {deleteResult.notFound > 0 && (
            <p className="mt-1 text-xs text-muted">
              {deleteResult.notFound} had already been deleted.
            </p>
          )}
          {deleteResult.auditFailed > 0 && (
            <p className="mt-2 text-xs font-semibold text-coral">
              {deleteResult.auditFailed} of these could not be written to the audit log. The
              accounts are gone, but there is no record of who removed them. Run
              scripts/db-migrate-audit-recruiter-deleted.mjs against this database.
            </p>
          )}
          {deleteResult.refused.length > 0 && (
            <ul className="mt-2 space-y-1">
              {deleteResult.refused.map((r) => (
                <li key={r.uid} className="text-xs font-semibold text-coral">
                  Kept {r.name}: {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {users.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATUS_TABS.map((s) => {
            const meta = STATUS_META[s];
            const active = status === s;
            return (
              <Link
                key={s}
                href={recruitersStatusHref(s)}
                className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${
                  active ? meta.ring : "border-line bg-white hover:border-ink/20"
                } ${s === "suspended" && active ? "text-white" : "text-ink"}`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                  active ? meta.iconWrap : "bg-cream text-muted"
                }`}>
                  <svg width="15" height="15" viewBox="0 0 22 22" fill="none" aria-hidden>
                    {meta.icon}
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className={`text-2xl font-extrabold tabular-nums leading-none ${
                    active && s === "suspended" ? "text-white" : "text-ink"
                  }`}>
                    {statusCounts[s]}
                  </p>
                  <p className={`mt-1 truncate text-xs font-semibold ${
                    active ? (s === "suspended" ? "text-white/85" : "text-ink/70") : "text-muted"
                  }`}>
                    {meta.label}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {error && (
        <LoadError
          what="recruiters"
          message={error}
          onRetry={() => window.location.reload()}
        />
      )}

      {loading ? (
        <div className="grid h-48 place-items-center rounded-2xl border border-line bg-white">
          <Loader />
        </div>
      ) : error ? null : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <h2 className="font-bold text-ink">No recruiters</h2>
          <p className="mt-1 text-sm text-muted">
            {users.length === 0
              ? "Recruiters who sign up will appear here."
              : "No recruiters match your search or filter."}
          </p>
        </div>
      ) : (
        <>
          {/* Selection bar. Always present once there are rows, so the
              checkboxes on the cards have something that explains them, and
              it turns into the delete control the moment anything is ticked. */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-white px-4 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={allPageSelected}
                ref={(el) => {
                  // Partial page selection reads as indeterminate rather than
                  // as "none", so the box matches what is actually ticked.
                  if (el) el.indeterminate = pageSelected > 0 && !allPageSelected;
                }}
                onChange={togglePage}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              Select page
            </label>

            {shown.length > paginated.length && (
              <button
                type="button"
                onClick={selectAllMatching}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Select all {shown.length} matching
              </button>
            )}

            {selected.size > 0 ? (
              <>
                <span className="text-xs text-muted">
                  {selected.size} selected
                  {selectedWithSubmissions.length > 0 &&
                    ` · ${selectedWithSubmissions.length} with submissions`}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs font-semibold text-muted hover:text-ink"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="ml-auto rounded-pill bg-coral px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? "Deleting…" : `Delete ${selected.size}`}
                </button>
              </>
            ) : (
              <span className="text-xs text-muted">
                Tick accounts to delete them in bulk.
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {paginated.map((u) => (
              <RecruiterCard
                key={u.uid}
                user={u}
                submissions={countByRecruiter.get(u.uid) ?? 0}
                joined={fmtDate(u)}
                selected={selected.has(u.uid)}
                onToggle={() => toggleOne(u.uid)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="text-xs text-muted">
                Page {currentPage} of {totalPages} · {shown.length} recruiter{shown.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Identity up top, two numbers under a rule.
 *
 * This used to be a full definition list — email, phone, company, location,
 * LinkedIn, joined date, bio — on every card. Complete, but nothing stood
 * out, so scanning 24 of them meant reading all of them. The detail page
 * already holds the full record, so the card's job is to be scannable and
 * link onward, not to duplicate it. Anything dropped here is one click away
 * at /recruiters/[uid]. */
function RecruiterCard({
  user,
  submissions,
  joined,
  selected,
  onToggle,
}: {
  user: UserProfile;
  submissions: number;
  joined: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const initial = (user.name || user.email || "R").charAt(0).toUpperCase();
  const completion = profileCompletion(user);

  /* Suspended outranks verified: a suspended-but-verified recruiter is a
     problem to notice, not a badge to celebrate. */
  const status = user.suspended
    ? { label: "Suspended", cls: "bg-coral text-white" }
    : user.verified
      ? { label: "Verified", cls: "bg-sage-soft text-ink" }
      : { label: "Pending", cls: "bg-coral-soft text-coral" };

  /* The line under the name, in order of what an admin actually scans for.
     Falls back to the join date so the slot is never empty and the cards
     keep a consistent height. */
  const subtitle = user.headline || user.company || user.location || `Joined ${joined}`;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-white p-4 transition-all hover:shadow-[0_2px_12px_rgba(23,19,15,0.06)] ${
        selected ? "border-coral ring-1 ring-coral" : "border-line hover:border-primary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* z-10 because the name's link stretches an overlay across the whole
            card; without it the tick target is under that overlay and
            selecting a card would navigate to it instead. */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${user.name || user.email}`}
          className="relative z-10 mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-coral"
        />
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-sm font-bold text-primary">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`${adminRoutes.recruiters}/${encodeURIComponent(user.uid)}`}
            className="block text-[15px] font-semibold leading-tight text-ink transition-colors group-hover:text-primary"
          >
            {/* Stretches the link over the whole card, so the entire thing is
                clickable without nesting the other links inside an <a>. The
                truncation lives on the inner span, not here: `truncate` sets
                overflow:hidden, which would clip this overlay away. */}
            <span className="absolute inset-0 z-0" aria-hidden />
            <span className="block truncate">{user.name || "Unnamed"}</span>
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
        </div>

        <span
          className={`relative z-10 shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.cls}`}
        >
          {status.label}
        </span>
      </div>

      <p className="mt-2.5 truncate text-xs text-muted">{subtitle}</p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
        {user.linkedin ? (
          <a
            href={user.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-primary"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.6c0-1.34-.03-3.06-1.9-3.06-1.9 0-2.2 1.45-2.2 2.96V21h-4z" />
            </svg>
            LinkedIn
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted/70">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7.6 7.8a2.4 2.4 0 114 1.8c-.9.6-1.6 1-1.6 1.9M10 14.2h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            No LinkedIn
          </span>
        )}

        {/* Kept from the old card: which recruiters have a public microsite
            is something the admin filters on by eye, and it isn't derivable
            from anything else on here. */}
        {user.siteBuilderEnabled && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink" title="Has a recruiter website">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2.8 10h14.4M10 2.8c1.9 2 2.8 4.5 2.8 7.2s-.9 5.2-2.8 7.2c-1.9-2-2.8-4.5-2.8-7.2s.9-5.2 2.8-7.2z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Site
          </span>
        )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink"
            title={`${submissions} candidate${submissions === 1 ? "" : "s"} submitted`}
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" className="text-muted" aria-hidden>
              <path d="M11.5 2.5H6a1.5 1.5 0 00-1.5 1.5v12A1.5 1.5 0 006 17.5h8a1.5 1.5 0 001.5-1.5V6.5m-4-4l4 4m-4-4v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {submissions}
          </span>

          {/* The completion figure is the reason the reminder email exists, so
              it earns a slot on the card rather than only on the detail page.
              Coral under half, muted otherwise — a tick once there's nothing
              left to chase. */}
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              completion.isComplete ? "text-sage" : completion.percent < 50 ? "text-coral" : "text-muted"
            }`}
            title={
              completion.isComplete
                ? "Profile complete"
                : `Missing: ${completion.missing.map((f) => f.label).join(", ")}`
            }
          >
            {completion.isComplete ? (
              <>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6.8 10.2l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                100%
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
                  <path d="M10 2.8A7.2 7.2 0 0110 17.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                {completion.percent}%
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
