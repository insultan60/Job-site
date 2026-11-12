import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listOpenJobs } from "@/lib/server/repo";
import { categoryFacets, jobsInState } from "@/lib/jobTaxonomy";
import { FacetLinks } from "@/components/jobs/LandingJobList";
import { StateDirectory } from "@/components/jobs/StateDirectory";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import { jobStates } from "@/lib/jobStates";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/ui";
import { photo } from "@/components/images";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Engineering Jobs by State | JobFolder",
  description: `Browse open engineering, DOT and infrastructure roles by state on ${SITE_NAME}.`,
  alternates: { canonical: absoluteUrl("/jobs/state") },
};

export default async function StateHubPage() {
  const jobs = await listOpenJobs().catch(() => []);
  const states = jobStates.map((state) => ({
    name: state.name,
    slug: state.slug,
    count: jobsInState(jobs, state.slug).length,
  }));
  const locationsWithRoles = states.filter((state) => state.count > 0).length;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">
        <section className="relative overflow-hidden">
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
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-100">
                Live job board
              </span>
              <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                Engineering jobs by state
              </h1>
              <p className="mt-4 text-base leading-relaxed text-blue-100 sm:text-lg">
                Browse current engineering, DOT and infrastructure roles by location.
              </p>
              <Link
                href="/jobs"
                className="mt-7 inline-flex rounded-pill bg-amber-400 px-6 py-3 text-sm font-bold text-blue-brand-dark transition-colors hover:bg-amber-300"
              >
                Browse all jobs
              </Link>
            </div>
            <div className="grid min-w-52 grid-cols-2 divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="pr-5">
                <p className="text-3xl font-extrabold tracking-tight text-white">{jobs.length}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-100">Open roles</p>
              </div>
              <div className="pl-5">
                <p className="text-3xl font-extrabold tracking-tight text-white">{locationsWithRoles}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-100">States with roles</p>
              </div>
            </div>
          </Container>
        </section>

        <section className="bg-slate-50/60 py-10 sm:py-14">
          <Container>
            <StateDirectory states={states} />

            <FacetLinks title="Browse by discipline" basePath="/jobs/category" facets={categoryFacets(jobs)} />
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
