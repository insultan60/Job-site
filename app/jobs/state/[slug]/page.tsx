import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { listOpenJobs } from "@/lib/server/repo";
import { categoryFacets, jobsInState, stateOf, titleFromSlug } from "@/lib/jobTaxonomy";
import { LandingJobList, FacetLinks } from "@/components/jobs/LandingJobList";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";
import { getJobState, jobStates } from "@/lib/jobStates";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/ui";

export const revalidate = 3600;
export const dynamicParams = false;

const loadJobs = cache(() => listOpenJobs());

export function generateStaticParams() {
  return jobStates.map((state) => ({ slug: state.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jobs = await loadJobs().catch(() => []);
  const matching = jobsInState(jobs, slug);
  const state = getJobState(slug);
  const name = state?.name || (matching[0] && stateOf(matching[0].location)) || titleFromSlug(slug);
  const title = `Engineering Jobs in ${name} - ${matching.length} Open Role${matching.length === 1 ? "" : "s"}`;
  const description = `${matching.length} open engineering, DOT and infrastructure role${matching.length === 1 ? "" : "s"} in ${name} on ${SITE_NAME}. Browse current openings and local market context.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/jobs/state/${slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/jobs/state/${slug}`) },
  };
}

export default async function StateJobsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jobs = await loadJobs().catch(() => []);
  const matching = jobsInState(jobs, slug);
  const state = getJobState(slug);
  const name = state?.name || (matching[0] && stateOf(matching[0].location)) || titleFromSlug(slug);
  const localCategories = categoryFacets(matching);
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Engineering Jobs in ${name}`,
    url: `${SITE_URL}/jobs/state/${slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: matching.length,
      itemListElement: matching.map((job, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/jobs/${encodeURIComponent(job.id)}`,
        name: job.title,
      })),
    },
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">
        <section className="py-8 lg:py-10">
          <Container>
            <nav className="text-sm font-semibold text-muted" aria-label="Breadcrumb">
              <Link href="/jobs" className="hover:text-primary">All jobs</Link>
              <span className="mx-1.5 opacity-50">/</span>
              <Link href="/jobs/state" className="hover:text-primary">States</Link>
              <span className="mx-1.5 opacity-50">/</span>
              <span className="text-ink">{name}</span>
            </nav>
            <span className="mt-5 block text-xs font-bold uppercase tracking-wider text-muted">
              Open roles in {state?.region ?? "this market"}
            </span>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Engineering Jobs in {name}
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
              {matching.length} open engineering, DOT and infrastructure {matching.length === 1 ? "role" : "roles"} in {name}
              {localCategories.length > 0 && (
                <>
                  {" - currently hiring across "}
                  {localCategories.slice(0, 4).map((category, index, list) => (
                    <span key={category.slug}>
                      {category.name.toLowerCase()}
                      {index < list.length - 2 ? ", " : index === list.length - 2 ? " and " : ""}
                    </span>
                  ))}
                </>
              )}
              .
            </p>
          </Container>
        </section>

        <section className="pb-16 sm:pb-20">
          <Container className="max-w-4xl">
            {state && (
              <section className="rounded-2xl border border-line bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">State hiring context</p>
                <h2 className="mt-2 text-lg font-bold text-ink">{state.name} engineering market</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {state.name} is a major {state.region.toLowerCase()} market for {state.focus}.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{state.hiringNote}</p>
              </section>
            )}

            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Live opportunities</p>
                  <h2 className="mt-1 text-lg font-bold text-ink">Current roles in {name}</h2>
                </div>
                <Link href="/jobs" className="text-sm font-bold text-primary hover:text-primary-dark">
                  Browse all jobs -&gt;
                </Link>
              </div>

              {matching.length > 0 ? (
                <LandingJobList jobs={matching} />
              ) : (
                <div className="mt-6 rounded-2xl border border-line bg-gray-50 p-7">
                  <p className="font-bold text-ink">No open roles are listed in {name} right now.</p>
                  <p className="mt-2 max-w-xl leading-relaxed text-muted">
                    Openings change regularly. Browse all current roles or return soon to see new opportunities in this market.
                  </p>
                </div>
              )}
            </section>

            <FacetLinks
              title="Explore other states"
              basePath="/jobs/state"
              facets={jobStates.map((item) => ({
                name: item.name,
                slug: item.slug,
                count: jobsInState(jobs, item.slug).length,
              }))}
              activeSlug={slug}
            />
            <FacetLinks title="Browse by discipline" basePath="/jobs/category" facets={categoryFacets(jobs)} />
          </Container>
        </section>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
    </>
  );
}
