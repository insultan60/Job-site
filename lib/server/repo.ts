import "server-only";
import { randomUUID } from "node:crypto";
import { query, queryOne, execute } from "@/lib/db";
import { signedFileUrl } from "./files";
import type { Job, JobStatus, EmploymentType, FAQ } from "@/lib/jobs";
import type { Submission, SubmissionStatus } from "@/lib/submissions";
import type {
  UserProfile, AdminAccount, AdminInvite, AdminAuditEntry, AdminAuditAction,
} from "@/lib/users";
import type { RecruiterSite } from "@/lib/recruiterSite";
import { siteTemplate } from "@/lib/siteThemes";

/* Data access for every table. Routes call these; nothing else touches SQL.

   Shape contract: these return exactly the types the existing client code
   already consumes, with one deliberate difference — `createdAt`/`updatedAt`
   are ISO strings here, not Firestore Timestamps. The client-side types are
   updated to match, so nothing calls .toMillis() on a string. */

/* Firestore generated 20-char IDs. New rows get a UUID; IDs migrated from
   Firestore keep their original value so /jobs/{id} URLs survive. */
const newId = () => randomUUID();

/* ------------------------------------------------------------------ jobs */

type JobRow = {
  id: string;
  title: string;
  company: string;
  category: string;
  location: string;
  remote: number;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  bounty: number | null;
  fee_tier: string | null;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  faqs: unknown;
  screening_questions: unknown;
  hiring_stages: unknown;
  status: JobStatus;
  created_at: string | null;
  updated_at: string | null;
};

/* mysql2 returns JSON columns already parsed, but a column written as a string
   by another client comes back as a string. Tolerate both. */
