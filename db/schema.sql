-- JobFolder — MySQL 8.4 schema
--
-- Target: FreeHostia database `patnov13_jobfolder`, MySQL 8.4,
--         utf8mb4 / utf8mb4_0900_ai_ci.
--
-- Apply via phpMyAdmin (Import tab) or:
--   mysql -h <remote-host> -u patnov13_jobfolder -p patnov13_jobfolder < db/schema.sql
--
-- Verify afterwards with:  npm run db:check
--
-- Scope: Firestore AND Firebase Storage both move to SQL. Only Firebase Auth
-- stays. That means:
--   * `users.uid` and `admins.uid` are Firebase Auth UIDs, not local accounts.
--     There is no password column here and there must never be one.
--   * CV and avatar bytes live in the `files` table, not in cloud storage.
--
-- IMPORTANT — primary keys are the existing Firestore document IDs, kept as
-- VARCHAR rather than switched to AUTO_INCREMENT. Job detail pages live at
-- /jobs/{id}; those URLs are in the sitemap and in the JobPosting structured
-- data. Renumbering the IDs would break every indexed job URL.
--
-- Charset note: utf8mb4 throughout. Candidate names and job descriptions
-- contain accented characters and the occasional emoji; utf8 (3-byte) would
-- silently truncate them.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------- users

