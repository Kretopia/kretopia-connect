/**
 * SEO Pages Plugin
 *
 * Runs at the end of `vite build`. Two jobs:
 *   1. Emits crawler-indexable static HTML at canonical app URLs by patching
 *      the built `dist/index.html` with per-page <title>, meta description,
 *      canonical, OG/Twitter tags, and JSON-LD. The SPA script tags are kept
 *      intact so real users still hydrate normally.
 *        - /profile/:user_id/index.html
 *        - /epk/:user_id/index.html
 *        - /credits/project/:project_id/index.html
 *   2. Overwrites dist/sitemap.xml with a complete URL list pulled from the
 *      database (static routes + every public profile + every verified credit).
 *
 * Goal: when someone Googles a creator's name, their Kretopia profile or
 * credit page should be a candidate result — with the right title, not the
 * generic homepage title.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

interface SeoPagesPluginOptions {
  projectUrl: string;
  publishableKey: string;
  siteUrl: string;
}

interface ProfileRow {
  user_id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  updated_at: string | null;
}

interface CreditRow {
  id: string;
  project_name: string | null;
  role: string | null;
  year: number | null;
  credit_category: string | null;
  description: string | null;
  thumbnail_url: string | null;
  updated_at: string | null;
}


const PROJECT_REF = "kwmcocsitwssrtzkdojh";
const FALLBACK_OG = "https://www.kretopia.com/og-image.png";

export function seoPagesPlugin(options: SeoPagesPluginOptions): Plugin {
  return {
    name: "seo-pages",
    apply: "build",
    async closeBundle() {
      if (!options.projectUrl || !options.publishableKey || !options.siteUrl) {
        console.warn("[seo-pages] Missing configuration; skipping.");
        return;
      }

      const siteUrl = options.siteUrl.replace(/\/$/, "");
      const projectUrl = options.projectUrl.replace(/\/$/, "");
      const outDir = resolve(process.cwd(), "dist");
      const indexHtmlPath = resolve(outDir, "index.html");

      if (!existsSync(indexHtmlPath)) {
        console.warn("[seo-pages] dist/index.html not found; skipping.");
        return;
      }
      const baseHtml = readFileSync(indexHtmlPath, "utf-8");

      const headers = {
        apikey: options.publishableKey,
        Authorization: `Bearer ${options.publishableKey}`,
      };

      // ---- Fetch public, crawl-worthy profiles via SECURITY DEFINER RPC -----
      // (RLS on profiles + public_profiles_safe restricts anon to 1 row, so we
      // call a dedicated sitemap RPC that returns the public slice for all
      // onboarding-complete profiles.)
      let profiles: ProfileRow[] = [];
      try {
        const r = await fetch(`${projectUrl}/rest/v1/rpc/get_sitemap_profiles`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: "{}",
        });
        if (r.ok) profiles = (await r.json()) as ProfileRow[];
        else console.warn(`[seo-pages] profiles RPC failed: ${r.status}`);
      } catch (e) {
        console.warn("[seo-pages] profiles RPC error:", e);
      }

      // Dedupe profiles by user_id — RPC can return duplicates which causes
      // S3 to reject concurrent PUTs to the same key during deploy.
      // Also cap total to keep upload volume under S3 per-prefix request rate.
      {
        const seen = new Set<string>();
        profiles = profiles.filter((p) => {
          if (!p.user_id || seen.has(p.user_id)) return false;
          seen.add(p.user_id);
          return true;
        });
        const MAX_PROFILE_PAGES = 200;
        if (profiles.length > MAX_PROFILE_PAGES) {
          console.warn(
            `[seo-pages] Capping profile pages from ${profiles.length} to ${MAX_PROFILE_PAGES} to avoid S3 throttling.`,
          );
          profiles = profiles.slice(0, MAX_PROFILE_PAGES);
        }
      }

      // ---- Fetch verified credits -------------------------------------------
      let credits: CreditRow[] = [];
      try {
        const r = await fetch(
          `${projectUrl}/rest/v1/credits?select=id,project_name,role,year,credit_category,description,thumbnail_url,updated_at&verification_status=eq.verified&order=updated_at.desc&limit=2000`,
          { headers },
        );
        if (r.ok) credits = (await r.json()) as CreditRow[];
        else console.warn(`[seo-pages] credits fetch failed: ${r.status}`);
      } catch (e) {
        console.warn("[seo-pages] credits fetch error:", e);
      }

      // Dedupe credits by id for the same reason, and cap.
      {
        const seen = new Set<string>();
        credits = credits.filter((c) => {
          if (!c.id || seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
        const MAX_CREDIT_PAGES = 300;
        if (credits.length > MAX_CREDIT_PAGES) {
          console.warn(
            `[seo-pages] Capping credit pages from ${credits.length} to ${MAX_CREDIT_PAGES} to avoid S3 throttling.`,
          );
          credits = credits.slice(0, MAX_CREDIT_PAGES);
        }
      }


      // ---- Emit per-profile pages (/profile/:id + /epk/:id) -----------------
      let profilePages = 0;
      for (const p of profiles) {
        if (!p.full_name) continue;

        // /profile/:id
        const profileUrl = `${siteUrl}/profile/${p.user_id}`;
        const pTitle = `${p.full_name}${p.role ? ` — ${p.role}` : ""} | Kretopia`;
        const pDesc = truncate(
          p.bio ||
            `${p.full_name} is a ${p.role || "creative"} on Kretopia — view verified credits, portfolio, and contact info.`,
          155,
        );
        const pHtml = patchHead(baseHtml, {
          title: pTitle,
          description: pDesc,
          canonical: profileUrl,
          ogType: "profile",
          ogImage: p.avatar_url || FALLBACK_OG,
          ogImageAlt: p.full_name,
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "Person",
            name: p.full_name,
            ...(p.role && { jobTitle: p.role }),
            ...(p.bio && { description: truncate(p.bio, 300) }),
            ...(p.avatar_url && { image: p.avatar_url }),
            ...(p.location && { homeLocation: p.location }),
            url: profileUrl,
          },
        });
        writeStatic(outDir, `profile/${p.user_id}/index.html`, pHtml);
        profilePages++;

        // /epk/:id  (Press Kit — same person, framed as EPK)
        const epkUrl = `${siteUrl}/epk/${p.user_id}`;
        const epkImage = `https://${PROJECT_REF}.supabase.co/functions/v1/epk-og-image?user_id=${p.user_id}`;
        const epkTitle = `${p.full_name} — ${p.role || "Creative"} | Press Kit on Kretopia`;
        const epkDesc = truncate(
          p.bio ||
            `${p.full_name}'s verified Electronic Press Kit on Kretopia — credits, portfolio, rates, contact.`,
          155,
        );
        const epkHtml = patchHead(baseHtml, {
          title: epkTitle,
          description: epkDesc,
          canonical: epkUrl,
          ogType: "profile",
          ogImage: epkImage,
          ogImageAlt: `${p.full_name} — Press Kit`,
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "Person",
            name: p.full_name,
            ...(p.role && { jobTitle: p.role }),
            url: epkUrl,
          },
        });
        writeStatic(outDir, `epk/${p.user_id}/index.html`, epkHtml);
      }

      // ---- Emit per-credit pages (/credits/project/:id) ---------------------
      let creditPages = 0;
      for (const c of credits) {
        if (!c.project_name) continue;
        const url = `${siteUrl}/credits/project/${c.id}`;
        const title = `${c.project_name}${c.year ? ` (${c.year})` : ""} | Kretopia Credits`;
        const desc = truncate(
          c.description ||
            `${c.project_name}${c.role ? ` — ${c.role}` : ""}${c.credit_category ? ` · ${c.credit_category}` : ""}. Verified credit on Kretopia — the creative industry's collaboration database.`,
          155,
        );
        const html = patchHead(baseHtml, {
          title,
          description: desc,
          canonical: url,
          ogType: "article",
          ogImage: c.thumbnail_url || FALLBACK_OG,
          ogImageAlt: c.project_name,
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: c.project_name,
            ...(c.description && { description: truncate(c.description, 300) }),
            ...(c.thumbnail_url && { image: c.thumbnail_url }),
            ...(c.year && { datePublished: String(c.year) }),
            url,
          },
        });
        writeStatic(outDir, `credits/project/${c.id}/index.html`, html);
        creditPages++;
      }

      // ---- Sitemap ----------------------------------------------------------
      const today = new Date().toISOString().split("T")[0];
      // /auth (never indexable), /landing (dead client-side redirect stub to
      // /), and /founding-member (ProtectedRoute-gated -- a crawler
      // following it only reaches a login wall) don't belong in a sitemap;
      // /magazine and /podcast are themselves dead redirect stubs a non-JS
      // crawler won't follow, so link their real destinations directly.
      const staticEntries: Array<{ path: string; priority: string; changefreq: string }> = [
        { path: "/", priority: "1.0", changefreq: "weekly" },
        { path: "/credits", priority: "0.9", changefreq: "daily" },
        { path: "/spotlight?tab=magazine", priority: "0.8", changefreq: "weekly" },
        { path: "/spotlight?tab=podcast", priority: "0.7", changefreq: "weekly" },
        { path: "/circle", priority: "0.6", changefreq: "weekly" },
        { path: "/community-guidelines", priority: "0.3", changefreq: "monthly" },
        { path: "/terms", priority: "0.3", changefreq: "monthly" },
        { path: "/privacy", priority: "0.3", changefreq: "monthly" },
      ];

      const urls: string[] = [];
      for (const e of staticEntries) {
        urls.push(urlBlock(`${siteUrl}${e.path}`, today, e.changefreq, e.priority));
      }
      for (const p of profiles) {
        if (!p.full_name) continue;
        const lm = (p.updated_at || "").split("T")[0] || today;
        urls.push(urlBlock(`${siteUrl}/profile/${p.user_id}`, lm, "weekly", "0.8"));
        urls.push(urlBlock(`${siteUrl}/epk/${p.user_id}`, lm, "weekly", "0.7"));
      }
      for (const c of credits) {
        if (!c.project_name) continue;
        const lm = (c.updated_at || "").split("T")[0] || today;
        urls.push(urlBlock(`${siteUrl}/credits/project/${c.id}`, lm, "weekly", "0.7"));
      }

      const sitemap =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.join("\n") +
        `\n</urlset>\n`;
      writeFileSync(resolve(outDir, "sitemap.xml"), sitemap);

      console.log(
        `[seo-pages] Wrote ${profilePages} profile pages, ${creditPages} credit pages, sitemap with ${urls.length} URLs.`,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function writeStatic(outDir: string, relPath: string, html: string) {
  const full = resolve(outDir, relPath);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, html);
}

function urlBlock(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

interface PatchOptions {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  ogImage: string;
  ogImageAlt: string;
  jsonLd: unknown;
}

/**
 * Replace/insert per-page SEO tags inside the built dist/index.html head.
 * Keeps all script/link tags intact so the SPA still hydrates.
 */
function patchHead(baseHtml: string, o: PatchOptions): string {
  const t = escapeHtml(o.title);
  const d = escapeHtml(o.description);
  const url = escapeHtml(o.canonical);
  const img = escapeHtml(o.ogImage);
  const imgAlt = escapeHtml(o.ogImageAlt);
  const jsonLd = JSON.stringify(o.jsonLd).replace(/</g, "\\u003c");

  let html = baseHtml;

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`);

  // description
  html = html.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${d}" />`,
  );

  // canonical (replace any existing)
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${url}" />`,
    );
  } else {
    html = html.replace(/<\/head>/i, `<link rel="canonical" href="${url}" />\n</head>`);
  }

  // OG / Twitter — strip prior brand defaults then inject per-page set
  html = html.replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "");
  html = html.replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "");

  const seoBlock = `
    <meta property="og:type" content="${escapeHtml(o.ogType)}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="Kretopia" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:alt" content="${imgAlt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <script type="application/ld+json">${jsonLd}</script>
`;

  html = html.replace(/<\/head>/i, `${seoBlock}</head>`);

  return html;
}

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim() + "…";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
