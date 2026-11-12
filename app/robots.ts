import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /* Authenticated surfaces carry no public value and only dilute crawl
         budget. The admin console is deliberately absent: robots.txt is public,
         so naming it here would publish the unguessable path it relies on.
         It is excluded via `robots: noindex` in its own layout instead. */
      disallow: ["/dashboard", "/login", "/signup"],
    },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/state-sitemap.xml`,
    ],
    host: SITE_URL,
  };
}
