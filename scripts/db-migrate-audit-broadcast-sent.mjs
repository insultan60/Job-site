/* Adds 'broadcast_sent' to admin_audit_log.action.
 *
 *   node --env-file=.env.local scripts/db-migrate-audit-broadcast-sent.mjs
 *
 * Additive and idempotent. Run it BEFORE deploying the broadcast composer:
 * the action column is an ENUM under STRICT_ALL_TABLES, so an unlisted value
 * is rejected at insert time — and the audit write happens after the mail has
 * already gone out, so without this the console reports a 500 on a broadcast
 * that actually reached everybody. (Exactly what happened with 'jobs_synced'
 * and again with 'email_sent'.)
 */

import mysql from "mysql2/promise";

const NEW_TYPE = `ENUM(
  'grant','revoke','invite','invite_claimed','invite_cancelled',
  'recruiter_verified','recruiter_unverified','recruiter_suspended',
  'recruiter_reinstated','site_builder_unlocked','site_builder_locked',
  'job_deleted','jobs_synced','submission_status_changed',
  'profile_reminder_sent','email_sent','broadcast_sent'
) NOT NULL`;

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  connectTimeout: 15_000,
  ...(process.env.MYSQL_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
});

try {
  /* Aliased: information_schema returns COLUMN_TYPE uppercase, so reading
     row.column_type gives undefined and the ALTER re-runs every time. */
  const [[row]] = await conn.query(
    `SELECT column_type AS col_type FROM information_schema.columns
      WHERE table_schema = ? AND table_name = 'admin_audit_log' AND column_name = 'action'`,
    [process.env.MYSQL_DATABASE],
  );
  if (!row) {
    console.log("admin_audit_log.action — no such column?");
  } else if (row.col_type.includes("'broadcast_sent'")) {
    console.log("admin_audit_log.action — already has 'broadcast_sent'");
  } else {
    await conn.query(`ALTER TABLE admin_audit_log MODIFY COLUMN action ${NEW_TYPE}`);
    console.log("admin_audit_log.action — added 'broadcast_sent'");
  }
} finally {
  await conn.end();
}
