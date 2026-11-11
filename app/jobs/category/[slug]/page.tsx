import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { listOpenJobs } from "@/lib/server/repo";
import { categoryFacets, jobsInCategory, jobsInState, titleFromSlug } from "@/lib/jobTaxonomy";
import { LandingJobList, FacetLinks } from "@/components/jobs/LandingJobList";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";
import { jobStates } from "@/lib/jobStates";

/* One indexable page per engineering discipline.
 *
 * /jobs is a single client-rendered URL behind filters, so a crawler sees
 * one page however many roles are on it, and someone searching "civil
 * engineering jobs" has nothing specific to land on. This gives each
 * discipline its own server-rendered URL with the roles in the HTML.
 *
 * Hourly ISR rather than fully static: roles open and close on their own
 * (the Top Echelon sync closes filled ones), and a landing page listing a
 * role that's gone is worse than a slightly stale one. */
export const revalidate = 3600;

/* Only slugs built from live data are routable; anything else is a real 404.
 *
 * This matters more than it looks. With dynamicParams left on, an unknown
 * slug renders and calls notFound() — but under ISR that response gets
 * cached and served with HTTP 200, i.e. a soft 404. Google treats those as
 * thin duplicates and they quietly eat crawl budget. Switching it off makes
 * the router reject unknown slugs before any of this runs.
 *
 * The trade-off: a discipline or state that gains its first role won't have
 * a page until the next deploy. Its roles are still on /jobs and on the
 * other axis's page, so nothing is hidden — and a deploy follows any sync
 * worth publishing. */
export const dynamicParams = false;

const loadJobs = cache(() => listOpenJobs());

/* Pre-render only disciplines that currently have roles. A page with an
   empty list wastes crawl budget and reads as abandoned, so unknown slugs
   404 rather than rendering "no jobs found". */
export async function generateStaticParams() {
  const jobs = await loadJobs().catch(() => []);
  return categoryFacets(jobs).map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jobs = await loadJobs().catch(() => []);
  const matching = jobsInCategory(jobs, slug);
  const name = matching[0]?.category ?? titleFromSlug(slug);

  /* Brand suffix included because these pages are the ones most likely to be
     a stranger's first contact with JobFolder — and because the count keeps
     the whole thing comfortably inside the ~60 characters Google will show.
     The H1 is the same phrase without the suffix: Google discards a title
     that diverges from the H1 and shows the H1 instead, so they're kept
     deliberately consistent. */
  const title = `${name} Jobs — ${matching.length} Open Role${matching.length === 1 ? "" : "s"} | JobFolder`;
  const description = `${matching.length} open ${name.toLowerCase()} role${matching.length === 1 ? "" : "s"} on ${SITE_NAME}. Every posting shows the recruiter fee it pays on a confirmed hire, before you submit anyone.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/jobs/category/${slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/jobs/category/${slug}`) },
    /* A page built when the discipline had roles, whose roles have since all
       closed. It stays reachable — links to it exist — but an empty list is
       nothing anyone should land on from search. */
    ...(matching.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CategoryJobsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jobs = await loadJobs();
  const categories = categoryFacets(jobs);
  const matching = jobsInCategory(jobs, slug);
  /* Name comes from the roles themselves, so it stays correct even for a
     page whose discipline has dropped out of the live facet list. */
  const facet = { name: matching[0]?.category ?? titleFromSlug(slug), count: matching.length };

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <nav className="text-xs font-semibold text-muted" aria-label="Breadcrumb">
        <Link href="/jobs" className="hover:text-primary">All jobs</Link>
        <span className="mx-1.5 opacity-50">/</span>
        <span className="text-ink">{facet.name}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {facet.name} Jobs
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        {facet.count} open {facet.name.toLowerCase()} {facet.count === 1 ? "role" : "roles"} on{" "}
        {SITE_NAME}. Every posting shows the fee it pays a recruiter on a confirmed hire,
        published up front — so you know what a placement is worth before you submit anyone.
      </p>

      <LandingJobList jobs={matching} />

      <FacetLinks
        title="Other disciplines"
        basePath="/jobs/category"
        facets={categories}
        activeSlug={slug}
      />
      <FacetLinks
        title="Browse by state"
        basePath="/jobs/state"
        facets={jobStates.map((state) => ({
          name: state.name,
          slug: state.slug,
          count: jobsInState(jobs, state.slug).length,
        }))}
      />

      {/* ItemList rather than JobPosting: the individual roles carry their own
          JobPosting markup at /jobs/[id], and duplicating it here would offer
          Google two sources for the same role. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${facet.name} Jobs`,
            url: `${SITE_URL}/jobs/category/${slug}`,
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: matching.length,
              itemListElement: matching.map((job, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${SITE_URL}/jobs/${encodeURIComponent(job.id)}`,
                name: job.title,
              })),
            },
          }),
        }}
      />
    </main>
  );
}