function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function toJob(r: JobRow): Job {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    category: r.category,
    location: r.location,
    remote: Boolean(r.remote),
    employmentType: r.employment_type,
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    bounty: r.bounty,
    feeTier: r.fee_tier,
    description: r.description ?? "",
    responsibilities: r.responsibilities ?? "",
    requirements: r.requirements ?? "",
    faqs: parseJson<FAQ[]>(r.faqs, []),
    screeningQuestions: parseJson<string[]>(r.screening_questions, []),
    hiringStages: parseJson<string[]>(r.hiring_stages, []),
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const JOB_COLUMNS = `
  id, title, company, category, location, remote, employment_type,
  salary_min, salary_max, bounty, fee_tier, description, responsibilities, requirements,
  faqs, screening_questions, hiring_stages, status, created_at, updated_at`;

export async function listOpenJobs(): Promise<Job[]> {
  const rows = await query<JobRow>(
    `SELECT ${JOB_COLUMNS} FROM jobs WHERE status = 'open'
      ORDER BY created_at DESC`,
  );
  return rows.map(toJob);
}

export async function listAllJobs(): Promise<Job[]> {
  const rows = await query<JobRow>(
    `SELECT ${JOB_COLUMNS} FROM jobs ORDER BY created_at DESC`,
  );
  return rows.map(toJob);
}

export async function getJob(id: string): Promise<Job | null> {
  const row = await queryOne<JobRow>(
    `SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ?`,
    [id],
  );
  return row ? toJob(row) : null;
}

/** Public reads must never surface a draft or closed role. */
export async function getOpenJob(id: string): Promise<Job | null> {
  const row = await queryOne<JobRow & { submission_count: number }>(
    `SELECT ${JOB_COLUMNS},
       (SELECT COUNT(*) FROM submissions s WHERE s.job_id = jobs.id) AS submission_count
     FROM jobs WHERE id = ? AND status = 'open'`,
    [id],
  );
  return row ? { ...toJob(row), submissionCount: Number(row.submission_count) } : null;
}

export type JobWrite = {
  title: string;
  company: string;
  category: string;
  location: string;
  remote: boolean;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  bounty: number | null;
  feeTier: string | null;
  description: string;
  responsibilities: string;
  requirements: string;
  faqs: string;
  screeningQuestions: string;
  hiringStages: string;
  status: JobStatus;
};

export async function createJob(input: JobWrite, id: string = newId()): Promise<string> {
  await execute(
    `INSERT INTO jobs
       (id, title, company, category, location, remote, employment_type,
        salary_min, salary_max, bounty, fee_tier, description, responsibilities,
        requirements, faqs, screening_questions, hiring_stages, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, input.title, input.company, input.category, input.location,
      input.remote, input.employmentType, input.salaryMin, input.salaryMax,
      input.bounty, input.feeTier, input.description, input.responsibilities,
      input.requirements, input.faqs, input.screeningQuestions,
      input.hiringStages, input.status,
    ],
  );
  return id;
}

export async function updateJob(id: string, input: JobWrite): Promise<boolean> {
  const result = await execute(
    `UPDATE jobs SET
       title = ?, company = ?, category = ?, location = ?, remote = ?,
       employment_type = ?, salary_min = ?, salary_max = ?, bounty = ?,
       fee_tier = ?, description = ?, responsibilities = ?, requirements = ?, faqs = ?,
       screening_questions = ?, hiring_stages = ?, status = ?
     WHERE id = ?`,
    [
      input.title, input.company, input.category, input.location, input.remote,
      input.employmentType, input.salaryMin, input.salaryMax, input.bounty,
      input.feeTier, input.description, input.responsibilities, input.requirements,
      input.faqs, input.screeningQuestions, input.hiringStages, input.status,
      id,
    ],
  );
  return result.affectedRows > 0;
}

export async function deleteJob(id: string): Promise<boolean> {
  const result = await execute("DELETE FROM jobs WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

/* ----------------------------------------------------------- submissions */

type SubmissionRow = {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  recruiter_id: string | null;
  recruiter_name: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  candidate_linkedin: string;
  work_authorization: string;
  candidate_photo_url: string;
  notes: string | null;
  cv_file_id: string | null;
  cv_name: string | null;
  cv_type: string | null;
  cv_size: number | null;
  bounty: number | null;
  fee_tier: string | null;
  status: SubmissionStatus;
  created_at: string | null;
  /* Present only on the admin query, which joins users. Prefixed to keep them
     distinct from the submission's own denormalised recruiter_name. */
  r_uid?: string | null;
  r_name?: string | null;
  r_email?: string | null;
  r_phone?: string | null;
  r_company?: string | null;
  r_headline?: string | null;
  r_location?: string | null;
  r_linkedin?: string | null;
  r_website?: string | null;
  r_twitter?: string | null;
  r_facebook?: string | null;
  r_instagram?: string | null;
  r_photo_url?: string | null;
  r_created_at?: string | null;
};

/* cvUrl is generated, not stored: a fresh signed link is minted each time a
   submission is read. Because this only runs for a caller who was already
   allowed to read the row, download rights follow read rights — and the link
   expires on its own an hour later. */
function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    jobId: r.job_id,
    jobTitle: r.job_title,
    company: r.company,
    // "" rather than null keeps the existing client type unchanged.
    recruiterId: r.recruiter_id ?? "",
    recruiterName: r.recruiter_name,
    candidateName: r.candidate_name,
    candidateEmail: r.candidate_email,
    candidatePhone: r.candidate_phone,
    candidateLinkedin: r.candidate_linkedin ?? "",
    workAuthorization: r.work_authorization ?? "",
    candidatePhotoUrl: r.candidate_photo_url ?? "",
    notes: r.notes ?? "",
    cvUrl: r.cv_file_id ? signedFileUrl(r.cv_file_id) : "",
    cvName: r.cv_name ?? "",
    cvType: r.cv_type ?? "",
    cvSize: r.cv_size,
    bounty: r.bounty,
    feeTier: r.fee_tier,
    status: r.status,
    createdAt: r.created_at,
    /* Only the admin query selects these. `r_uid` is the tell: undefined means
       the query didn't ask for them, null means the recruiter row is genuinely
       gone (deleted account, or an open application with no referrer). */
    ...(r.r_uid === undefined
      ? {}
      : {
          recruiter: r.r_uid
            ? {
                uid: r.r_uid,
                name: r.r_name ?? "",
                email: r.r_email ?? "",
                phone: r.r_phone ?? "",
                company: r.r_company ?? "",
                headline: r.r_headline ?? "",
                location: r.r_location ?? "",
                linkedin: r.r_linkedin ?? "",
                website: r.r_website ?? "",
                twitter: r.r_twitter ?? "",
                facebook: r.r_facebook ?? "",
                instagram: r.r_instagram ?? "",
                photoURL: r.r_photo_url ?? "",
                createdAt: r.r_created_at ?? null,
              }
            : null,
        }),
  };
}

/* LEFT JOIN, not INNER: a submission whose CV row is somehow missing should
   still be readable — losing the candidate's contact details because the file
   vanished would be worse than showing the row without a download link. */
const SUB_COLUMNS = `
  s.id, s.job_id, s.job_title, s.company, s.recruiter_id, s.recruiter_name,
  s.candidate_name, s.candidate_email, s.candidate_phone,
  s.candidate_linkedin, s.candidate_photo_url, s.work_authorization, s.notes,
  s.cv_file_id, f.filename AS cv_name, f.content_type AS cv_type,
  f.byte_size AS cv_size, s.bounty, s.fee_tier, s.status, s.created_at`;

const SUB_FROM = `FROM submissions s LEFT JOIN files f ON f.id = s.cv_file_id`;

/* Admin-only additions: the referring recruiter's profile. LEFT JOIN again —
   a deleted recruiter sets submissions.recruiter_id to NULL, and that must not
   make the submission itself disappear from the screening queue. */
const SUB_RECRUITER_COLUMNS = `,
  u.uid AS r_uid, u.name AS r_name, u.email AS r_email, u.phone AS r_phone,
  u.company AS r_company, u.headline AS r_headline, u.location AS r_location,
  u.linkedin AS r_linkedin, u.website AS r_website, u.twitter AS r_twitter,
  u.facebook AS r_facebook, u.instagram AS r_instagram,
  u.photo_url AS r_photo_url, u.created_at AS r_created_at`;

const SUB_FROM_WITH_RECRUITER = `${SUB_FROM} LEFT JOIN users u ON u.uid = s.recruiter_id`;

export async function listSubmissionsByRecruiter(
  recruiterId: string,
): Promise<Submission[]> {
  const rows = await query<SubmissionRow>(
    `SELECT ${SUB_COLUMNS} ${SUB_FROM}
      WHERE s.recruiter_id = ? ORDER BY s.created_at DESC`,
    [recruiterId],
  );
  return rows.map(toSubmission);
}

/** Admin screening queue — every submission, with the referrer's profile. */
export async function listAllSubmissions(): Promise<Submission[]> {
  const rows = await query<SubmissionRow>(
    `SELECT ${SUB_COLUMNS}${SUB_RECRUITER_COLUMNS}
     ${SUB_FROM_WITH_RECRUITER} ORDER BY s.created_at DESC`,
  );
  return rows.map(toSubmission);
}

/** One submission, any owner. Used to check ownership before returning its
    message thread — a recruiter may only read their own. */
export async function getSubmission(id: string): Promise<Submission | null> {
  const row = await queryOne<SubmissionRow>(
    `SELECT ${SUB_COLUMNS} ${SUB_FROM} WHERE s.id = ?`,
    [id],
  );
  return row ? toSubmission(row) : null;
}

export type SubmissionWrite = {
  jobId: string;
  jobTitle: string;
  company: string;
  recruiterId: string | null;
  recruiterName: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  /** Both optional — "" means "none on file". */
  candidateLinkedin: string;
  candidatePhotoUrl: string;
  /** Code from lib/workAuthorization.ts; "" when not asked. */
  workAuthorization: string;
  notes: string;
  cvFileId: string;
  bounty: number | null;
  feeTier: string | null;
};

export async function createSubmission(
  input: SubmissionWrite,
  id = newId(),
): Promise<string> {
  await execute(
    `INSERT INTO submissions
       (id, job_id, job_title, company, recruiter_id, recruiter_name,
        candidate_name, candidate_email, candidate_phone,
        candidate_linkedin, candidate_photo_url, work_authorization, notes,
        cv_file_id, bounty, fee_tier, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'submitted')`,
    [
      id, input.jobId, input.jobTitle, input.company, input.recruiterId,
      input.recruiterName, input.candidateName, input.candidateEmail,
      input.candidatePhone, input.candidateLinkedin, input.candidatePhotoUrl,
      input.workAuthorization, input.notes, input.cvFileId, input.bounty, input.feeTier,
    ],
  );
  return id;
}

/** True when the file exists, is a CV, belongs to the calling recruiter, and
    isn't already attached elsewhere. The owner check matters as much as the
    other two: without it, a caller who learns any valid CV file id — from a
    log line, a stray screenshot, whatever — could attach someone else's file
    to their own submission. */
export async function cvFileIsAvailable(fileId: string, ownerUid: string): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM files f
      WHERE f.id = ? AND f.kind = 'cv' AND f.owner_uid = ?
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.cv_file_id = f.id)`,
    [fileId, ownerUid],
  );
  return (row?.n ?? 0) > 0;
}

/** True when the file exists, is a CV, and belongs to the calling recruiter —
    used when attaching a CV to a saved candidate (lib/candidates.ts), where
    unlike a submission the file is never "consumed": the same pool CV can be
    pointed at from a candidate indefinitely, so this deliberately skips the
    not-already-attached check cvFileIsAvailable does. */
export async function cvFileOwnedBy(fileId: string, ownerUid: string): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM files WHERE id = ? AND kind = 'cv' AND owner_uid = ?`,
    [fileId, ownerUid],
  );
  return (row?.n ?? 0) > 0;
}

/** Copy a file's bytes into a brand-new row. Used when quick-applying a saved
    candidate: their pool CV must stay reusable across any number of
    submissions, but cvFileIsAvailable() only allows a CV to be attached to
    ONE submission — so each application gets its own independent copy rather
    than fighting over the same file id. Returns null if the source is gone. */
export async function cloneFile(fileId: string, ownerUid: string): Promise<string | null> {
  const row = await queryOne<{
    kind: "cv" | "avatar";
    filename: string;
    content_type: string;
    byte_size: number;
    data: Buffer;
  }>(
    "SELECT kind, filename, content_type, byte_size, data FROM files WHERE id = ?",
    [fileId],
  );
  if (!row) return null;

  const id = newId();
  await execute(
    `INSERT INTO files (id, kind, filename, content_type, byte_size, data, owner_uid)
     VALUES (?,?,?,?,?,?,?)`,
    [id, row.kind, row.filename, row.content_type, row.byte_size, row.data, ownerUid],
  );
  return id;
}

export async function setSubmissionStatus(
  id: string,
  status: SubmissionStatus,
): Promise<boolean> {
  const result = await execute(
    "UPDATE submissions SET status = ? WHERE id = ?",
    [status, id],
  );
  return result.affectedRows > 0;
}

/* ------------------------------------------------- submission_messages */

export type SubmissionMessage = {
  id: string;
  submissionId: string;
  senderRole: "recruiter" | "admin";
  senderUid: string | null;
  senderName: string;
  body: string;
  createdAt: string | null;
};

type SubmissionMessageRow = {
  id: string;
  submission_id: string;
  sender_role: "recruiter" | "admin";
  sender_uid: string | null;
  sender_name: string;
  body: string;
  created_at: string | null;
};

function toSubmissionMessage(r: SubmissionMessageRow): SubmissionMessage {
  return {
    id: r.id,
    submissionId: r.submission_id,
    senderRole: r.sender_role,
    senderUid: r.sender_uid,
    senderName: r.sender_name,
    body: r.body,
    createdAt: r.created_at,
  };
}

export async function listSubmissionMessages(
  submissionId: string,
): Promise<SubmissionMessage[]> {
  const rows = await query<SubmissionMessageRow>(
    `SELECT id, submission_id, sender_role, sender_uid, sender_name, body, created_at
       FROM submission_messages
      WHERE submission_id = ?
      ORDER BY created_at ASC`,
    [submissionId],
  );
  return rows.map(toSubmissionMessage);
}

export async function createSubmissionMessage(input: {
  submissionId: string;
  senderRole: "recruiter" | "admin";
  senderUid: string | null;
  senderName: string;
  body: string;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO submission_messages
       (id, submission_id, sender_role, sender_uid, sender_name, body)
     VALUES (?,?,?,?,?,?)`,
    [
      id, input.submissionId, input.senderRole, input.senderUid,
      input.senderName, input.body,
    ],
  );
  return id;
}

