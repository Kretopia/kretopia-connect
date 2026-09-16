/**
 * Sitemap Plugin — runs on every production build (unlike seo-pages.ts,
 * which also generates hundreds of individual static HTML files and is kept
 * opt-in behind VITE_GENERATE_STATIC_SOCIAL_PAGES because that volume of
 * per-entity file uploads can throttle Lovable's preview uploader).
 *
 * A sitemap is a single file, so none of that throttling risk applies here
 * — there's no reason it should ever go stale. This overwrites
 * dist/sitemap.xml (which Vite already copied from public/sitemap.xml) with
 * a real, current list: the same hand-curated static routes plus every
 * onboarding-complete profile and every verified credit, pulled fresh from
 * the database at build time.
 *
 * Reuses the same get_sitemap_profiles RPC and credits query seo-pages.ts
 * already uses (see that file for the fuller per-page HTML generation) —
 * kept as a separate, minimal plugin rather than refactoring that one, so
 * enabling/disabling the static-page export never affects sitemap freshness.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

interface SitemapPluginOptions {
  projectUrl: string;
  publishableKey: string;
  siteUrl: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  updated_at: string | null;
}

interface CreditRow {
  id: string;
  project_name: string | null;
  updated_at: string | null;
}

// Kept in sync with public/sitemap.xml's own hand-curated list — anything
// auth-gated (ProtectedRoute) or a dead client-side redirect stub has no
// business in a sitemap; a non-JS crawler won't follow either kind.
const STATIC_ENTRIES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/terms", priority: "0.3", changefreq: "monthly" },
  { path: "/privacy", priority: "0.3", changefreq: "monthly" },
  { path: "/community-guidelines", priority: "0.3", changefreq: "monthly" },
  { path: "/spotlight?tab=magazine", priority: "0.7", changefreq: "weekly" },
  { path: "/spotlight?tab=podcast", priority: "0.7", changefreq: "weekly" },
  { path: "/passport", priority: "0.9", changefreq: "daily" },
  { path: "/credits", priority: "0.9", changefreq: "daily" },
  { path: "/circle", priority: "0.6", changefreq: "weekly" },
  { path: "/claim", priority: "0.8", changefreq: "weekly" },
];

export function sitemapPlugin(options: SitemapPluginOptions): Plugin {
  return {
    name: "sitemap",
    apply: "build",
    async closeBundle() {
      if (!options.projectUrl || !options.publishableKey || !options.siteUrl) {
        console.warn("[sitemap] Missing configuration; skipping.");
        return;
      }

      const siteUrl = options.siteUrl.replace(/\/$/, "");
      const projectUrl = options.projectUrl.replace(/\/$/, "");
      const outDir = resolve(process.cwd(), "dist");
      const headers = {
        apikey: options.publishableKey,
        Authorization: `Bearer ${options.publishableKey}`,
      };

      let profiles: ProfileRow[] = [];
      try {
        const r = await fetch(`${projectUrl}/rest/v1/rpc/get_sitemap_profiles`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: "{}",
        });
        if (r.ok) profiles = (await r.json()) as ProfileRow[];
        else console.warn(`[sitemap] profiles RPC failed: ${r.status}`);
      } catch (e) {
        console.warn("[sitemap] profiles RPC error:", e);
      }

      let credits: CreditRow[] = [];
      try {
        const r = await fetch(
          `${projectUrl}/rest/v1/credits?select=id,project_name,updated_at&verification_status=eq.verified&order=updated_at.desc&limit=2000`,
          { headers },
        );
        if (r.ok) credits = (await r.json()) as CreditRow[];
        else console.warn(`[sitemap] credits fetch failed: ${r.status}`);
      } catch (e) {
        console.warn("[sitemap] credits fetch error:", e);
      }

      const today = new Date().toISOString().split("T")[0];
      const urls: string[] = STATIC_ENTRIES.map((e) =>
        urlBlock(`${siteUrl}${e.path}`, today, e.changefreq, e.priority),
      );

      const seenProfiles = new Set<string>();
      for (const p of profiles) {
        if (!p.full_name || !p.user_id || seenProfiles.has(p.user_id)) continue;
        seenProfiles.add(p.user_id);
        const lm = (p.updated_at || "").split("T")[0] || today;
        urls.push(urlBlock(`${siteUrl}/epk/${p.user_id}`, lm, "weekly", "0.7"));
      }

      const seenCredits = new Set<string>();
      for (const c of credits) {
        if (!c.project_name || !c.id || seenCredits.has(c.id)) continue;
        seenCredits.add(c.id);
        const lm = (c.updated_at || "").split("T")[0] || today;
        urls.push(urlBlock(`${siteUrl}/credits/project/${c.id}`, lm, "weekly", "0.6"));
      }

      const sitemap =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.join("\n") +
        `\n</urlset>\n`;
      writeFileSync(resolve(outDir, "sitemap.xml"), sitemap);

      console.log(`[sitemap] Wrote sitemap.xml with ${urls.length} URLs (${seenProfiles.size} profiles, ${seenCredits.size} credits).`);
    },
  };
}

function urlBlock(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}
