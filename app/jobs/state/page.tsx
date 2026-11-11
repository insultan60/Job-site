import type { Metadata } from "next";
import Link from "next/link";
import { listOpenJobs } from "@/lib/server/repo";
import { categoryFacets, stateFacets } from "@/lib/jobTaxonomy";
import { FacetLinks } from "@/components/jobs/LandingJobList";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import { jobStates } from "@/lib/jobStates";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/ui";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Engineering Jobs by State | JobFolder",
  description: `Browse open engineering, DOT and infrastructure roles by state on ${SITE_NAME}. Every posting shows the recruiter fee it pays on a confirmed hire.`,
  alternates: { canonical: absoluteUrl("/jobs/state") },
};

export default async function StateHubPage() {
  const jobs = await listOpenJobs().catch(() => []);
  const liveStateFacets = stateFacets(jobs);
  const states = jobStates.map((state) => ({
    name: state.name,
    slug: state.slug,
    count: liveStateFacets.find((facet) => facet.slug === state.slug)?.count ?? 0,
  }));

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">
        <section className="py-8 lg:py-10">
          <Container>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Open roles</span>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Engineering jobs by state
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
              Explore ten major engineering markets, see which roles are open, and understand
              the local context behind each search.
            </p>
          </Container>
        </section>

        <section className="pb-16 sm:pb-20">
          <Container>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {states.map((state) => {
                const detail = jobStates.find((item) => item.slug === state.slug)!;
                return (
                  <Link
                    key={state.slug}
                    href={`/jobs/state/${state.slug}`}
                    className="group rounded-2xl border border-line bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_10px_30px_-24px_rgba(23,19,15,0.4)]"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      {detail.region}
                    </span>
                    <h2 className="mt-2 text-lg font-bold text-ink transition-colors group-hover:text-primary">
                      {state.name}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{detail.focus}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                      {state.count} open {state.count === 1 ? "role" : "roles"}
                      <span aria-hidden className="transition-transform group-hover:translate-x-1">-&gt;</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-14 w-full rounded-2xl border border-line bg-white p-7 text-center">
              <p className="text-lg font-bold text-ink">Looking for a specific city?</p>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
                Browse local engineering markets across major U.S. cities and see current roles
                when they are available.
              </p>
              <Link
                href="/jobs/city"
                className="mt-6 inline-flex rounded-pill bg-primary px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Browse cities
              </Link>
            </div>

            <FacetLinks title="Browse by discipline" basePath="/jobs/category" facets={categoryFacets(jobs)} />
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