/* ------------------------------------------------------------ candidates */

/* A recruiter's own saved candidate pool — distinct from `submissions`,
   which is a referral already sent to a specific job. Saved here, a
   candidate can be quick-applied to any open role without retyping their
   details or re-uploading their CV each time (see cloneFile above and
   POST /api/submissions' candidateId branch). */

type CandidateRow = {
  id: string;
  recruiter_id: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  photo_url: string;
  notes: string | null;
  cv_file_id: string | null;
  cv_name: string | null;
  cv_type: string | null;
  cv_size: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SavedCandidate = {
  id: string;
  recruiterId: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  photoUrl: string;
  notes: string;
  cvFileId: string | null;
  cvUrl: string;
  cvName: string;
  cvType: string;
  cvSize: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function toCandidate(r: CandidateRow): SavedCandidate {
  return {
    id: r.id,
    recruiterId: r.recruiter_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    linkedin: r.linkedin ?? "",
    photoUrl: r.photo_url ?? "",
    notes: r.notes ?? "",
    cvFileId: r.cv_file_id,
    cvUrl: r.cv_file_id ? signedFileUrl(r.cv_file_id) : "",
    cvName: r.cv_name ?? "",
    cvType: r.cv_type ?? "",
    cvSize: r.cv_size,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const CANDIDATE_COLUMNS = `
  c.id, c.recruiter_id, c.name, c.email, c.phone, c.linkedin, c.photo_url, c.notes, c.cv_file_id,
  f.filename AS cv_name, f.content_type AS cv_type, f.byte_size AS cv_size,
  c.created_at, c.updated_at`;

// LEFT JOIN: a saved candidate is allowed to have no CV yet.
const CANDIDATE_FROM = `FROM candidates c LEFT JOIN files f ON f.id = c.cv_file_id`;

export async function listCandidatesByRecruiter(recruiterId: string): Promise<SavedCandidate[]> {
  const rows = await query<CandidateRow>(
    `SELECT ${CANDIDATE_COLUMNS} ${CANDIDATE_FROM}
      WHERE c.recruiter_id = ? ORDER BY c.created_at DESC`,
    [recruiterId],
  );
  return rows.map(toCandidate);
}

/** One saved candidate, any owner — routes check recruiterId against the
    caller's uid before allowing a read, update, or quick-apply. */
export async function getCandidate(id: string): Promise<SavedCandidate | null> {
  const row = await queryOne<CandidateRow>(
    `SELECT ${CANDIDATE_COLUMNS} ${CANDIDATE_FROM} WHERE c.id = ?`,
    [id],
  );
  return row ? toCandidate(row) : null;
}

export type CandidateWrite = {
  name: string;
  email: string;
  phone: string;
  /** Optional — omitted/empty means "none on file". */
  linkedin: string;
  notes: string;
  /** undefined = leave whatever CV/photo is already saved untouched (an
      edit that didn't attach a new file); null would mean "clear it", which
      the UI never offers — there's no way to remove either without
      replacing it. */
  cvFileId?: string;
  photoUrl?: string;
};

export async function createCandidate(
  recruiterId: string,
  input: CandidateWrite,
): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO candidates (id, recruiter_id, name, email, phone, linkedin, photo_url, notes, cv_file_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, recruiterId, input.name, input.email, input.phone, input.linkedin, input.photoUrl ?? "", input.notes, input.cvFileId ?? null],
  );
  return id;
}

export async function updateCandidate(id: string, input: CandidateWrite): Promise<boolean> {
  // cv_file_id and photo_url are each independently "leave untouched when
  // undefined" (no new file attached this edit) — built dynamically rather
  // than hand-writing all four combinations. Every fragment here is a fixed
  // string this function controls, and every value is still bound as a
  // parameter, so this is not building SQL out of user input.
  const sets = ["name = ?", "email = ?", "phone = ?", "linkedin = ?", "notes = ?"];
  const args: (string | null)[] = [input.name, input.email, input.phone, input.linkedin, input.notes];
  if (input.cvFileId !== undefined) { sets.push("cv_file_id = ?"); args.push(input.cvFileId); }
  if (input.photoUrl !== undefined) { sets.push("photo_url = ?"); args.push(input.photoUrl); }
  args.push(id);

  const result = await execute(`UPDATE candidates SET ${sets.join(", ")} WHERE id = ?`, args);
  return result.affectedRows > 0;
}

export async function deleteCandidate(id: string): Promise<boolean> {
  const result = await execute("DELETE FROM candidates WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

/* ----------------------------------------------------------------- users */

type UserRow = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  headline: string;
  location: string;
  linkedin: string;
  website: string;
  twitter: string;
  facebook: string;
  instagram: string;
  bio: string | null;
  photo_url: string;
  verification_video_id: string | null;
  metro_team_member: number;
  verified: number;
  suspended: number;
  site_builder_enabled: number;
  profile_reminder_sent_at: string | null;
  created_at: string | null;
};

function toUserProfile(r: UserRow): UserProfile {
  return {
    uid: r.uid,
    name: r.name,
    email: r.email,
    phone: r.phone,
    company: r.company,
    headline: r.headline,
    location: r.location,
    linkedin: r.linkedin,
    website: r.website,
    twitter: r.twitter,
    facebook: r.facebook,
    instagram: r.instagram,
    bio: r.bio ?? "",
    photoURL: r.photo_url,
    // Minted fresh on every read rather than stored — same reasoning as CV
    // links (lib/server/files.ts): access follows "can you currently see this
    // profile", not a permanent URL that outlives that.
    verificationVideoId: r.verification_video_id,
    verificationVideoUrl: r.verification_video_id ? signedFileUrl(r.verification_video_id) : null,
    metroTeamMember: Boolean(r.metro_team_member),
    verified: Boolean(r.verified),
    suspended: Boolean(r.suspended),
    siteBuilderEnabled: Boolean(r.site_builder_enabled),
    profileReminderSentAt: r.profile_reminder_sent_at,
    createdAt: r.created_at,
  };
}

const USER_COLUMNS = `
  uid, name, email, phone, company, headline, location, linkedin, website,
  twitter, facebook, instagram, bio, photo_url, verification_video_id,
  metro_team_member, verified,
  suspended, site_builder_enabled, profile_reminder_sent_at, created_at`;

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const row = await queryOne<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE uid = ?`,
    [uid],
  );
  return row ? toUserProfile(row) : null;
}

export async function listUsers(): Promise<UserProfile[]> {
  const rows = await query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC`,
  );
  return rows.map(toUserProfile);
}

/** Admin action: look up a recruiter by email, to grant them admin without
    needing to know their raw Firebase UID. Case-insensitive — the column
    collation (utf8mb4_0900_ai_ci) already does that at the SQL level. */
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const row = await queryOne<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  return row ? toUserProfile(row) : null;
}

