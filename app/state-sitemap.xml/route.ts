import { jobStates } from "@/lib/jobStates";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export function GET() {
  const lastModified = new Date().toISOString();
  const urls = jobStates
    .map(
      (state) => `  <url>\n    <loc>${SITE_URL}/jobs/state/${state.slug}</loc>\n    <lastmod>${lastModified}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
