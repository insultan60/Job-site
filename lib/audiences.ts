import { profileCompletion } from "./profileCompletion";
import type { UserProfile } from "./users";

/* Who a broadcast goes to.
 *
 * Shared by the console and the API deliberately. The number an admin reads
 * on the Send button and the set the server actually mails are produced by
 * the same predicate below — if the two ever drifted apart, the count would
 * be a lie about something already sitting in somebody's inbox, and there is
 * no taking that back.
 *
 * Suspended accounts are excluded from every audience except their own. A
 * suspended recruiter can't act on most of what we'd write to them, and
 * "All recruiters" quietly including five people you deliberately cut off is
 * the kind of surprise that only surfaces after the send. Mailing them has to
 * be something you pick on purpose.
 *
 * Note these are NOT the recruiter list's filter tabs, which overlap on
 * purpose — there, a suspended account still shows under Verified or Pending
 * because you're looking for it. Reading a list and mailing a list want
 * different answers, so the counts here can differ from the sidebar's.
 */

export type AudienceId =
  | "all"
  | "verified"
  | "pending"
  | "incomplete"
  | "suspended";

export type Audience = {
  id: AudienceId;
  label: string;
  /** Shown under the count, so two similar audiences can't be mixed up. */
  hint: string;
  matches: (user: UserProfile) => boolean;
};

export const AUDIENCES: readonly Audience[] = [
  {
    id: "all",
    label: "All recruiters",
    hint: "Everyone with an account, except suspended ones.",
    matches: (u) => !u.suspended,
  },
  {
    id: "verified",
    label: "Verified",
    hint: "Vetted accounts — the only ones that can submit candidates.",
    matches: (u) => u.verified && !u.suspended,
  },
  {
    id: "pending",
    label: "Pending verification",
    hint: "Signed up, not vetted yet.",
    matches: (u) => !u.verified && !u.suspended,
  },
  {
    id: "incomplete",
    label: "Incomplete profile",
    hint: "Still missing something — the same people the reminder button chases.",
    matches: (u) => !u.suspended && !profileCompletion(u).isComplete,
  },
  {
    id: "suspended",
    label: "Suspended",
    hint: "Blocked from every write action, but they can still sign in and read this.",
    matches: (u) => u.suspended,
  },
];

export const AUDIENCE_IDS = AUDIENCES.map((a) => a.id) as readonly AudienceId[];

export function audienceById(id: AudienceId): Audience | null {
  return AUDIENCES.find((a) => a.id === id) ?? null;
}

/** Everyone in an audience, in the order the caller supplied them.
 *
 *  Recipients with no email address are deliberately still included: a
 *  dashboard-only send reaches them perfectly well, and dropping them here
 *  would make the count wrong for that case. The route skips them only when
 *  email is the sole channel, and reports how many.
 */
export function recipientsOf(
  id: AudienceId,
  users: UserProfile[],
): UserProfile[] {
  const audience = audienceById(id);
  if (!audience) return [];
  return users.filter((u) => audience.matches(u));
}

/** Every audience's size in one pass, for the picker. */
export function countAudiences(
  users: UserProfile[],
): Record<AudienceId, number> {
  const counts = {} as Record<AudienceId, number>;
  for (const audience of AUDIENCES) {
    counts[audience.id] = users.filter(audience.matches).length;
  }
  return counts;
}