/** Signup. Idempotent so a retried request can't fail on a duplicate key. */
export async function createUserProfile(
  uid: string,
  name: string,
  email: string,
): Promise<void> {
  await execute(
    `INSERT INTO users (uid, name, email) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)`,
    [uid, name, email],
  );
}

/* Make sure a signed-in account has a profile row, and return it.
 *
 * A Firebase Auth account and a `users` row are created by two separate calls
 * at signup, so they can drift apart: the browser closes between them, the DB
 * is briefly unreachable, or the account predates this table. The result was a
 * login that reached the dashboard and found nothing — "No account profile
 * found", with no way forward.
 *
 * Unlike createUserProfile this is non-destructive: the ON DUPLICATE branch is
 * a deliberate no-op, so a concurrent request (or a returning user who has
 * since edited their name) can never have their profile overwritten by whatever
 * is stamped on the token. */
export async function ensureUserProfile(
  uid: string,
  name: string,
  email: string,
): Promise<UserProfile | null> {
  await execute(
    `INSERT INTO users (uid, name, email) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE uid = uid`,
    [uid, name, email],
  );
  return getUserProfile(uid);
}

export type ProfileWrite = {
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
  /** undefined = leave whatever video is already saved untouched (an update
      that didn't touch the video, e.g. SiteBuilderWizard's photo-only save);
      null = clear it; a string = set it. Same convention as
      CandidateWrite.cvFileId above. */
  verificationVideoId?: string | null;
};

/* Note the columns absent here: uid, email and created_at. Those are identity
   and audit fields, and letting a profile PUT touch them would allow a user to
   rewrite their own audit trail. */
export async function updateUserProfile(
  uid: string,
  input: ProfileWrite,
): Promise<void> {
  const sets = [
    "name = ?", "phone = ?", "company = ?", "headline = ?", "location = ?",
    "linkedin = ?", "website = ?", "twitter = ?", "facebook = ?", "instagram = ?",
    "bio = ?", "photo_url = ?",
  ];
  const args: (string | null)[] = [
    input.name, input.phone, input.company, input.headline, input.location,
    input.linkedin, input.website, input.twitter, input.facebook, input.instagram,
    input.bio, input.photoURL,
  ];
  if (input.verificationVideoId !== undefined) {
    sets.push("verification_video_id = ?");
    args.push(input.verificationVideoId);
  }
  args.push(uid);

  await execute(`UPDATE users SET ${sets.join(", ")} WHERE uid = ?`, args);
}

/** True when `id` is a video file this uid actually uploaded. Guards
    PUT /api/me: without this, a recruiter could point verification_video_id
    at any existing file id (including someone else's video) since the id
    alone isn't treated as secret — the signed URL is what protects reading
    it, not the id's unguessability. */
export async function ownsVideoFile(id: string, uid: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    "SELECT id FROM files WHERE id = ? AND owner_uid = ? AND kind = 'video'",
    [id, uid],
  );
  return row !== null;
}

/** Admin action: mark a recruiter as vetted, or reverse that. An unverified
    recruiter can browse and use everything except actually submitting a
    candidate — see the check in POST /api/submissions. */
export async function setRecruiterVerified(uid: string, value: boolean): Promise<boolean> {
  const result = await execute(
    "UPDATE users SET verified = ? WHERE uid = ?",
    [value, uid],
  );
  return result.affectedRows > 0;
}

/** Admin action: suspend a recruiter account, or reinstate it. See
    requireActiveUid()/requireVerifiedUid() in lib/server/auth.ts for what
    this actually blocks. */
export async function setRecruiterSuspended(uid: string, value: boolean): Promise<boolean> {
  const result = await execute(
    "UPDATE users SET suspended = ? WHERE uid = ?",
    [value, uid],
  );
  return result.affectedRows > 0;
}

/** Admin action: put a recruiter on, or take them off, the public Metro
    Associates team roster. */
export async function setMetroTeamMember(uid: string, value: boolean): Promise<boolean> {
  const result = await execute(
    "UPDATE users SET metro_team_member = ? WHERE uid = ?",
    [value, uid],
  );
  return result.affectedRows > 0;
}

/** Admin action: unlock (or lock) the self-serve recruiter-website builder
    for this recruiter. See recruiter_sites below. */
export async function setSiteBuilderEnabled(uid: string, value: boolean): Promise<boolean> {
  const result = await execute(
    "UPDATE users SET site_builder_enabled = ? WHERE uid = ?",
    [value, uid],
  );
  return result.affectedRows > 0;
}

/** How many candidates this recruiter has submitted. Read before a delete so
    the console can warn that real work is attached to the account, and so the
    audit entry records what was lost. */
export async function countSubmissionsByRecruiter(uid: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM submissions WHERE recruiter_id = ?",
    [uid],
  );
  return Number(row?.n ?? 0);
}

/* Delete a recruiter's account.
 *
 * One statement is enough. Every table that references users(uid) already
 * declares its own behaviour, so the database decides what follows rather
 * than this function guessing:
 *
 *   candidates, recruiter_sites, notifications, site_leads  ON DELETE CASCADE
 *   submissions.recruiter_id, files.owner_uid,
 *   submission_messages.sender_uid                          ON DELETE SET NULL
 *
 * So submitted candidates survive with their recruiter attribution cleared,
 * which is the right trade: the submission is the client's record, not the
 * recruiter's, and deleting a spam signup should never delete a real
 * placement.
 *
 * What this does NOT do is touch Firebase Auth — the server verifies ID
 * tokens with jose and holds no service-account key (see lib/server/auth.ts).
 * If a deleted person signs in again, GET /api/me creates a fresh blank
 * profile. For bot signups that is academic; for a real person it means the
 * delete is a reset, not a ban.
 */
export async function deleteRecruiter(uid: string): Promise<boolean> {
  const result = await execute("DELETE FROM users WHERE uid = ?", [uid]);
  return result.affectedRows > 0;
}

/** Whether this uid holds console access. Checked before a delete: an admin's
    recruiter profile is not something to remove from the recruiter list by
    accident — revoke the access first, deliberately, on the Admins page. */
export async function isAdminUid(uid: string): Promise<boolean> {
  const row = await queryOne<{ uid: string }>("SELECT uid FROM admins WHERE uid = ?", [uid]);
  return Boolean(row);
}

/** Stamps that an admin just sent this recruiter the "complete your profile"
    reminder email — see POST /api/admin/recruiters/[uid]/remind-profile. */
export async function markProfileReminderSent(uid: string): Promise<boolean> {
  const result = await execute(
    "UPDATE users SET profile_reminder_sent_at = CURRENT_TIMESTAMP(3) WHERE uid = ?",
    [uid],
  );
  return result.affectedRows > 0;
}

