import type { MetadataRoute } from "next";
import { jobStates } from "@/lib/jobStates";
import { SITE_URL } from "@/lib/seo";

/**
 * State location sitemap entries, kept separately until this sitemap is ready
 * to be published as a public XML route.
 */
export default function stateSitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return jobStates.map((state) => ({
    url: `${SITE_URL}/jobs/state/${state.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
}
