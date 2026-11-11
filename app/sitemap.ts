import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { howSteps } from "@/lib/howItWorks";
import { guides } from "@/lib/hiringGuides";
import { jobMarkets } from "@/lib/jobMarkets";
import { jobStates } from "@/lib/jobStates";
import { listOpenJobs } from "@/lib/server/repo";
import { categoryFacets } from "@/lib/jobTaxonomy";

/* Regenerate hourly so newly posted roles reach the sitemap without a redeploy. */
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

const staticRoutes: { path: string; priority: number; freq: Entry["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, freq: "weekly" },
  { path: "/jobs", priority: 0.9, freq: "daily" },
  { path: "/jobs/category", priority: 0.8, freq: "daily" },
  { path: "/jobs/state", priority: 0.8, freq: "daily" },
  { path: "/jobs/city", priority: 0.8, freq: "weekly" },
  { path: "/how-it-works", priority: 0.8, freq: "monthly" },
  { path: "/recruiters", priority: 0.8, freq: "monthly" },
  { path: "/hiring-guides", priority: 0.7, freq: "monthly" },
  { path: "/case-studies", priority: 0.7, freq: "monthly" },
  { path: "/recruiter-faq", priority: 0.7, freq: "monthly" },
  { path: "/contact", priority: 0.6, freq: "yearly" },
  { path: "/careers", priority: 0.4, freq: "monthly" },
  { path: "/press", priority: 0.4, freq: "yearly" },
  { path: "/privacy", priority: 0.2, freq: "yearly" },
  { path: "/terms", priority: 0.2, freq: "yearly" },
  { path: "/cookie-policy", priority: 0.2, freq: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));

  for (const step of howSteps) {
    entries.push({
      url: `${SITE_URL}/how-it-works/${step.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const guide of guides) {
    entries.push({
      url: `${SITE_URL}/hiring-guides/${guide.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  for (const market of jobMarkets) {
    entries.push({
      url: `${SITE_URL}/jobs/city/${market.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.65,
    });
  }

  for (const state of jobStates) {
    entries.push({
      url: `${SITE_URL}/jobs/state/${state.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  /* Open roles are the highest-churn URLs on the site, and the landing pages
     are derived from the same read. A database outage must never fail the
     build, so the whole block is best-effort: static routes alone still make
     a valid sitemap.

     Read straight from the repo rather than through /api/jobs — a sitemap
     generated at build time can't call an HTTP route on a server that isn't
     listening yet. */
  try {
    const jobs = await listOpenJobs();

    for (const job of jobs) {
      entries.push({
        url: `${SITE_URL}/jobs/${job.id}`,
        lastModified: toDate(job.updatedAt) ?? now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    /* Derived from live roles, so a discipline or state only appears while it
       has something on it. Submitting a URL that 404s is a crawl error, not a
       missed opportunity. */
    for (const facet of categoryFacets(jobs)) {
      entries.push({
        url: `${SITE_URL}/jobs/category/${facet.slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.75,
      });
    }

  } catch {
    // Static routes alone still make a valid sitemap.
  }

  return entries;
}

/** Firestore hands back a Timestamp; tolerate a plain Date or millis too. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const ts = value as { toDate?: () => Date };
  return typeof ts.toDate === "function" ? ts.toDate() : null;
}