/** Public: recruiters an admin has approved to appear on Metro Associates'
    "Meet Our Team" page. Alphabetical — there is no other natural order for a
    public roster, and it keeps the listing stable as people are added. */
export async function listMetroTeamMembers(): Promise<UserProfile[]> {
  const rows = await query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE metro_team_member = TRUE ORDER BY name ASC`,
  );
  return rows.map(toUserProfile);
}

/* ------------------------------------------------------- recruiter_sites */

type RecruiterSiteRow = {
  recruiter_id: string;
  slug: string;
  template: string;
  theme: string;
  tagline: string;
  intro: string | null;
  specialisms: unknown;
  highlights: unknown;
  stats: unknown;
  expertise: unknown;
  experience: unknown;
  cta_label: string;
  cta_url: string;
  contact_heading: string;
  contact_message: string;
  footer_note: string;
  published: number;
  created_at: string | null;
  updated_at: string | null;
};

function toRecruiterSite(r: RecruiterSiteRow): RecruiterSite {
  return {
    recruiterId: r.recruiter_id,
    slug: r.slug,
    template: siteTemplate(r.template),
    theme: r.theme as RecruiterSite["theme"],
    tagline: r.tagline,
    intro: r.intro ?? "",
    specialisms: parseJson<string[]>(r.specialisms, []),
    highlights: parseJson<string[]>(r.highlights, []),
    stats: parseJson<RecruiterSite["stats"]>(r.stats, []),
    expertise: parseJson<RecruiterSite["expertise"]>(r.expertise, []),
    experience: parseJson<RecruiterSite["experience"]>(r.experience, []),
    ctaLabel: r.cta_label,
    ctaUrl: r.cta_url,
    contactHeading: r.contact_heading,
    contactMessage: r.contact_message,
    footerNote: r.footer_note,
    published: Boolean(r.published),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SITE_COLUMNS = `
  recruiter_id, slug, template, theme, tagline, intro, specialisms,
  highlights, stats, expertise, experience, cta_label, cta_url,
  contact_heading, contact_message, footer_note, published,
  created_at, updated_at`;

export async function getRecruiterSiteByUid(uid: string): Promise<RecruiterSite | null> {
  const row = await queryOne<RecruiterSiteRow>(
    `SELECT ${SITE_COLUMNS} FROM recruiter_sites WHERE recruiter_id = ?`,
    [uid],
  );
  return row ? toRecruiterSite(row) : null;
}

/** Whether `slug` already belongs to some OTHER recruiter — powers the
    live availability check while typing, so a collision shows up before
    save instead of only as an error on submit. A recruiter's own current
    slug is never "taken" from their own point of view. */
export async function slugTakenByOther(slug: string, uid: string): Promise<boolean> {
  const row = await queryOne<{ recruiter_id: string }>(
    `SELECT recruiter_id FROM recruiter_sites WHERE slug = ? AND recruiter_id != ?`,
    [slug, uid],
  );
  return Boolean(row);
}

/** Public: the profile fields a rendered site needs, alongside the site row
    itself. Only ever returned for a published site — see the route. */
export type PublicRecruiterSite = {
  site: RecruiterSite;
  recruiter: Pick<
    UserProfile,
    "name" | "headline" | "bio" | "photoURL" | "phone" | "email" | "location" |
    "linkedin" | "website" | "twitter" | "facebook" | "instagram"
  >;
};

export async function getRecruiterSiteBySlug(slug: string): Promise<PublicRecruiterSite | null> {
  const row = await queryOne<RecruiterSiteRow & Pick<UserRow,
    "name" | "headline" | "bio" | "photo_url" | "phone" | "email" | "location" |
    "linkedin" | "website" | "twitter" | "facebook" | "instagram"
  >>(
    `SELECT rs.recruiter_id, rs.slug, rs.template, rs.theme, rs.tagline, rs.intro,
            rs.specialisms, rs.highlights, rs.stats, rs.expertise, rs.experience,
            rs.cta_label, rs.cta_url, rs.contact_heading, rs.contact_message, rs.footer_note,
            rs.published, rs.created_at, rs.updated_at,
            u.name, u.headline, u.bio, u.photo_url, u.phone, u.email, u.location,
            u.linkedin, u.website, u.twitter, u.facebook, u.instagram
       FROM recruiter_sites rs
       JOIN users u ON u.uid = rs.recruiter_id
      WHERE rs.slug = ? AND rs.published = TRUE`,
    [slug],
  );
  if (!row) return null;
  return {
    site: toRecruiterSite(row),
    recruiter: {
      name: row.name,
      headline: row.headline,
      bio: row.bio ?? "",
      photoURL: row.photo_url,
      phone: row.phone,
      email: row.email,
      location: row.location,
      linkedin: row.linkedin,
      website: row.website,
      twitter: row.twitter,
      facebook: row.facebook,
      instagram: row.instagram,
    },
  };
}

/** Who owns the published site at this slug. Used by the microsite's lead
    form, which knows the slug from the URL and nothing else — and which must
    not accept a recruiter id from the client, or anyone could post leads
    against any recruiter. Unpublished sites return null, so a lead can't be
    filed against a site that isn't live. */
export async function getPublishedSiteOwner(
  slug: string,
): Promise<{ uid: string; name: string; email: string } | null> {
  const row = await queryOne<{ uid: string; name: string; email: string }>(
    `SELECT u.uid, u.name, u.email
       FROM recruiter_sites rs
       JOIN users u ON u.uid = rs.recruiter_id
      WHERE rs.slug = ? AND rs.published = TRUE`,
    [slug],
  );
  return row ?? null;
}

export type RecruiterSiteWrite = {
  slug: string;
  template: string;
  theme: string;
  tagline: string;
  intro: string;
  specialisms: string; // JSON-encoded, see jsonArray()
  highlights: string;  // JSON-encoded, see jsonArray()
  stats: string;       // JSON-encoded [{ value, label }]
  expertise: string;   // JSON-encoded [{ skill, percent }]
  experience: string;  // JSON-encoded [{ role, company, period, current, bullets }]
  ctaLabel: string;
  ctaUrl: string;
  contactHeading: string;
  contactMessage: string;
  footerNote: string;
  published: boolean;
};

/** Slug is taken by a DIFFERENT recruiter than the one saving. */
export class SlugTakenError extends Error {}

/* UPDATE-else-INSERT rather than a single INSERT ... ON DUPLICATE KEY UPDATE:
   this table has TWO unique keys (recruiter_id, slug), and when a bare INSERT
   collides on the slug of a DIFFERENT recruiter_id, MySQL's merge semantics
   for multiple violated keys are not something to rely on — worst case it
   updates the OTHER recruiter's row instead of rejecting the write. Doing an
   explicit UPDATE-by-PK first (and only INSERTing when no row exists yet)
   means the only unique key that can ever be violated is `slug`, on a
   straightforward UPDATE or INSERT — never a merge across two different
   recruiter_id rows. */
export async function upsertRecruiterSite(
  uid: string,
  input: RecruiterSiteWrite,
): Promise<RecruiterSite> {
  const args = [
    input.slug, input.template, input.theme, input.tagline, input.intro,
    input.specialisms, input.highlights, input.stats, input.expertise, input.experience,
    input.ctaLabel, input.ctaUrl, input.contactHeading, input.contactMessage, input.footerNote,
    input.published,
  ];
  try {
    const updated = await execute(
      `UPDATE recruiter_sites SET
         slug = ?, template = ?, theme = ?, tagline = ?, intro = ?,
         specialisms = ?, highlights = ?, stats = ?, expertise = ?, experience = ?,
         cta_label = ?, cta_url = ?, contact_heading = ?, contact_message = ?, footer_note = ?,
         published = ?
       WHERE recruiter_id = ?`,
      [...args, uid],
    );
    if (updated.affectedRows === 0) {
      await execute(
        `INSERT INTO recruiter_sites
           (slug, template, theme, tagline, intro, specialisms, highlights,
            stats, expertise, experience, cta_label, cta_url,
            contact_heading, contact_message, footer_note, published, recruiter_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [...args, uid],
      );
    }
  } catch (err: unknown) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "ER_DUP_ENTRY") {
      throw new SlugTakenError("That link is already taken — please choose another.");
    }
    throw err;
  }
  const saved = await getRecruiterSiteByUid(uid);
  if (!saved) throw new Error("Site vanished immediately after being saved.");
  return saved;
}

