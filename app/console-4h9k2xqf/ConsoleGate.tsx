"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { adminRoutes } from "@/lib/routes";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageLoader } from "@/components/Loader";

function Gate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  /* isAdmin now arrives with the profile from /api/me — no separate lookup.
     This gate is convenience only: it hides the UI. The actual enforcement is
     requireAdmin() on every /api/admin route, which a client cannot bypass. */
  const { user, loading, isAdmin, profileLoading, profileError, profileErrorMessage, refreshProfile } =
    useAuth();

  // Login + the temporary setup page render on their own (no admin gate).
  const isPublic =
    pathname === adminRoutes.login || pathname === adminRoutes.setup;

  const resolving = loading || (Boolean(user) && profileLoading);

  // Route people who shouldn't be here away.
  useEffect(() => {
    if (resolving || isPublic) return;
    if (!user) router.replace(adminRoutes.login);
    /* Only redirect on a definitive "not an admin". When the check itself
       failed we don't know either way, and throwing the admin back to the
       login screen on a momentary database blip is what made the console feel
       like it kept signing people out. */
    else if (!isAdmin && !profileError) router.replace("/");
  }, [resolving, user, isAdmin, profileError, isPublic, router]);

  // Login + setup pages render on their own, without the admin chrome.
  if (isPublic) return <>{children}</>;

  /* Still signed in — the session is fine, we just couldn't confirm the role. */
  if (user && profileError) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center">
          <h1 className="font-bold text-ink">Couldn&apos;t load the console</h1>
          <p className="mt-1 text-sm text-muted">
            You&apos;re still signed in as {user.email}, but we couldn&apos;t
            confirm your access.
          </p>
          {/* The reason, verbatim from the server. This screen used to say
              "this is usually temporary" whatever had happened, so a refused
              request and a real outage looked identical and the only offer
              was a retry that could never work for the first of those. */}
          {profileErrorMessage && (
            <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-left text-xs text-muted">
              {profileErrorMessage}
            </p>
          )}
          <button
            type="button"
            onClick={() => refreshProfile()}
            className="mt-5 w-full rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (resolving || !user || !isAdmin) {
    return <PageLoader />;
  }

  return <AdminShell>{children}</AdminShell>;
}

export default function ConsoleGate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Gate>{children}</Gate>;
}
