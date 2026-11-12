import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import { listOpenJobs } from "@/lib/server/repo";
import { categoryFacets, jobsInState, stateOf, titleFromSlug } from "@/lib/jobTaxonomy";
import { LandingJobList, FacetLinks } from "@/components/jobs/LandingJobList";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import { getJobState, jobStates } from "@/lib/jobStates";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/ui";
import { photo } from "@/components/images";

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
  const description = `${matching.length} open engineering, DOT and infrastructure role${matching.length === 1 ? "" : "s"} in ${name} on ${SITE_NAME}.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/jobs/state/${slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/jobs/state/${slug}`) },
    ...(matching.length === 0 ? { robots: { index: false, follow: true } } : {}),
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
  const categories = categoryFacets(matching);
  const stateFacets = jobStates.map((item) => ({
    name: item.name,
    slug: item.slug,
    count: jobsInState(jobs, item.slug).length,
  }));
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Engineering Jobs in ${name}`,
    url: absoluteUrl(`/jobs/state/${slug}`),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: matching.length,
      itemListElement: matching.map((job, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/jobs/${encodeURIComponent(job.id)}`),
        name: job.title,
      })),
    },
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">
        <section className="relative overflow-hidden bg-blue-brand-dark">
          <div className="absolute inset-0">
            <Image
              src={photo.heroInterview.src}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-blue-brand-dark/80 via-blue-brand-dark/65 to-blue-brand-dark/85" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          </div>
          <Container className="relative grid gap-8 py-12 sm:py-16 lg:h-[400px] lg:grid-cols-[1fr_auto] lg:items-center lg:py-20">
            <div className="max-w-2xl">
              <nav className="text-xs font-semibold text-blue-100" aria-label="Breadcrumb">
                <Link href="/jobs" className="hover:text-white">All jobs</Link>
                <span className="mx-1.5 opacity-50">/</span>
                <Link href="/jobs/state" className="hover:text-white">States</Link>
                <span className="mx-1.5 opacity-50">/</span>
                <span className="text-white">{name}</span>
              </nav>
              <span className="mt-7 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-100">
                {matching.length} open {matching.length === 1 ? "role" : "roles"}
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Engineering jobs in {name}
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-blue-100">
                Current positions listed on JobFolder for {name}.
              </p>
            </div>
            <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur-sm lg:w-72">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-100">Available now</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-white">{matching.length}</p>
              <p className="mt-1 text-sm text-blue-100">open {matching.length === 1 ? "position" : "positions"}</p>
              <div className="mt-5 border-t border-white/15 pt-5">
                <Link
                  href="/jobs"
                  className="inline-flex w-full justify-center rounded-pill bg-amber-400 px-4 py-2.5 text-sm font-bold text-blue-brand-dark transition-colors hover:bg-amber-300"
                >
                  Browse all jobs
                </Link>
              </div>
            </div>
          </Container>
        </section>

        <section className="bg-slate-50/60 py-10 sm:py-14">
          <Container>
            <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Browse jobs</p>
                  <div className="mt-4 space-y-2">
                    <Link href="/jobs" className="block text-sm font-semibold text-ink hover:text-primary">
                      All open roles
                    </Link>
                    <Link href="/jobs/state" className="block text-sm font-semibold text-primary">
                      Jobs by state
                    </Link>
                  </div>
                </div>

                {categories.length > 0 && (
                  <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">Categories in {name}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <Link
                          key={category.slug}
                          href={`/jobs/category/${category.slug}`}
                          className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
                        >
                          {category.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </aside>

              <div className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Current openings</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-tight text-ink">
                      {matching.length} job{matching.length === 1 ? "" : "s"} found
                    </h2>
                  </div>
                  <Link href="/jobs" className="text-sm font-semibold text-primary hover:text-primary-dark">
                    View all jobs
                  </Link>
                </div>

                {matching.length > 0 ? (
                  <LandingJobList jobs={matching} />
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-line p-10 text-center">
                    <h2 className="font-bold text-ink">No open roles in {name} right now</h2>
                    <p className="mt-2 text-sm text-muted">Browse all current roles to continue your search.</p>
                    <Link
                      href="/jobs"
                      className="mt-5 inline-flex rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                      Browse all jobs
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <FacetLinks
              title="Explore other states"
              basePath="/jobs/state"
              facets={stateFacets}
              activeSlug={slug}
            />
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
