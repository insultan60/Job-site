import { apiFetch, uploadFile } from "./api";

/* Recruiter profiles. Rows and avatar images both live in MySQL — the image
   bytes go into the `files` table and photoURL holds the /api/files/{id} path
   that serves them. */

/* A single kind of self-serve user: a recruiter. They browse our jobs and
   submit / refer their candidates. (Admins are separate — the `admins` table.)
   A recruiter fills out a richer profile — including a photo — which admins can
   review from the console. */
export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  headline: string; // e.g. "Technical recruiter" / job title
  location: string;
  linkedin: string;
  website: string;
  twitter: string;
  facebook: string;
  instagram: string;
  bio: string;
  photoURL: string;
  /** Raw file id of the recruiter's submitted verification video, or null.
      Set via uploadVerificationVideo() + updateUserProfile(); read back only
      to detect whether one is on file (compare against null), never rendered
      directly — use verificationVideoUrl for that. */
  verificationVideoId: string | null;
  /** Signed, time-limited URL to stream the verification video — freshly
      minted on every profile fetch (see toUserProfile in lib/server/repo.ts),
      so it always works when non-null but shouldn't be cached across loads. */
  verificationVideoUrl: string | null;
  /** Admin-set: shows this recruiter on Metro Associates' public team page. */
  metroTeamMember: boolean;
  /** Admin-set: whether this recruiter has been vetted. An unverified
      recruiter can browse and use the dashboard, but POST /api/submissions
      refuses to create a submission on their behalf until this is true. */
  verified: boolean;
  /** Admin-set: a hard stop for a bad-actor account. Blocks every write —
      submissions, saved candidates, messages, file uploads. They can still
      sign in and see the dashboard, which is what shows them the notice. */
  suspended: boolean;
  /** Admin-set: unlocks the self-serve recruiter-website builder on
      /dashboard/career-site. */
  siteBuilderEnabled: boolean;
  /** When an admin last sent the "complete your profile" reminder email, or
      null if never. Informational only — nothing enforces a cooldown. */
  profileReminderSentAt: string | null;
  /** ISO-8601 string from MySQL, or null. */
  createdAt: string | null;
};

/** One row on the console's admin allow-list. name/email come from a matching
    recruiter profile when one exists — an admin doesn't have to also be a
    recruiter, so both can be empty. */
export type AdminAccount = {
  uid: string;
  note: string;
  name: string;
  email: string;
  createdAt: string | null;
  /** Stamped whenever this admin loads the console — null if never. */
  lastActiveAt: string | null;
};

/** Admin access granted to an email with no account yet. Turns into a real
    AdminAccount automatically the moment that email signs in. */
export type AdminInvite = {
  email: string;
  invitedByName: string;
  invitedByEmail: string;
  createdAt: string | null;
};

export type AdminAuditAction =
  | "grant"
  | "revoke"
  | "invite"
  | "invite_claimed"
  | "invite_cancelled"
  | "recruiter_verified"
  | "recruiter_unverified"
  | "recruiter_suspended"
  | "recruiter_reinstated"
  | "recruiter_deleted"
  | "site_builder_unlocked"
  | "site_builder_locked"
  | "job_deleted"
  | "jobs_synced"
  | "submission_status_changed"
  | "profile_reminder_sent"
  | "email_sent"
  | "broadcast_sent";

/** One entry in the admin action history — every sensitive action taken from
    the console, not just changes to the admin allow-list. */
export type AdminAuditEntry = {
  id: number;
  action: AdminAuditAction;
  actorName: string;
  actorEmail: string;
  targetName: string;
  targetEmail: string;
  details: string | null;
  createdAt: string | null;
};

/** What POST /api/admin/admins returns: either the account was granted
    immediately (it already existed), or an invite is now pending. */
export type AdminAccessGrant =
  | { kind: "admin"; admin: AdminAccount }
  | { kind: "invite"; invite: AdminInvite };