/* -------------------------------------------------------------- messages */

/** One message on an enquiry thread, in either direction. */
export type EnquiryReply = {
  id: number;
  /** Who wrote it — an admin's name outbound, the enquirer's inbound. */
  adminName: string;
  body: string;
  /** "out" = we sent it. "in" = they replied to it by email. */
  direction: "out" | "in";
  createdAt: string | null;
};

export type ContactMessage = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  handled: boolean;
  /** Parked by an admin: out of both working lists, nothing deleted. Wakes
      by itself when the sender replies. */
  sleeping: boolean;
  /** Set when a signed-in user sent it; null for an anonymous visitor. */
  senderUid: string | null;
  /** Admin answers, oldest first. Empty on reads that don't need the thread. */
  replies: EnquiryReply[];
  createdAt: string | null;
};

export async function createMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string | null;
  /** The signed-in sender, when there is one. Lets a recruiter see what they
      sent and read the answer; null for the anonymous public case. */
  senderUid: string | null;
}): Promise<void> {
  await execute(
    `INSERT INTO messages (name, email, subject, message, ip, sender_uid)
     VALUES (?,?,?,?,?,?)`,
    [input.name, input.email, input.subject, input.message, input.ip, input.senderUid],
  );
}

/** How many contact-form messages this IP has sent in the last `windowSeconds`
    — defense-in-depth behind reCAPTCHA (lib/server/recaptcha.ts) for when
    that's unset or a solver defeats it. Null IPs (can't happen in production
    behind Vercel, but possible locally) never rate-limit each other. */
export async function countRecentMessagesFromIp(ip: string, windowSeconds: number): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM messages
      WHERE ip = ? AND created_at > (NOW() - INTERVAL ? SECOND)`,
    [ip, windowSeconds],
  );
  return row?.n ?? 0;
}

type MessageRow = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string | null;
  handled: number;
  sleeping: number;
  sender_uid: string | null;
  created_at: string | null;
};

const MESSAGE_COLUMNS = `id, name, email, subject, message, handled, sleeping, sender_uid, created_at`;

/* Threads are loaded in one extra query for the whole page rather than one
   per message — a reply-per-enquiry loop is the classic N+1, and this list
   is unbounded. */
async function withReplies(rows: MessageRow[]): Promise<ContactMessage[]> {
  const byMessage = new Map<number, EnquiryReply[]>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const replies = await query<{
      id: number;
      message_id: number;
      admin_name: string;
      body: string;
      direction: string;
      created_at: string | null;
    }>(
      `SELECT id, message_id, admin_name, body, direction, created_at
         FROM message_replies
        WHERE message_id IN (${ids.map(() => "?").join(",")})
        ORDER BY created_at ASC`,
      ids,
    );
    for (const r of replies) {
      const list = byMessage.get(r.message_id) ?? [];
      list.push({
        id: r.id,
        adminName: r.admin_name,
        body: r.body,
        direction: r.direction === "in" ? "in" : "out",
        createdAt: r.created_at,
      });
      byMessage.set(r.message_id, list);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    subject: r.subject,
    message: r.message ?? "",
    handled: Boolean(r.handled),
    sleeping: Boolean(r.sleeping),
    senderUid: r.sender_uid,
    replies: byMessage.get(r.id) ?? [],
    createdAt: r.created_at,
  }));
}

export async function listMessages(): Promise<ContactMessage[]> {
  const rows = await query<MessageRow>(
    `SELECT ${MESSAGE_COLUMNS} FROM messages ORDER BY created_at DESC`,
  );
  return withReplies(rows);
}

/** Enquiries this signed-in user sent, with whatever we replied. Scoped by
    uid in SQL so there's no parameter that could be tampered with to read
    someone else's. */
export async function listMessagesFromSender(uid: string): Promise<ContactMessage[]> {
  const rows = await query<MessageRow>(
    `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE sender_uid = ? ORDER BY created_at DESC`,
    [uid],
  );
  return withReplies(rows);
}

/* One enquiry with its whole thread, for the console's detail page.
   Goes through the same withReplies() as the list so a thread can't render
   differently depending on which page you opened it from. */
export async function getMessage(id: number): Promise<ContactMessage | null> {
  const rows = await query<MessageRow>(
    `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;
  const [message] = await withReplies(rows);
  return message ?? null;
}

/** The enquirer's address, for sending them the reply. Null when the
    enquiry has been deleted. */
export async function getMessageRecipient(
  id: number,
): Promise<{ name: string; email: string; subject: string } | null> {
  const row = await queryOne<{ name: string; email: string; subject: string }>(
    "SELECT name, email, subject FROM messages WHERE id = ?",
    [id],
  );
  return row ?? null;
}

/* Records an admin's answer. Name and email are snapshotted alongside the
   uid so the thread still reads correctly after that admin leaves. Marking
   the enquiry handled is part of the same act — replying IS handling it,
   and leaving that to a second manual click is how threads get answered
   twice. */
export async function addMessageReply(input: {
  messageId: number;
  adminUid: string;
  adminName: string;
  adminEmail: string;
  body: string;
}): Promise<void> {
  await execute(
    `INSERT INTO message_replies (message_id, admin_uid, admin_name, admin_email, body, direction)
     VALUES (?,?,?,?,?,'out')`,
    [input.messageId, input.adminUid, input.adminName, input.adminEmail, input.body],
  );
  await execute("UPDATE messages SET handled = TRUE WHERE id = ?", [input.messageId]);
}

/** The addressing secret for a thread, used to build its reply-to address. */
export async function getMessageReplyToken(id: number): Promise<string | null> {
  const row = await queryOne<{ reply_token: string }>(
    "SELECT reply_token FROM messages WHERE id = ?",
    [id],
  );
  return row?.reply_token || null;
}

/* Finds the thread an inbound email belongs to.
 *
 * Both the id and the token must match. Anyone can email the inbound
 * address, so matching on the id alone would let someone walk sequential
 * numbers and post into other people's conversations. */
export async function findMessageByReplyToken(
  id: number,
  token: string,
): Promise<{ id: number; email: string; name: string } | null> {
  if (!token) return null;
  const row = await queryOne<{ id: number; email: string; name: string }>(
    "SELECT id, email, name FROM messages WHERE id = ? AND reply_token = ?",
    [id, token],
  );
  return row ?? null;
}

/* Fallback for a mail client that dropped our addressed reply-to and
   answered the plain address instead — common enough to be worth handling.
   Matches the sender's most recent thread. Ambiguous if they have several,
   which is why it's the fallback and not the primary route. */
