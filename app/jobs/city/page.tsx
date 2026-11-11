import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { jobMarkets } from "@/lib/jobMarkets";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Engineering Jobs by City | JobFolder",
  description: "Browse engineering, infrastructure and DOT job markets in 51 major U.S. cities.",
  alternates: { canonical: absoluteUrl("/jobs/city") },
};

export default function CityHubPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-gray-50/40 py-14 sm:py-20">
        <Container>
          <nav className="text-sm font-semibold text-muted" aria-label="Breadcrumb">
            <Link href="/jobs" className="hover:text-primary">All jobs</Link>
            <span className="mx-1.5 opacity-50">/</span>
            <span className="text-ink">Cities</span>
          </nav>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Engineering Jobs by City
          </h1>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted">
            Explore engineering, infrastructure and DOT hiring markets across 51 major U.S. cities.
            Each market page includes local context and links to current roles when available.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobMarkets.map((market) => (
              <Link key={market.slug} href={`/jobs/city/${market.slug}`} className="rounded-2xl border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm">
                <p className="text-lg font-bold text-ink">{market.city}, {market.state}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{market.focus}</p>
              </Link>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