-- Recruiters. One self-serve role; admins are a separate allow-list below,
-- mirroring the current `admins/{uid}` collection.
CREATE TABLE users (
  uid         VARCHAR(128) NOT NULL,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  email       VARCHAR(320) NOT NULL DEFAULT '',
  phone       VARCHAR(64)  NOT NULL DEFAULT '',
  company     VARCHAR(255) NOT NULL DEFAULT '',
  headline    VARCHAR(255) NOT NULL DEFAULT '',
  location    VARCHAR(255) NOT NULL DEFAULT '',
  linkedin    VARCHAR(512) NOT NULL DEFAULT '',
  website     VARCHAR(512) NOT NULL DEFAULT '',
  twitter     VARCHAR(512) NOT NULL DEFAULT '',
  facebook    VARCHAR(512) NOT NULL DEFAULT '',
  instagram   VARCHAR(512) NOT NULL DEFAULT '',
  bio         TEXT,
  photo_url   VARCHAR(1024) NOT NULL DEFAULT '',
  -- Recruiter-submitted short (~10s) intro video, so an admin has something
  -- to actually look at before flipping `verified` below — evidence for that
  -- toggle, not itself a gate. NULL until they upload one. References
  -- files.id; the FK is added further down (after ---- files, since this
  -- table is created first and can't forward-reference it inline).
  verification_video_id CHAR(36) NULL,
  -- Admin-set: shows this recruiter on the Metro Associates "Meet Our Team"
  -- page via the public /api/team endpoint. Off by default — every recruiter
  -- signs up self-serve, so this is what turns "has an account" into "admin
  -- has vetted and wants them publicly representing Metro".
  metro_team_member BOOLEAN NOT NULL DEFAULT FALSE,
  -- Admin-set: whether this recruiter has been vetted. Off by default — a
  -- fresh signup can browse and see everything, but POST /api/submissions
  -- refuses to create a submission for an unverified recruiter, so a bad
  -- actor can sign up but not actually refer (or CV-spam) candidates until
  -- an admin has looked at the account.
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Admin-set: a hard stop for a bad-actor account. Unlike `verified` (which
  -- only blocks submitting candidates), a suspended recruiter is blocked from
  -- every write action — submissions, saved candidates, messages, file
  -- uploads — see requireActiveUid()/requireVerifiedUid() in
  -- lib/server/auth.ts. They can still sign in and see their own dashboard,
  -- which is what surfaces the suspension notice to them.
  suspended   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Admin-set: unlocks the self-serve recruiter-website builder on
  -- /dashboard/career-site. Off by default — this is an earned perk (land a
  -- placement), not something every fresh signup gets. See recruiter_sites.
  site_builder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Stamped when an admin sends the "please complete your profile" reminder
  -- email — see POST /api/admin/recruiters/[uid]/remind-profile. NULL means
  -- never reminded. Purely informational (shown in the console); nothing
  -- enforces a cooldown before it can be sent again.
  profile_reminder_sent_at DATETIME(3) NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                           ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (uid),
  KEY idx_users_email (email),
  KEY idx_users_verification_video (verification_video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Admin allow-list. Membership alone grants console access, so writes to this
-- table must only ever happen from a trusted server context.
CREATE TABLE admins (
  uid            VARCHAR(128) NOT NULL,
  note           VARCHAR(255) NOT NULL DEFAULT '',
  -- Stamped from GET /api/me on every authenticated request from this admin —
  -- not a login event, just "was this account used recently". Lets the
  -- Admins page distinguish access that's actually in use from access nobody
  -- has touched in months.
  last_active_at DATETIME(3)  NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Admin access granted to an email that hasn't signed up yet. Consumed the
-- moment a matching account authenticates (see claimAdminInvite, called from
-- GET /api/me) — turned into a real `admins` row and deleted from here.
CREATE TABLE admin_invites (
  email           VARCHAR(320) NOT NULL,
  invited_by_name  VARCHAR(255) NOT NULL DEFAULT '',
  invited_by_email VARCHAR(320) NOT NULL DEFAULT '',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- History of every sensitive admin action — not just the allow-list, also
-- recruiter-control toggles, job deletion, and submission status changes, so
-- "who did this" has an answer for every action that matters, not just admin
-- grants. Actor and target are snapshotted (name/email as text, not a FK)
-- because either account can later be removed and the log entry must still
-- read sensibly — same reasoning as submissions.recruiter_name.
CREATE TABLE admin_audit_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  action       ENUM(
    'grant','revoke','invite','invite_claimed','invite_cancelled',
    'recruiter_verified','recruiter_unverified',
    'recruiter_suspended','recruiter_reinstated',
    'site_builder_unlocked','site_builder_locked',
    'job_deleted','jobs_synced','submission_status_changed','profile_reminder_sent',
    'email_sent','broadcast_sent'
  ) NOT NULL,
  actor_uid    VARCHAR(128) NULL,
  actor_name   VARCHAR(255) NOT NULL DEFAULT '',
  actor_email  VARCHAR(320) NOT NULL DEFAULT '',
  target_uid   VARCHAR(128) NULL,
  target_name  VARCHAR(255) NOT NULL DEFAULT '',
  target_email VARCHAR(320) NOT NULL DEFAULT '',
  -- Short free-text context that doesn't fit actor/target, e.g. a status
  -- change ("client_review → hired") or a job's submission count on delete.
  details      VARCHAR(500) NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_admin_audit_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------- files

-- Uploaded bytes: candidate CVs, recruiter avatars, and recruiter
-- verification videos.
--
-- MEDIUMBLOB holds 16 MB, comfortably above the 10 MB CV cap. The server's
-- max_allowed_packet is 1000 MB, so the wire protocol is not a constraint
-- either. LONGBLOB would allow 4 GB rows and only invites trouble on a shared
-- host with a 4 GB account-wide quota. (Videos are capped much lower than
-- that at the application layer — see MAX_VIDEO_BYTES in lib/server/files.ts,
-- driven by Vercel's request-body limit, not this column.)
--
-- IDs are UUIDs rather than sequential: a file's URL should not be guessable
-- by counting. CV and video downloads additionally require a signed URL (see
-- lib/server/files.ts) — the UUID alone is not treated as the secret.
CREATE TABLE files (
  id           CHAR(36)     NOT NULL,
  kind         ENUM('cv','avatar','video') NOT NULL,
  filename     VARCHAR(255) NOT NULL DEFAULT '',
  content_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
  byte_size    INT UNSIGNED NOT NULL DEFAULT 0,
  data         MEDIUMBLOB   NOT NULL,
  -- Uploader, when known. NULL for a public applicant's CV.
  owner_uid    VARCHAR(128) NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_files_owner (owner_uid),
  KEY idx_files_kind_created (kind, created_at),
  CONSTRAINT fk_files_owner FOREIGN KEY (owner_uid)
    REFERENCES users (uid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Deferred from the `users` table above: it references files.id, but users is
-- created first and can't forward-reference a table that doesn't exist yet.
ALTER TABLE users
  ADD CONSTRAINT fk_users_verification_video FOREIGN KEY (verification_video_id)
    REFERENCES files (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- jobs

CREATE TABLE jobs (
  id               VARCHAR(64)  NOT NULL,   -- preserved Firestore doc ID
  title            VARCHAR(255) NOT NULL,
  company          VARCHAR(255) NOT NULL DEFAULT '',
  category         VARCHAR(128) NOT NULL DEFAULT 'Other',
  location         VARCHAR(255) NOT NULL DEFAULT '',
  remote           BOOLEAN      NOT NULL DEFAULT FALSE,
  employment_type  ENUM('Full-time','Part-time','Contract','Temporary','Internship')
                                NOT NULL DEFAULT 'Full-time',
  salary_min       INT UNSIGNED NULL,
  salary_max       INT UNSIGNED NULL,
  bounty           INT UNSIGNED NULL,       -- recruiter referral commission
  -- Recruiter-facing fee tier (see lib/feeTiers.ts). NULL means this job
  -- predates the tier system and shows no fee badge until an admin sets one
  -- — existing jobs are deliberately left alone, not auto-migrated.
  fee_tier         ENUM('standard','general','professional','specialized') NULL,
  description      MEDIUMTEXT,              -- the "Job Brief"
  responsibilities MEDIUMTEXT,
  requirements     MEDIUMTEXT,

  -- Ordered lists edited as a single unit in the admin wizard, never queried
  -- by element. JSON keeps them one row instead of three child tables.
  faqs                JSON,                 -- [{ question, answer }]
  screening_questions JSON,                 -- [string]
  hiring_stages       JSON,                 -- [string]

  status     ENUM('draft','open','closed') NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                         ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- The public board's only query: open roles, newest first.
  KEY idx_jobs_status_created (status, created_at DESC),
  KEY idx_jobs_category (category),
  -- Powers the ?q= search without a full scan once the board grows.
  FULLTEXT KEY ft_jobs_search (title, company, category, location, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------- submissions

-- A recruiter's referred candidate. job_title/company/bounty are deliberately
-- denormalised: they are a snapshot of the role as it stood at submission, and
-- must not change if the job is later edited. That is what the commission and
-- any dispute are settled against.
CREATE TABLE submissions (
  id              VARCHAR(64)  NOT NULL,
  job_id          VARCHAR(64)  NOT NULL,
  job_title       VARCHAR(255) NOT NULL DEFAULT '',
  company         VARCHAR(255) NOT NULL DEFAULT '',
  -- NULL for an open/public application. firestore.rules allows submissions
  -- with no login ("recruiterId: recruiter?.uid ?? ''"), so this cannot be
  -- NOT NULL or every public applicant would be rejected by the FK.
  recruiter_id    VARCHAR(128) NULL,
  recruiter_name  VARCHAR(255) NOT NULL DEFAULT 'Public applicant',
  candidate_name  VARCHAR(255) NOT NULL DEFAULT '',
  candidate_email VARCHAR(320) NOT NULL DEFAULT '',
  candidate_phone VARCHAR(64)  NOT NULL DEFAULT '',
  -- Both optional — a recruiter can submit without either. photo_url is a
  -- plain (unsigned) link, same as users.photo_url: a candidate photo isn't
  -- sensitive the way a CV is, and it needs to work in a plain <img> tag.
  candidate_linkedin VARCHAR(512)  NOT NULL DEFAULT '',
  candidate_photo_url VARCHAR(1024) NOT NULL DEFAULT '',
  -- Right to work in the US. Codes from lib/workAuthorization.ts. '' means
  -- the submission predates this field, which is NOT the same as the
  -- candidate declining to answer ('prefer_not_to_say').
  work_authorization VARCHAR(48) NOT NULL DEFAULT '',
  notes           MEDIUMTEXT,
  -- The CV itself lives in `files`. RESTRICT, not CASCADE: deleting a CV row
  -- out from under a live submission would silently destroy the only copy of
  -- the candidate's document.
  cv_file_id      CHAR(36)     NULL,
  bounty          INT UNSIGNED NULL,
  -- Snapshotted from jobs.fee_tier at submission time, same reasoning as
  -- bounty above: what the recruiter earns must not change if the job's
  -- tier is edited later. This is what the recruiter dashboard/earnings are
  -- computed from — bounty is the client-facing figure and must never be.
  fee_tier        ENUM('standard','general','professional','specialized') NULL,
  status          ENUM('submitted','screening','approved','client_review','hired','rejected')
                               NOT NULL DEFAULT 'submitted',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                               ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_subs_recruiter (recruiter_id, created_at DESC),
  KEY idx_subs_job (job_id),
  KEY idx_subs_status (status),

  -- Referral ownership is currently only a timestamp, with nothing preventing
  -- the same candidate being submitted twice for one role (see the recruiter
  -- FAQ wording). This makes first-submission-wins an actual database rule.
  -- Drop it if you'd rather keep resolving duplicates by hand.
  UNIQUE KEY uq_subs_job_candidate (job_id, candidate_email),

  CONSTRAINT fk_subs_job FOREIGN KEY (job_id)
    REFERENCES jobs (id) ON DELETE CASCADE,
  -- SET NULL, not RESTRICT: deleting a recruiter must not be blocked by, or
  -- destroy, the submission history the commission is settled against.
  CONSTRAINT fk_subs_recruiter FOREIGN KEY (recruiter_id)
    REFERENCES users (uid) ON DELETE SET NULL,
  CONSTRAINT fk_subs_cv FOREIGN KEY (cv_file_id)
    REFERENCES files (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------- candidates

-- A recruiter's own pipeline: candidates saved ahead of any specific role, so
-- applying to a job later is a pick from this list rather than retyping name/
-- email/phone/CV every time. Distinct from `submissions`, which is a referral
-- already sent to a job — a candidate can be saved here without ever being
-- submitted anywhere, and can be quick-applied to any number of open roles.
CREATE TABLE candidates (
  id           VARCHAR(64)  NOT NULL,
  recruiter_id VARCHAR(128) NOT NULL,
  name         VARCHAR(255) NOT NULL DEFAULT '',
  email        VARCHAR(320) NOT NULL DEFAULT '',
  phone        VARCHAR(64)  NOT NULL DEFAULT '',
  -- Both optional. photo_url is a plain (unsigned) link, same as
  -- users.photo_url — a candidate photo isn't sensitive the way a CV is.
  linkedin     VARCHAR(512)  NOT NULL DEFAULT '',
  photo_url    VARCHAR(1024) NOT NULL DEFAULT '',
  notes        MEDIUMTEXT,
  -- Optional: a candidate can be saved before a CV is on hand. Required only
  -- at the point of actually applying — POST /api/submissions with a
  -- candidateId refuses to quick-apply one that has none. RESTRICT, same
  -- reasoning as fk_subs_cv: never silently destroy the only copy on file.
  cv_file_id   CHAR(36)     NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                            ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_candidates_recruiter (recruiter_id, created_at DESC),
  -- One pool entry per email per recruiter — re-saving the same candidate
  -- updates them instead of silently forking into a duplicate row.
  UNIQUE KEY uq_candidates_recruiter_email (recruiter_id, email),
  -- CASCADE, unlike fk_subs_recruiter's SET NULL: this pool has no standalone
  -- meaning once its owner is gone — nothing is settled against it the way a
  -- submission's commission is.
  CONSTRAINT fk_candidates_recruiter FOREIGN KEY (recruiter_id)
    REFERENCES users (uid) ON DELETE CASCADE,
  CONSTRAINT fk_candidates_cv FOREIGN KEY (cv_file_id)
    REFERENCES files (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------ recruiter_sites

-- The free one-page recruiter website (see career-site perk). One row per
-- recruiter — gated by users.site_builder_enabled, which an admin sets. Name,
-- photo, phone/email and social links are NOT duplicated here: the public
-- page reads those straight off `users` so a profile edit is reflected on the
-- site automatically. This table only holds the site-specific extras and the
-- template/theme/publish state.
CREATE TABLE recruiter_sites (
  recruiter_id VARCHAR(128) NOT NULL,
  -- The public URL is /sites/{slug}. Chosen by the recruiter, so it needs its
  -- own uniqueness constraint independent of recruiter_id.
  slug         VARCHAR(64)  NOT NULL,
  template     VARCHAR(32)  NOT NULL DEFAULT 'classic',
  theme        VARCHAR(32)  NOT NULL DEFAULT 'navy',
  -- Optional punchier subhead for the site; the page falls back to
  -- users.headline when this is blank.
  tagline      VARCHAR(255) NOT NULL DEFAULT '',
  -- Optional "about" paragraph for the site; falls back to users.bio.
  intro        MEDIUMTEXT,
  specialisms  JSON,                 -- [string]
  highlights   JSON,                 -- [string] — short track-record bullets
  -- Hero stat row, e.g. { value: "8+", label: "Years recruiting" }.
  stats        JSON,                 -- [{ value, label }]
  -- Animated skill bars, e.g. { skill: "DOT Recruiting", percent: 90 }.
  expertise    JSON,                 -- [{ skill, percent }]
  -- Work history timeline, most recent first.
  experience   JSON,                 -- [{ role, company, period, current, bullets: [string] }]
  cta_label    VARCHAR(64)  NOT NULL DEFAULT '',
  cta_url      VARCHAR(512) NOT NULL DEFAULT '',
  -- Optional override for the contact section's heading; falls back to
  -- "Get in touch" when blank.
  contact_heading VARCHAR(60)   NOT NULL DEFAULT '',
  -- Optional short blurb shown above the email/phone in the contact section.
  contact_message VARCHAR(300)  NOT NULL DEFAULT '',
  -- Optional custom line shown in the footer, alongside (not replacing) the
  -- "Site by JobFolder" attribution — e.g. a copyright or closing tagline.
  footer_note     VARCHAR(160)  NOT NULL DEFAULT '',
  -- A recruiter can draft and preview before the page is publicly reachable.
  published    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                            ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (recruiter_id),
  UNIQUE KEY uq_recruiter_sites_slug (slug),
  CONSTRAINT fk_recruiter_sites_recruiter FOREIGN KEY (recruiter_id)
    REFERENCES users (uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------- messages

-- Public contact-form enquiries. No FK: senders are anonymous visitors.
-- Messages shown inside a recruiter's dashboard. Email leaves the product:
-- it bounces, goes to spam, or is deleted, and nobody can tell afterwards
-- whether it was read. These sit where the recruiter already signs in.
CREATE TABLE notifications (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_uid VARCHAR(128) NOT NULL,
  title         VARCHAR(200)  NOT NULL,
  body          MEDIUMTEXT    NOT NULL,
  -- Optional in-app destination, e.g. /dashboard/jobs. Relative paths only;
  -- the UI refuses anything else rather than turning a notification into an
  -- open redirect.
  link          VARCHAR(512)  NOT NULL DEFAULT '',
  -- 'admin' today; system-generated alerts get their own values later.
  -- Deliberately VARCHAR, not ENUM: adding an ENUM value needs a migration
  -- under STRICT_ALL_TABLES, and forgetting one surfaces as a 500 on an
  -- action that already half-succeeded.
  source        VARCHAR(32)   NOT NULL DEFAULT 'admin',
  -- Snapshotted, with no foreign key: admins live in `admins`, not `users`,
  -- so a constraint pointing at users(uid) would reject every notification
  -- an admin sends.
  author_name   VARCHAR(255)  NOT NULL DEFAULT '',
  read_at       DATETIME(3)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- Covers both reads: the unread count, and the recipient's list.
  KEY idx_notifications_recipient (recipient_uid, read_at, created_at DESC),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_uid)
    REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Enquiries sent from a recruiter's public microsite at /sites/[slug].
-- Distinct from `messages` (the jobfolder.com contact form): a site lead
-- belongs to one recruiter, and both they and an admin can see it. Before
-- this table the microsite's contact section was a mailto: link, so an
-- enquiry left no record with anyone.
CREATE TABLE site_leads (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recruiter_id VARCHAR(128) NOT NULL,
  name         VARCHAR(255) NOT NULL DEFAULT '',
  email        VARCHAR(320) NOT NULL DEFAULT '',
  phone        VARCHAR(64)  NOT NULL DEFAULT '',
  message      MEDIUMTEXT,
  -- Sender's IP, best-effort from the platform's forwarded-for header. Only
  -- used server-side, to rate-limit repeat posts — never shown to anyone.
  ip           VARCHAR(64)  NULL,
  handled      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_site_leads_recruiter (recruiter_id, created_at DESC),
  KEY idx_site_leads_created (created_at DESC),
  KEY idx_site_leads_ip_created (ip, created_at),
  -- A lead belongs to the recruiter whose site captured it; there is no other
  -- party it could sensibly belong to, so it goes when the account does.
  CONSTRAINT fk_site_leads_recruiter FOREIGN KEY (recruiter_id)
    REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE messages (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL DEFAULT '',
  email      VARCHAR(320) NOT NULL DEFAULT '',
  -- Who sent it, when they were signed in. The form is public, so this is
  -- usually NULL; when set, the sender can follow the thread and read our
  -- reply at /dashboard/enquiries. SET NULL on delete: closing an account
  -- shouldn't discard an enquiry we may still owe someone an answer to.
  sender_uid VARCHAR(128) NULL,
  subject    VARCHAR(255) NOT NULL DEFAULT '',
  message    MEDIUMTEXT,
  -- Sender's IP, best-effort from the platform's forwarded-for header. Only
  -- used server-side, to rate-limit repeat posts — never shown to anyone.
  ip         VARCHAR(64)  NULL,
  handled    BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Parked, not deleted. A thread nobody should be looking at right now
  -- leaves both working lists but keeps every reply on it, and wakes by
  -- itself when the sender writes back (see addInboundReply). Separate from
  -- `handled` because the two answer different questions: "have we replied?"
  -- and "are we looking at this now?" — a thread can be both.
  sleeping   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_messages_created (created_at DESC),
  KEY idx_messages_sender (sender_uid, created_at DESC),
  KEY idx_messages_ip_created (ip, created_at)
  -- Deliberately NOT a foreign key to users(uid): `admins` and `users` are
  -- separate tables, so a signed-in admin (or a brand-new account whose
  -- profile row hasn't been created yet) has no matching row, and the
  -- constraint would reject a perfectly valid contact-form submission. A uid
  -- that resolves to nothing just matches no rows when scoping someone's own
  -- enquiries. Same reasoning as admin_audit_log.actor_uid.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- What an admin wrote back on an enquiry. Replying used to be a mailto:
-- link, so the answer left no trace: a second admin couldn't tell whether a
-- lead had been dealt with or what was said, and the sender had nowhere to
-- read it.
CREATE TABLE message_replies (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id  BIGINT UNSIGNED NOT NULL,
  -- Name and email are snapshotted alongside the uid so the thread still
  -- reads correctly after that admin's account is gone.
  -- Traceability only, with no foreign key: an admin need not be a
  -- recruiter, so this uid often has no row in `users`. That is exactly why
  -- name and email are snapshotted below — the thread has to read correctly
  -- whether or not the uid still resolves to anyone.
  admin_uid   VARCHAR(128) NULL,
  admin_name  VARCHAR(255) NOT NULL DEFAULT '',
  admin_email VARCHAR(320) NOT NULL DEFAULT '',
  body        MEDIUMTEXT   NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_message_replies_message (message_id, created_at),
  CONSTRAINT fk_replies_message FOREIGN KEY (message_id)
    REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------ submission_messages

-- A conversation thread attached to one candidate submission — the natural
-- anchor, since every message a recruiter or JobFolder staff would send is
-- "about this candidate for this role." JobFolder has no employer accounts
-- yet, so the only two parties who can ever message are the referring
-- recruiter and JobFolder admin — there is no general inbox.
CREATE TABLE submission_messages (
  id            CHAR(36)     NOT NULL,
  submission_id VARCHAR(64)  NOT NULL,
  sender_role   ENUM('recruiter','admin') NOT NULL,
  -- The recruiter's uid when sender_role = 'recruiter'. NULL for admin: any
  -- admin may reply on JobFolder's behalf, and the thread is not any one
  -- admin's individually.
  sender_uid    VARCHAR(128) NULL,
  sender_name   VARCHAR(255) NOT NULL DEFAULT '',
  body          MEDIUMTEXT   NOT NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sub_msgs_submission (submission_id, created_at),
  CONSTRAINT fk_sub_msgs_submission FOREIGN KEY (submission_id)
    REFERENCES submissions (id) ON DELETE CASCADE,
  -- SET NULL, not RESTRICT: deleting a recruiter must not destroy or block
  -- deletion of a message they sent while their account existed.
  CONSTRAINT fk_sub_msgs_sender FOREIGN KEY (sender_uid)
    REFERENCES users (uid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------- settings

-- Replaces `settings/jobCategories`. Key/value so future admin-editable
-- settings don't each need a migration.
CREATE TABLE settings (
  setting_key VARCHAR(64) NOT NULL,
  value       JSON        NOT NULL,
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                          ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed: the JOB_CATEGORIES fallback from lib/jobs.ts.
INSERT INTO settings (setting_key, value) VALUES (
  'jobCategories',
  JSON_ARRAY(
    'Civil Engineering','Transportation / DOT','Structural Engineering',
    'MEP Engineering','Electrical Engineering','Mechanical Engineering',
    'Water / Hydrology','CEI / Inspection','Project Management',
    'Architecture (AEC)','Software Engineering','AWS / DevOps',
    'Data Science','Information Technology','Government / Cleared',
    'DOD / Intelligence','Finance','Automotive','Electronics',
    'Executive','Other'
  )
);