export async function findLatestMessageFromSender(
  email: string,
): Promise<{ id: number; email: string; name: string } | null> {
  const row = await queryOne<{ id: number; email: string; name: string }>(
    "SELECT id, email, name FROM messages WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    [email],
  );
  return row ?? null;
}

/* Records a reply that came back by email.
 *
 * Reopens the thread: someone has answered and is waiting, so it belongs in
 * "Needs a reply" again rather than staying ticked off from the last time an
 * admin wrote. That reopening is the whole point of the feature — without
 * it, an answered thread stays invisible. */
export async function addInboundReply(input: {
  messageId: number;
  fromName: string;
  fromEmail: string;
  body: string;
}): Promise<void> {
  await execute(
    `INSERT INTO message_replies (message_id, admin_uid, admin_name, admin_email, body, direction)
     VALUES (?, NULL, ?, ?, ?, 'in')`,
    [input.messageId, input.fromName || input.fromEmail, input.fromEmail, input.body],
  );
  /* Wakes it too. Someone parked this thread on the understanding that
     nothing was happening on it — that stopped being true the moment they
     wrote back, and a reply that stayed asleep would be a reply nobody
     ever sees. */
  await execute(
    "UPDATE messages SET handled = FALSE, sleeping = FALSE WHERE id = ?",
    [input.messageId],
  );
}

/** Mark an enquiry as dealt with, or reopen it. Returns false when the row
    is gone, so the caller can 404 rather than reporting a phantom success. */
export async function setMessageHandled(id: number, handled: boolean): Promise<boolean> {
  const result = await execute("UPDATE messages SET handled = ? WHERE id = ?", [handled, id]);
  return result.affectedRows > 0;
}

/** Park an enquiry, or bring it back. Nothing is deleted: the row and every
    reply on it stay exactly as they were, and the sender's own copy at
    /dashboard/enquiries is untouched — sleeping is our filing, not theirs. */
export async function setMessageSleeping(id: number, sleeping: boolean): Promise<boolean> {
  const result = await execute("UPDATE messages SET sleeping = ? WHERE id = ?", [sleeping, id]);
  return result.affectedRows > 0;
}

/* ------------------------------------------------------- recruiter leads */

/* Enquiries captured by a recruiter's public microsite. Kept apart from
   `messages` (the jobfolder.com contact form) because these belong to a
   specific recruiter: they show on that recruiter's own dashboard as well as
   in the admin console, and the notification goes to them, not to us. */

export type SiteLead = {
  id: number;
  recruiterId: string;
  /** Only set by the admin-facing read — the recruiter already knows who they are. */
  recruiterName?: string;
  recruiterEmail?: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  handled: boolean;
  createdAt: string | null;
};

type SiteLeadRow = {
  id: number;
  recruiter_id: string;
  recruiter_name?: string;
  recruiter_email?: string;
  name: string;
  email: string;
  phone: string;
  message: string | null;
  handled: number;
  created_at: string | null;
};

function toSiteLead(r: SiteLeadRow): SiteLead {
  return {
    id: r.id,
    recruiterId: r.recruiter_id,
    ...(r.recruiter_name === undefined ? {} : { recruiterName: r.recruiter_name }),
    ...(r.recruiter_email === undefined ? {} : { recruiterEmail: r.recruiter_email }),
    name: r.name,
    email: r.email,
    phone: r.phone,
    message: r.message ?? "",
    handled: Boolean(r.handled),
    createdAt: r.created_at,
  };
}

export async function createSiteLead(input: {
  recruiterId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  ip: string | null;
}): Promise<void> {
  await execute(
    `INSERT INTO site_leads (recruiter_id, name, email, phone, message, ip)
     VALUES (?,?,?,?,?,?)`,
    [input.recruiterId, input.name, input.email, input.phone, input.message, input.ip],
  );
}

/** Same shape of backstop as the contact form: caps how often one IP can post
    while the site form has no captcha of its own. */
export async function countRecentSiteLeadsFromIp(ip: string, windowSeconds: number): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM site_leads
      WHERE ip = ? AND created_at > (NOW() - INTERVAL ? SECOND)`,
    [ip, windowSeconds],
  );
  return row?.n ?? 0;
}

/** Admin: every lead, across all recruiters, with whose site caught it. */
export async function listSiteLeads(): Promise<SiteLead[]> {
  const rows = await query<SiteLeadRow>(
    `SELECT l.id, l.recruiter_id, l.name, l.email, l.phone, l.message,
            l.handled, l.created_at,
            u.name AS recruiter_name, u.email AS recruiter_email
       FROM site_leads l
       JOIN users u ON u.uid = l.recruiter_id
      ORDER BY l.created_at DESC`,
  );
  return rows.map(toSiteLead);
}

/** A recruiter's own leads. Scoped by uid in SQL, not filtered afterwards, so
    a bad caller can't read someone else's. */
export async function listSiteLeadsForRecruiter(uid: string): Promise<SiteLead[]> {
  const rows = await query<SiteLeadRow>(
    `SELECT id, recruiter_id, name, email, phone, message, handled, created_at
       FROM site_leads WHERE recruiter_id = ? ORDER BY created_at DESC`,
    [uid],
  );
  return rows.map(toSiteLead);
}

/** Tick a lead off. `uid` scopes the write to its owner; pass null for an
    admin, who may update any of them. Returns false when nothing matched,
    which covers both "gone" and "not yours". */
export async function setSiteLeadHandled(
  id: number,
  handled: boolean,
  uid: string | null,
): Promise<boolean> {
  const result = uid
    ? await execute("UPDATE site_leads SET handled = ? WHERE id = ? AND recruiter_id = ?", [handled, id, uid])
    : await execute("UPDATE site_leads SET handled = ? WHERE id = ?", [handled, id]);
  return result.affectedRows > 0;
}

/* --------------------------------------------------------- notifications */

/* Messages that appear inside a recruiter's dashboard. Email leaves the
   product — it bounces, it goes to spam, it gets deleted, and nobody can
   tell afterwards whether it was read. These sit where the recruiter
   already signs in, and record when they opened it. */

export type Notification = {
  id: number;
  title: string;
  body: string;
  /** Relative in-app path, or "" for none. */
  link: string;
  source: string;
  authorName: string;
  read: boolean;
  createdAt: string | null;
};

type NotificationRow = {
  id: number;
  title: string;
  body: string;
  link: string;
  source: string;
  author_name: string;
  read_at: string | null;
  created_at: string | null;
};

function toNotification(r: NotificationRow): Notification {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    link: r.link,
    source: r.source,
    authorName: r.author_name,
    read: r.read_at !== null,
    createdAt: r.created_at,
  };
}

export async function createNotification(input: {
  recipientUid: string;
  title: string;
  body: string;
  link?: string;
  source?: string;
  authorName?: string;
}): Promise<void> {
  await execute(
    `INSERT INTO notifications (recipient_uid, title, body, link, source, author_name)
     VALUES (?,?,?,?,?,?)`,
    [
      input.recipientUid,
      input.title,
      input.body,
      input.link ?? "",
      input.source ?? "admin",
      input.authorName ?? "",
    ],
  );
}

/** Newest first, capped — a dashboard list nobody scrolls to the bottom of
    doesn't need to fetch a thousand rows. */
export async function listNotifications(uid: string, limit = 50): Promise<Notification[]> {
  const rows = await query<NotificationRow>(
    `SELECT id, title, body, link, source, author_name, read_at, created_at
       FROM notifications WHERE recipient_uid = ?
      ORDER BY created_at DESC LIMIT ?`,
    [uid, limit],
  );
  return rows.map(toNotification);
}

export async function countUnreadNotifications(uid: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM notifications WHERE recipient_uid = ? AND read_at IS NULL",
    [uid],
  );
  return row?.n ?? 0;
}

/* Scoped by uid in the WHERE clause, so a recruiter can only ever mark their
   own as read — ownership is enforced by the query, not by a check above it
   that could be skipped. Already-read rows are left alone so the original
   timestamp survives a second click. */
export async function markNotificationRead(id: number, uid: string): Promise<boolean> {
  const result = await execute(
    "UPDATE notifications SET read_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND recipient_uid = ? AND read_at IS NULL",
    [id, uid],
  );
  return result.affectedRows > 0;
}

export async function markAllNotificationsRead(uid: string): Promise<number> {
  const result = await execute(
    "UPDATE notifications SET read_at = CURRENT_TIMESTAMP(3) WHERE recipient_uid = ? AND read_at IS NULL",
    [uid],
  );
  return result.affectedRows;
}

/* -------------------------------------------------------------- settings */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await queryOne<{ value: unknown }>(
    "SELECT value FROM settings WHERE setting_key = ?",
    [key],
  );
  return row ? parseJson<T>(row.value, fallback) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await execute(
    `INSERT INTO settings (setting_key, value) VALUES (?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [key, JSON.stringify(value)],
  );
}