/* The fields a recruiter can edit on their profile (everything except the
   identity/audit fields, which the server refuses to update). */
export type UserProfileInput = {
  name: string;
  phone: string;
  company: string;
  headline: string;
  location: string;
  linkedin: string;
  website: string;
  twitter: string;
  facebook: string;
  instagram: string;
  bio: string;
  photoURL: string;
  verificationVideoId: string | null;
};

/** What GET /api/me returns: the profile plus the caller's admin status. */
export type Me = { profile: UserProfile | null; isAdmin: boolean };

/** One round trip for both — the dashboard and console both need each. */
export function getMe(): Promise<Me> {
  return apiFetch<Me>("/api/me", { auth: true });
}

/* Called right after Firebase Auth creates the account. The server takes the
   uid from the verified token, so the `uid` argument is accepted only to keep
   existing call sites compiling. */
export async function createUserProfile(
  _uid: string,
  data: { name: string; email: string },
): Promise<void> {
  await apiFetch("/api/me", { method: "POST", body: data, auth: true });
}

/* Recruiter action: update the editable parts of their own profile. A user can
   only ever update their own — the server ignores any uid in the body. */
export async function updateUserProfile(
  _uid: string,
  data: Partial<UserProfileInput>,
): Promise<void> {
  await apiFetch("/api/me", { method: "PUT", body: data, auth: true });
}

/* Recruiter action: upload a profile photo and return the URL that serves it.
   The server records the uploader from the token, so a user can only ever
   attach an avatar to their own account. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatar(_uid: string, file: File): Promise<string> {
  // Checked again server-side; this is just a fast, friendly failure.
  if (file.size > MAX_AVATAR_BYTES)
    throw new Error("Image is larger than 5 MB.");
  if (!ACCEPTED_AVATAR_TYPES.includes(file.type))
    throw new Error("Image must be a JPG, PNG, or WebP.");

  const { url } = await uploadFile(file, "avatar");
  if (!url) throw new Error("Upload succeeded but returned no URL.");
  return url;
}

/* Recruiter action: upload a short verification video and return its file
   id. Unlike uploadAvatar, this returns an id, not a URL — the video is
   private (like a CV), so it's only ever streamed via a signed link minted
   fresh on each profile read (verificationVideoUrl), not a permanent one
   handed back at upload time. */
const MAX_VIDEO_BYTES = 4 * 1024 * 1024; // 4 MB — see lib/server/files.ts
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export async function uploadVerificationVideo(file: File): Promise<string> {
  // Checked again server-side; this is just a fast, friendly failure.
  if (file.size > MAX_VIDEO_BYTES)
    throw new Error("Video is larger than 4 MB — try a shorter or lower-resolution clip.");
  if (!ACCEPTED_VIDEO_TYPES.includes(file.type))
    throw new Error("Video must be MP4, WebM, or MOV.");

  const { id } = await uploadFile(file, "video");
  if (!id) throw new Error("Upload succeeded but returned no file id.");
  return id;
}

/* True when the signed-in user is on the admin allow-list. Always asks about
   the caller — an arbitrary uid is not answerable client-side, and shouldn't
   be. Prefer `useAuth().isAdmin`, which reuses the profile fetch. */
export async function isAdminUser(): Promise<boolean> {
  try {
    return (await getMe()).isAdmin;
  } catch {
    return false;
  }
}

/** The caller's own profile. */
export async function getUserProfile(): Promise<UserProfile | null> {
  return (await getMe()).profile;
}

/** Admin action: list every recruiter, newest first. */
export function listAllUsers(): Promise<UserProfile[]> {
  return apiFetch<UserProfile[]>("/api/admin/recruiters", { auth: true });
}

/** Admin action: add or remove a recruiter from Metro Associates' public team
    page. Approving here is what the "Meet Our Team" page on the Metro site
    fetches — see /api/team. */
