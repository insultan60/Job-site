"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { adminRoutes } from "@/lib/routes";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageLoader } from "@/components/Loader";

export default function DashboardGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const {
    user, loading, profile, profileLoading, profileError, refreshProfile,
    logout, emailVerified, resendVerificationEmail, checkEmailVerified,
    isAdmin,
  } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  /* An admin with no recruiter profile has nothing on this page - the branch
     below would tell them they have no account and offer to register one,
     which is the wrong answer for someone who signed in to administer the
     site. Send them where their account actually works. An account that is
     both admin and recruiter has a profile, so it never reaches this and
     keeps its dashboard. */
  const adminWithoutRecruiterProfile =
    !loading && !profileLoading && !!user && isAdmin && !profile && !profileError;

  useEffect(() => {
    if (adminWithoutRecruiterProfile) router.replace(adminRoutes.base);
  }, [adminWithoutRecruiterProfile, router]);

  /* Sign out before sending them to /signup or /login. Both pages bounce a
     signed-in visitor straight back here, so without this the buttons below
     would look like they do nothing. */
  async function goSignedOut(path: string) {
    await logout();
    router.replace(path);
  }
  const registerNewAccount = () => goSignedOut("/signup");
  const switchAccount = () => goSignedOut("/login");

  if (loading || !user || profileLoading) return <PageLoader />;
  if (adminWithoutRecruiterProfile) return <PageLoader />;

  /* Signed in, but hasn't clicked the link in their verification email yet.
     Enforced here for the dashboard UI; POST /api/submissions enforces the
     same rule server-side, since a client-only gate is just presentation.

     Admins are exempt, and have to be. The gate exists to stop an unverified
     recruiter submitting candidates, which is not what an admin account is
     for, and admin logins are routinely on addresses that cannot receive a
     verification email at all - so for them this screen is not a step, it is
     a locked door with no key. isAdmin is a server-side lookup arriving from
     /api/me, not a claim the browser can make for itself, so exempting on it
     does not weaken the rule it enforces. */
  if (!emailVerified && !isAdmin) {
    return (
      <VerifyEmailScreen
        email={user.email}
        onResend={resendVerificationEmail}
        onRecheck={checkEmailVerified}
        onSwitchAccount={switchAccount}
      />
    );
  }

  /* The profile load failed rather than came back empty. Say so, and offer a
     retry — telling someone their account doesn't exist because the server
     hiccuped is both wrong and alarming. */
  if (profileError) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center">
          <h1 className="font-bold text-ink">Couldn&apos;t load your account</h1>
          <p className="mt-1 text-sm text-muted">
            You&apos;re still signed in as {user.email} — we just couldn&apos;t
            reach the server. Your account and submissions are safe.
          </p>
          <button
            type="button"
            onClick={() => refreshProfile()}
            className="mt-5 w-full rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Try again
          </button>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-muted hover:text-ink"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  /* Signed in, but this account has no recruiter profile. GET /api/me now
     creates one for any ordinary login, so in practice this is an admin-only
     account — which is a normal thing to be, not an error. Give it somewhere
     to go instead of a dead end. */
  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" />
            </svg>
          </div>
          <h1 className="mt-4 font-bold text-ink">
            No recruiter account on this login
          </h1>
          <p className="mt-1 text-sm text-muted">
            {user.email} is signed in, but it isn&apos;t set up as a recruiter
            account — so there&apos;s no dashboard to show. Recruiter accounts
            are free, and you can register one in under a minute.
          </p>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={registerNewAccount}
              className="block w-full rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Register a recruiter account
            </button>
            <button
              type="button"
              onClick={switchAccount}
              className="block w-full rounded-pill border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
            >
              Sign in with a different account
            </button>
          </div>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-muted hover:text-ink"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  /* Admin-suspended account. Enforced here for the dashboard UI; every write
     route (submissions, saved candidates, messages, file uploads) enforces
     the same rule server-side via requireActiveUid()/requireVerifiedUid() in
     lib/server/auth.ts, since a client-only gate is just presentation. They
     can still see their dashboard read-only rather than being logged out —
     less confusing than a dead end, and lets them read any admin message
     already on a submission thread. */
  if (profile.suspended) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-coral-soft text-coral">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M4.9 4.9l14.2 14.2" />
            </svg>
          </div>
          <h1 className="mt-4 font-bold text-ink">Account suspended</h1>
          <p className="mt-1 text-sm text-muted">
            Your account has been suspended. You can&apos;t submit candidates,
            save candidates, send messages, or upload files right now. Contact
            us if you believe this is a mistake.
          </p>
          <button
            type="button"
            onClick={switchAccount}
            className="mt-5 block w-full rounded-pill border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
          >
            Sign in with a different account
          </button>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-muted hover:text-ink"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}

function VerifyEmailScreen({
  email,
  onResend,
  onRecheck,
  onSwitchAccount,
}: {
  email: string | null;
  onResend: () => Promise<void>;
  onRecheck: () => Promise<boolean>;
  onSwitchAccount: () => void;
}) {
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);

  async function handleResend() {
    setResendState("sending");
    try {
      await onResend();
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  }

  async function handleRecheck() {
    setChecking(true);
    setNotYet(false);
    try {
      const verified = await onRecheck();
      if (!verified) setNotYet(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-white px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
        <h1 className="mt-4 font-bold text-ink">Verify your email</h1>
        <p className="mt-1 text-sm text-muted">
          We sent a verification link to{" "}
          <span className="font-semibold text-ink">{email ?? "your email"}</span>.
          Click it, then come back here and continue.
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={handleRecheck}
            disabled={checking}
            className="block w-full rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {checking ? "Checking…" : "I've verified — continue"}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendState === "sending"}
            className="block w-full rounded-pill border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {resendState === "sending" ? "Sending…" : "Resend verification email"}
          </button>
        </div>

        {notYet && (
          <p className="mt-3 rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
            Still not verified. Check your inbox (and spam folder) for the link.
          </p>
        )}
        {resendState === "sent" && (
          <p className="mt-3 rounded-lg bg-sage-soft px-3 py-2 text-sm text-ink">
            Verification email sent — check your inbox.
          </p>
        )}
        {resendState === "error" && (
          <p className="mt-3 rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
            Couldn&apos;t send that right now. Try again shortly.
          </p>
        )}

        <button
          type="button"
          onClick={onSwitchAccount}
          className="mt-4 block w-full text-sm font-semibold text-muted hover:text-ink"
        >
          Sign in with a different account
        </button>
      </div>
    </div>
  );
}