/* ---------------------------------------------------------------- admins */

export async function countAdmins(): Promise<number> {
  const row = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM admins");
  return row?.n ?? 0;
}

export async function createAdmin(uid: string, note = ""): Promise<void> {
  await execute(
    `INSERT INTO admins (uid, note) VALUES (?,?)
       ON DUPLICATE KEY UPDATE note = VALUES(note)`,
    [uid, note],
  );
}

/** Atomic version of "countAdmins() === 0, then createAdmin()" for the
    /setup bootstrap flow: a single INSERT...SELECT...WHERE NOT EXISTS rather
    than two separate round trips, which closes the window where two accounts
    racing the bootstrap endpoint at the same instant could both read "zero
    admins" and both get promoted. Returns whether this call was the one that
    won — false means an admin already existed by the time it ran. */
export async function bootstrapFirstAdmin(uid: string, note = ""): Promise<boolean> {
  const result = await execute(
    `INSERT INTO admins (uid, note)
     SELECT ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM admins)`,
    [uid, note],
  );
  return result.affectedRows > 0;
}

/** Every admin, oldest first — the order they were granted access, which for
    a short allow-list like this one reads more naturally than newest-first. */
export async function listAdmins(): Promise<AdminAccount[]> {
  const rows = await query<{
    uid: string;
    note: string;
    created_at: string | null;
    last_active_at: string | null;
    name: string | null;
    email: string | null;
  }>(
    `SELECT a.uid, a.note, a.created_at, a.last_active_at, u.name, u.email
       FROM admins a LEFT JOIN users u ON u.uid = a.uid
      ORDER BY a.created_at ASC`,
  );
  return rows.map((r) => ({
    uid: r.uid,
    note: r.note,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at,
    // LEFT JOIN: an admin isn't required to also be a recruiter with a
    // profile row, so these fall back to empty rather than null.
    name: r.name ?? "",
    email: r.email ?? "",
  }));
}

export async function removeAdmin(uid: string): Promise<boolean> {
  const result = await execute("DELETE FROM admins WHERE uid = ?", [uid]);
  return result.affectedRows > 0;
}

/** Stamped from GET /api/me on every request from a signed-in admin — not a
    login event, just "this access is actually being used". Fire-and-forget
    from the caller's point of view: a failed stamp should never fail the
    request that triggered it. */
export async function touchAdminActivity(uid: string): Promise<void> {
  await execute(
    "UPDATE admins SET last_active_at = CURRENT_TIMESTAMP(3) WHERE uid = ?",
    [uid],
  );
}

/* --------------------------------------------------------- admin invites */

/** Admin access granted to an email with no account yet. Consumed by
    claimAdminInvite the moment that email signs in. */
export async function listAdminInvites(): Promise<AdminInvite[]> {
  const rows = await query<{
    email: string;
    invited_by_name: string;
    invited_by_email: string;
    created_at: string | null;
  }>(
    `SELECT email, invited_by_name, invited_by_email, created_at
       FROM admin_invites ORDER BY created_at ASC`,
  );
  return rows.map((r) => ({
    email: r.email,
    invitedByName: r.invited_by_name,
    invitedByEmail: r.invited_by_email,
    createdAt: r.created_at,
  }));
}

export async function createAdminInvite(
  email: string,
  invitedByName: string,
  invitedByEmail: string,
): Promise<void> {
  await execute(
    `INSERT INTO admin_invites (email, invited_by_name, invited_by_email) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE invited_by_name = VALUES(invited_by_name),
                                invited_by_email = VALUES(invited_by_email)`,
    [email, invitedByName, invitedByEmail],
  );
}

export async function cancelAdminInvite(email: string): Promise<boolean> {
  const result = await execute("DELETE FROM admin_invites WHERE email = ?", [email]);
  return result.affectedRows > 0;
}

/** Called from GET /api/me for a signed-in, not-yet-admin account: if their
    email matches a pending invite, grant admin now and consume the invite.
    Returns whether it did. */
export async function claimAdminInvite(
  uid: string,
  email: string,
  name: string,
): Promise<boolean> {
  const invite = await queryOne<{
    invited_by_name: string;
    invited_by_email: string;
  }>(
    "SELECT invited_by_name, invited_by_email FROM admin_invites WHERE email = ? LIMIT 1",
    [email],
  );
  if (!invite) return false;

  await createAdmin(uid);
  await execute("DELETE FROM admin_invites WHERE email = ?", [email]);
  await logAdminAction({
    action: "invite_claimed",
    actorUid: null,
    actorName: invite.invited_by_name,
    actorEmail: invite.invited_by_email,
    targetUid: uid,
    targetName: name,
    targetEmail: email,
  });
  return true;
}

/* ------------------------------------------------------- admin audit log */

/** History of every sensitive admin action — allow-list changes, recruiter
    controls, job deletion, submission status changes. Actor and target are
    snapshotted as text, not joined live — either account can later be
    removed and the entry must still read sensibly. */
export async function logAdminAction(input: {
  action: AdminAuditAction;
  actorUid: string | null;
  actorName: string;
  actorEmail: string;
  targetUid: string | null;
  targetName: string;
  targetEmail: string;
  details?: string | null;
}): Promise<void> {
  await execute(
    `INSERT INTO admin_audit_log
       (action, actor_uid, actor_name, actor_email, target_uid, target_name, target_email, details)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      input.action, input.actorUid, input.actorName, input.actorEmail,
      input.targetUid, input.targetName, input.targetEmail, input.details ?? null,
    ],
  );
}

/** Most recent 200 entries — plenty for a console this size, and avoids an
    unbounded scan as the log grows. */
export async function listAdminAuditLog(): Promise<AdminAuditEntry[]> {
  const rows = await query<{
    id: number;
    action: AdminAuditAction;
    actor_name: string;
    actor_email: string;
    target_name: string;
    target_email: string;
    details: string | null;
    created_at: string | null;
  }>(
    `SELECT id, action, actor_name, actor_email, target_name, target_email, details, created_at
       FROM admin_audit_log ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actor_name,
    actorEmail: r.actor_email,
    targetName: r.target_name,
    targetEmail: r.target_email,
    details: r.details,
    createdAt: r.created_at,
  }));
}
