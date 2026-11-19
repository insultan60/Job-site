"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { listOpenJobs } from "@/lib/jobs";
import { listMyNotifications } from "@/lib/notifications";
import { profileCompletion } from "@/lib/profileCompletion";
import { getMySite, type RecruiterSite } from "@/lib/recruiterSite";

const topNav = { label: "Overview", href: "/dashboard", icon: "M4 9l6-5 6 5v7H4z" };

const navGroups = [
  {
    label: "Recruiting",
    items: [
      { label: "Browse jobs", href: "/dashboard/jobs", icon: "M3 5h14M3 10h14M3 15h9" },
      {
        label: "Candidates",
        href: "/dashboard/submissions",
        icon: "M6 3h6l4 4v10H6zM12 3v4h4",
      },
      {
        label: "Inquiries",
        href: "/dashboard/leads",
        icon: "M3 5h14v10H3zM3 5l7 5 7-5",
      },
      {
        label: "Career site",
        href: "/dashboard/career-site",
        icon: "M10 2a8 8 0 100 16 8 8 0 000-16zM2 10h16M10 2c2 2.2 3 5 3 8s-1 5.8-3 8c-2-2.2-3-5-3-8s1-5.8 3-8z",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        label: "Reports",
        href: "/dashboard/reports",
        icon: "M4 15V9M10 15V5M16 15v-3",
      },
      {
        label: "My profile",
        href: "/dashboard/profile",
        icon: "M10 10a3 3 0 100-6 3 3 0 000 6zM4 17a6 6 0 0112 0z",
      },
      {
        label: "Alerts",
        href: "/dashboard/notifications",
        icon: "M10 3a4 4 0 00-4 4v3l-1.5 2.5h11L14 10V7a4 4 0 00-4-4zM8.5 16a1.5 1.5 0 003 0",
      },
      {
        label: "My inquiries",
        href: "/dashboard/enquiries",
        icon: "M3 5h14v10H3zM3 5l7 5 7-5",
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: "M10 13a3 3 0 100-6 3 3 0 000 6zM10 2v2M10 16v2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M2 10h2M16 10h2M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4",
      },
    ],
  },
];

const nav = navGroups.flatMap((g) => g.items);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, logout } = useAuth();

  /* How many roles are open right now, for the "Browse jobs" badge. Null until
     it's known — a badge reading "0" while still loading would tell recruiters
     there's no work, which is the one wrong thing it could say. */
  const [openJobs, setOpenJobs] = useState<number | null>(null);
  const [mySite, setMySite] = useState<RecruiterSite | null>(null);
  /* Unread alerts. An alert nobody notices is just a row in a table, so the
     count is the whole point of having sent one. */
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    let active = true;
    listOpenJobs()
      .then((jobs) => active && setOpenJobs(jobs.length))
      .catch(() => {}); // a missing badge is fine; a broken sidebar is not
    listMyNotifications()
      .then((feed) => active && setUnreadAlerts(feed.unread))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Only fetched once the perk is unlocked — powers the "View live site" link
  // under the Career site nav item once something's actually published.
  useEffect(() => {
    if (!profile?.siteBuilderEnabled) return;
    let active = true;
    getMySite()
      .then((site) => active && setMySite(site))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [profile?.siteBuilderEnabled]);

  const completion = profileCompletion(profile);

  function badgeFor(href: string): string | null {
    if (href === "/dashboard/jobs") return openJobs === null ? null : String(openJobs);
    if (href === "/dashboard/notifications") return unreadAlerts ? String(unreadAlerts) : null;
    if (href === "/dashboard/profile" && !completion.isComplete)
      return `${completion.percent}%`;
    return null;
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  async function signOut() {
    await logout();
    router.replace("/");
  }

  const initial = (profile?.name || user?.email || "R").charAt(0).toUpperCase();
  const allNavItems = [topNav, ...nav];

  return (
    <div className="flex min-h-screen bg-cream/40">
      {/* sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-blue-brand-dark px-4 py-6 md:flex">
        <div className="px-2">
          <Logo variant="onDark" />
        </div>

        <nav className="mt-8 space-y-1">
          <SidebarLink item={topNav} active={isActive(topNav.href)} badge={badgeFor(topNav.href)} />
        </nav>

        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-wider text-white/40">
              {group.label}
            </p>
            <nav className="space-y-1">
              {group.items.map((item) => (
                <div key={item.href}>
                  <SidebarLink item={item} active={isActive(item.href)} badge={badgeFor(item.href)} />
                  {item.href === "/dashboard/career-site" && mySite?.published && (
                    <a
                      href={`/sites/${mySite.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex items-center gap-1 px-3 py-1 pl-9 text-[11px] font-medium text-white/50 hover:text-lime"
                    >
                      View live site
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M7 13L13 7M13 7H8M13 7v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </nav>
          </div>
        ))}

        <div className="mt-6 rounded-2xl bg-white/6 p-3.5">
          <p className="text-xs font-bold text-white">Need help?</p>
          <p className="mt-1 text-[11px] leading-5 text-white/60">
            Questions about a referral or your fee? We&apos;re here.
          </p>
          <Link
            href="/contact"
            className="mt-2.5 block rounded-pill bg-lime px-3 py-1.5 text-center text-[11px] font-bold text-blue-brand-dark hover:bg-white"
          >
            Contact us
          </Link>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-4">
          {profile?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoURL}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime text-xs font-bold text-blue-brand-dark">
              {initial}
            </span>
          )}
          <p className="min-w-0 flex-1 truncate text-[11px] text-white/60">{user?.email}</p>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M8 4H4v12h4M13 13l3-3-3-3M16 10H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="flex h-16 items-center justify-between border-b border-line bg-white px-5 md:hidden">
          <Logo />
          <button
            type="button"
            onClick={signOut}
            className="text-xs font-semibold text-muted"
          >
            Sign out
          </button>
        </header>
        {/* mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-line bg-white px-4 py-2 md:hidden">
          {allNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                isActive(item.href)
                  ? "bg-primary-soft text-primary"
                  : "text-muted"
              }`}
            >
              {item.label}
              {badgeFor(item.href) && (
                <span
                  className={`rounded-pill px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                    item.href === "/dashboard/profile"
                      ? "bg-coral-soft text-coral"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  {badgeFor(item.href)}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* desktop search bar */}
        <header className="hidden h-16 shrink-0 items-center gap-4 border-b border-line bg-white px-6 md:flex lg:px-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              router.push(`/dashboard/jobs${q ? `?q=${encodeURIComponent(String(q))}` : ""}`);
            }}
            className="relative max-w-sm flex-1"
          >
            <input
              name="q"
              className="input h-9 pl-9 text-xs"
              placeholder="Search open jobs…"
            />
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
              <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </form>
          <Link
            href="/dashboard/profile"
            className="ml-auto flex items-center gap-2 rounded-full hover:opacity-80"
            title="My profile"
          >
            {profile?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoURL}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                {initial}
              </span>
            )}
          </Link>
        </header>

        <main className="flex-1 p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  badge,
}: {
  item: { label: string; href: string; icon: string };
  active: boolean;
  badge: string | null;
}) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-white text-blue-brand-dark"
          : "text-white/70 hover:bg-white/8 hover:text-white"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d={item.icon}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {item.label}
      {badge && (
        <span
          className={`ml-auto rounded-pill px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
            active ? "bg-blue-brand-soft text-primary" : "bg-lime text-blue-brand-dark"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