export async function setRecruiterMetroTeamMember(
  uid: string,
  metroTeamMember: boolean,
): Promise<void> {
  await apiFetch(`/api/admin/recruiters/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    body: { metroTeamMember },
    auth: true,
  });
}

/** Admin action: vet a recruiter, or reverse that. Until this is true, they
    can't submit a candidate — see POST /api/submissions. */
export async function setRecruiterVerified(
  uid: string,
  verified: boolean,
): Promise<void> {
  await apiFetch(`/api/admin/recruiters/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    body: { verified },
    auth: true,
  });
}

/** Admin action: suspend a recruiter account, or reinstate it. A suspended
    account is blocked from every write action (submitting candidates, saved
    candidates, messages, file uploads) — see lib/server/auth.ts. */
export async function setRecruiterSuspended(
  uid: string,
  suspended: boolean,
): Promise<void> {
  await apiFetch(`/api/admin/recruiters/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    body: { suspended },
    auth: true,
  });
}

/** Admin action: unlock (or lock) the free recruiter-website builder for this
    recruiter — a perk normally granted after their first placement. */
export async function setRecruiterSiteBuilderEnabled(
  uid: string,
  siteBuilderEnabled: boolean,
): Promise<void> {
  await apiFetch(`/api/admin/recruiters/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    body: { siteBuilderEnabled },
    auth: true,
  });
}

/** Admin action: email this recruiter a reminder to finish their profile.
    Refused server-side if the profile is already complete. */
/** What a bulk delete actually did. Counted by outcome because
    "deleted 37" is not the whole story when two were refused and one had
    already gone. */
export type BulkDeleteResult = {
  deleted: number;
  /** Ids removed, so the caller can drop them from a list it already holds. */
  deletedUids: string[];
  /** Names (or emails) of the accounts removed, for the confirmation line. */
  deletedNames: string[];
  /** Submissions that stayed but lost their recruiter attribution. */
  submissionsDetached: number;
  /** Selected but already gone — someone else deleted them, or the list was stale. */
  notFound: number;
  /** Deliberately kept: admin accounts, and the caller's own. */
  refused: { uid: string; name: string; reason: string }[];
};

/** Admin action: permanently delete recruiter accounts. Submitted candidates
    survive with their recruiter attribution cleared; admin accounts and the
    caller's own account are refused. Firebase Auth is not touched, so signing
    in again would create a fresh, blank profile. */
export function deleteRecruiters(uids: string[]): Promise<BulkDeleteResult> {
  return apiFetch<BulkDeleteResult>("/api/admin/recruiters", {
    method: "DELETE",
    body: { uids },
    auth: true,
  });
}

export async function sendProfileReminder(uid: string): Promise<void> {
  await apiFetch(`/api/admin/recruiters/${encodeURIComponent(uid)}/remind-profile`, {
    method: "POST",
    auth: true,
  });
}

/** What a bulk reminder sweep actually did. Broken down by reason because a
    bare "sent 3" reads as a failure until you can see that the other 17 were
    skipped deliberately. */
export type BulkReminderResult = {
  sent: number;
  /** Names (or emails) of everyone emailed, for the confirmation message. */
  sentTo: string[];
  failed: number;
  skippedComplete: number;
  skippedSuspended: number;
  /** Already reminded inside the cooldown window. */
  skippedRecent: number;
  /** Left unsent because the request ran out of time — run it again. */
  remaining: number;
  cooldownDays: number;
};

/** Admin action: email every recruiter with an unfinished profile. Skips
    complete profiles, suspended accounts, and anyone already reminded in the
    last cooldownDays. */
export function sendProfileReminderToAll(): Promise<BulkReminderResult> {
  return apiFetch<BulkReminderResult>("/api/admin/recruiters/remind-all", {
    method: "POST",
    auth: true,
  });
}

