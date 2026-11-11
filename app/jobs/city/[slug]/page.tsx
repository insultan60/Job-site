import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { LandingJobList } from "@/components/jobs/LandingJobList";
import { JsonLd } from "@/components/JsonLd";
import { getJobMarket, jobMarkets } from "@/lib/jobMarkets";
import { stateOf } from "@/lib/jobTaxonomy";
import { listOpenJobs } from "@/lib/server/repo";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { getJobState } from "@/lib/jobStates";

export const dynamicParams = false;
export const revalidate = 3600;

const loadJobs = cache(async () => listOpenJobs().catch(() => []));

export function generateStaticParams() {
  return jobMarkets.map((market) => ({ slug: market.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const market = getJobMarket(slug);
  if (!market) return {};
  const title = `Engineering Jobs in ${market.city}, ${market.state}`;
  const description = `Explore engineering, infrastructure and DOT jobs in ${market.city}, ${market.state}. Follow the local market and browse current openings on ${SITE_NAME}.`;
  const path = `/jobs/city/${market.slug}`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: { title, description, url: absoluteUrl(path) },
  };
}

export default async function CityJobsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const market = getJobMarket(slug);
  if (!market) notFound();

  const jobs = await loadJobs();
  const cityName = market.city.toLowerCase();
  const matching = jobs.filter((job) =>
    job.location.toLowerCase().includes(cityName) && stateOf(job.location) === market.state,
  );
  const stateJobs = jobs.filter((job) => stateOf(job.location) === market.state);
  const statePage = getJobState(market.stateSlug);
  const path = `/jobs/city/${market.slug}`;
  const related = jobMarkets.filter((item) => item.state === market.state && item.slug !== market.slug).slice(0, 5);
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Engineering Jobs in ${market.city}, ${market.state}`,
      description: `Engineering, infrastructure and DOT employment market information for ${market.city}, ${market.state}.`,
      url: absoluteUrl(path),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Jobs", item: absoluteUrl("/jobs") },
        { "@type": "ListItem", position: 3, name: "Cities", item: absoluteUrl("/jobs/city") },
        { "@type": "ListItem", position: 4, name: `${market.city}, ${market.state}`, item: absoluteUrl(path) },
      ],
    },
  ];

  return (
    <>
      <JsonLd schema={schemas} />
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-gray-100 bg-gray-50/50 py-14 sm:py-20">
          <Container>
            <nav className="text-sm font-semibold text-muted" aria-label="Breadcrumb">
              <Link href="/jobs" className="hover:text-primary">All jobs</Link>
              <span className="mx-1.5 opacity-50">/</span>
              <Link href="/jobs/city" className="hover:text-primary">Cities</Link>
              <span className="mx-1.5 opacity-50">/</span>
              <span className="text-ink">{market.city}</span>
            </nav>
            <p className="mt-7 text-sm font-bold uppercase tracking-wider text-primary">{market.region} job market</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Engineering Jobs in {market.city}, {market.state}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">
              {market.city} is a key {market.region.toLowerCase()} market for {market.focus}. Use this page to follow the local engineering market and find current opportunities as they are posted.
            </p>
          </Container>
        </section>

        <section className="py-14 sm:py-20">
          <Container className="max-w-4xl">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">Current roles in {market.city}</h2>
            {matching.length > 0 ? (
              <LandingJobList jobs={matching} />
            ) : (
              <div className="mt-6 rounded-2xl border border-line bg-gray-50 p-6">
                <p className="font-semibold text-ink">No current roles are listed for {market.city}.</p>
                <p className="mt-2 leading-relaxed text-muted">Openings change often. Browse all current roles or explore the wider {market.state} market.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/jobs" className="rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">Browse all jobs</Link>
                  {stateJobs.length > 0 && statePage && (
                    <Link href={`/jobs/state/${market.stateSlug}`} className="rounded-pill border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary">Jobs in {market.state}</Link>
                  )}
                </div>
              </div>
            )}

            <section className="mt-14 border-t border-line pt-10">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">What to look for in this market</h2>
              <p className="mt-4 leading-relaxed text-muted">
                Local searches work best when the job brief is precise about the discipline, the project environment, required licences or certifications, and whether the role is office, field or hybrid. In {market.city}, that usually means separating general engineering experience from experience in {market.focus}.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                Candidates can use the same detail to judge fit: confirm the technical scope, location expectations and licence requirements before applying. Employers can publish those details with a role to help specialist recruiters target the right people faster.
              </p>
            </section>

            {related.length > 0 && (
              <section className="mt-14 border-t border-line pt-10">
                <h2 className="text-lg font-bold text-ink">Other {market.state} markets</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {related.map((item) => (
                    <Link key={item.slug} href={`/jobs/city/${item.slug}`} className="rounded-pill border border-line px-3.5 py-2 text-sm font-semibold text-ink hover:border-primary hover:text-primary">
                      {item.city}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
