/**
 * Sitemap Generator
 *
 * Generates a sitemap.xml for BASEUSDP's public pages.
 * Run with: npx tsx scripts/generate-sitemap.ts
 *
 * The generated sitemap is written to dist/sitemap.xml
 * and should be deployed alongside the production build.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const SITE_URL = "https://baseusdp.com";

interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
}

const pages: SitemapEntry[] = [
  {
    loc: "/",
    lastmod: new Date().toISOString().split("T")[0],
    changefreq: "weekly",
    priority: 1.0,
  },
  {
    loc: "/dashboard",
    lastmod: new Date().toISOString().split("T")[0],
    changefreq: "daily",
    priority: 0.9,
  },
  {
    loc: "/swap",
    lastmod: new Date().toISOString().split("T")[0],
    changefreq: "daily",
    priority: 0.8,
  },
  {
    loc: "/transfer",
    lastmod: new Date().toISOString().split("T")[0],
    changefreq: "daily",
    priority: 0.8,
  },
  {
    loc: "/deposit",
    lastmod: new Date().toISOString().split("T")[0],
    changefreq: "weekly",
    priority: 0.7,
  },
  {
    loc: "/support",
    lastmod: new Date().toISOString().split("T")[0],
    changefreq: "monthly",
    priority: 0.5,
  },
  {
    loc: "/privacy-policy",
    lastmod: new Date().toISOString().split("T")[0],
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    loc: "/terms-and-conditions",
    lastmod: new Date().toISOString().split("T")[0],
    changefreq: "yearly",
    priority: 0.3,
  },
];

function generateSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${SITE_URL}${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard

Sitemap: ${SITE_URL}/sitemap.xml`;
}

// Generate files
const distDir = resolve(process.cwd(), "dist");
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

writeFileSync(resolve(distDir, "sitemap.xml"), generateSitemap(pages), "utf-8");
writeFileSync(resolve(distDir, "robots.txt"), generateRobotsTxt(), "utf-8");

console.log(`Generated sitemap.xml with ${pages.length} URLs`);
console.log(`Generated robots.txt`);
console.log(`Output: ${distDir}/`);