export type BroadcastResult = {
  audience: string;
  audienceLabel: string;
  /** How many the audience held for this run. */
  total: number;
  /** Reached on at least one channel. */
  sent: number;
  emailed: number;
  notified: number;
  /** Nothing got through to these — worth showing by name. */
  failed: { name: string; email: string }[];
  /** Email was asked for, but there's no address on file. */
  skippedNoEmail: number;
  /** Left unsent because the request ran out of time. Pass these back as
      `only` to carry on without mailing the first batch twice. */
  remainingUids: string[];
};

export type BroadcastInput = {
  /** An AudienceId from lib/audiences.ts. The server resolves it to people. */
  audience: string;
  /** Only the button is read from the template; subject and body are sent
      as typed, so the admin gets what they read back in the preview. */
  templateId: string;
  subject: string;
  body: string;
  email?: boolean;
  notify?: boolean;
  /** Continuation: restrict to these uids, intersected with the audience. */
  only?: string[];
  /** Send again even though the same message went to the same audience
      moments ago. */
  force?: boolean;
};

/** Admin action: send one message to a whole audience of recruiters. The
    recipient list is resolved server-side from `audience` — this never takes
    addresses, so it can't reach anyone without an account here. */
export function sendBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  return apiFetch<BroadcastResult>("/api/admin/recruiters/broadcast", {
    method: "POST",
    body: input,
    auth: true,
  });
}

/** Bootstrap the first admin (used by the /setup page). */
export async function bootstrapAdmin(): Promise<void> {
  await apiFetch("/api/admin/bootstrap", { method: "POST", auth: true });
}

/** Whether first-admin bootstrap is still available. */
export async function bootstrapAvailable(): Promise<boolean> {
  const { available } = await apiFetch<{ available: boolean }>(
    "/api/admin/bootstrap",
  );
  return available;
}

/** Admin action: the console's admin allow-list, plus any pending invites. */
export function listAdminAccess(): Promise<{ admins: AdminAccount[]; invites: AdminInvite[] }> {
  return apiFetch<{ admins: AdminAccount[]; invites: AdminInvite[] }>(
    "/api/admin/admins",
    { auth: true },
  );
}

/** Admin action: grant admin access to whoever holds this email. If an
    account with that email already exists, access is granted immediately.
    Otherwise an invite is created — it auto-activates the moment that email
    signs in. */
export async function addAdmin(email: string): Promise<AdminAccessGrant> {
  return apiFetch<AdminAccessGrant>("/api/admin/admins", {
    method: "POST",
    body: { email },
    auth: true,
  });
}

/** Admin action: revoke admin access. The server refuses to remove the last
    remaining admin — see DELETE /api/admin/admins/[uid]. */
export async function removeAdmin(uid: string): Promise<void> {
  await apiFetch(`/api/admin/admins/${encodeURIComponent(uid)}`, {
    method: "DELETE",
    auth: true,
  });
}

/** Admin action: cancel a pending invite before it's claimed. */
export async function cancelAdminInvite(email: string): Promise<void> {
  await apiFetch(`/api/admin/invites/${encodeURIComponent(email)}`, {
    method: "DELETE",
    auth: true,
  });
}

/** Admin action: history of every grant/revoke/invite against the allow-list. */
export function listAdminAuditLog(): Promise<AdminAuditEntry[]> {
  return apiFetch<AdminAuditEntry[]>("/api/admin/audit-log", { auth: true });
}

/** Admin action: email one recruiter from the console. Subject and body are
    whatever the admin wrote; templateId only decides the button, if any. */
export async function sendRecruiterEmail(
  uid: string,
  input: {
    templateId: string;
    subject: string;
    body: string;
    /** Both default to true server-side; at least one must be set. */
    email?: boolean;
    notify?: boolean;
  },
): Promise<void> {
  await apiFetch(`/api/admin/recruiters/${encodeURIComponent(uid)}/email`, {
    method: "POST",
    body: input,
    auth: true,
  });
}
