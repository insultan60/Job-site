import type { Job } from "./jobs";
import { SITE_NAME, absoluteUrl } from "./seo";

/* schema.org JobPosting for a single role — the markup Google Jobs reads.

   Caveat worth knowing: /jobs/[id] loads its data client-side, so this JSON-LD
   is injected after hydration. Google renders JS and generally picks it up, but
   Google Jobs applies stricter freshness rules than ordinary search. For
   guaranteed eligibility the route needs to fetch during SSR. See SEO.md. */

/** Google needs one of these tokens, not our display labels. */
const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  "Full-time": "FULL_TIME",
  "Part-time": "PART_TIME",
  Contract: "CONTRACTOR",
  Temporary: "TEMPORARY",
  Internship: "INTERN",
};

/** MySQL ISO string | Firestore Timestamp | Date | millis → ISO string. */
function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  /* Repository reads return MySQL's created_at as a string. Preserve its date
     portion instead of parsing it in the server's local timezone; datePosted
     accepts an ISO calendar date and this avoids accidentally shifting it by a
     day. */
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1];
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  const ts = value as { toDate?: () => Date };
  return typeof ts.toDate === "function" ? ts.toDate().toISOString() : undefined;
}

/* "Austin, TX" / "Austin, Texas" → address parts. Anything we can't parse is
   left off rather than guessed, since a wrong region is worse than none. */
function toAddress(location: string) {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  return {
    "@type": "PostalAddress",
    addressCountry: "US",
    ...(parts[0] ? { addressLocality: parts[0] } : {}),
    ...(parts[1] ? { addressRegion: parts[1] } : {}),
  };
}

/** Combine the free-text fields into the description Google indexes. */
function toDescription(job: Job): string {
  return [
    job.description,
    job.responsibilities && `Responsibilities: ${job.responsibilities}`,
    job.requirements && `Requirements: ${job.requirements}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function jobPostingSchema(job: Job) {
  const datePosted = toIso(job.createdAt);

  const salary =
    job.salaryMin || job.salaryMax
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "USD",
            value: {
              "@type": "QuantitativeValue",
              unitText: "YEAR",
              ...(job.salaryMin ? { minValue: job.salaryMin } : {}),
              ...(job.salaryMax ? { maxValue: job.salaryMax } : {}),
            },
          },
        }
      : {};

  /* A remote role still needs applicantLocationRequirements; omitting it on a
     TELECOMMUTE posting is one of the most common validation failures. */
  const remote = job.remote
    ? {
        jobLocationType: "TELECOMMUTE",
        applicantLocationRequirements: {
          "@type": "Country",
          name: "USA",
        },
      }
    : {};

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: toDescription(job),
    identifier: {
      "@type": "PropertyValue",
      name: SITE_NAME,
      value: job.id,
    },
    url: absoluteUrl(`/jobs/${job.id}`),
    ...(datePosted ? { datePosted } : {}),
    employmentType: EMPLOYMENT_TYPE_MAP[job.employmentType] ?? "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      name: job.company || SITE_NAME,
    },
    /* JobFolder is the agency posting on the client's behalf. Declaring that
       explicitly is what Google asks of staffing firms. */
    directApply: false,
    ...(job.location
      ? {
          jobLocation: {
            "@type": "Place",
            address: toAddress(job.location),
          },
        }
      : {}),
    ...remote,
    ...salary,
    industry: job.category,
  };
}
