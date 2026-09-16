import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

interface GigSharePagesPluginOptions {
  projectUrl: string;
  publishableKey: string;
  siteUrl: string;
}

interface GigRow {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  compensation: string | null;
  location: string | null;
  image_url: string | null;
}

const FALLBACK_OG_IMAGE = "https://www.kretopia.com/og-image.png";

export function gigSharePagesPlugin(options: GigSharePagesPluginOptions): Plugin {
  return {
    name: "gig-share-pages",
    apply: "build",
    async closeBundle() {
      if (!options.projectUrl || !options.publishableKey || !options.siteUrl) {
        console.warn("[gig-share-pages] Missing configuration; skipping.");
        return;
      }

      const siteUrl = options.siteUrl.replace(/\/$/, "");
      const projectUrl = options.projectUrl.replace(/\/$/, "");
      const outDir = resolve(process.cwd(), "dist");

      const response = await fetch(
        `${projectUrl}/rest/v1/opportunities?select=id,title,description,type,compensation,location,image_url&status=eq.active&order=created_at.desc&limit=100`,
        {
          headers: {
            apikey: options.publishableKey,
            Authorization: `Bearer ${options.publishableKey}`,
          },
        }
      );

      if (!response.ok) {
        console.warn(`[gig-share-pages] Failed to fetch gigs: ${response.status}`);
        return;
      }

      const gigs = (await response.json()) as GigRow[];
      let count = 0;

      for (const gig of gigs) {
        const shareDir = resolve(outDir, "share", "gig", gig.id);
        mkdirSync(shareDir, { recursive: true });
        writeFileSync(resolve(shareDir, "index.html"), buildGigShareHtml(gig, siteUrl));
        count++;
      }

      console.log(`[gig-share-pages] Generated ${count} gig share page(s).`);
    },
  };
}

function buildGigShareHtml(gig: GigRow, siteUrl: string) {
  const gigUrl = `${siteUrl}/opportunity/${gig.id}`;
  const shareUrl = `${siteUrl}/share/gig/${gig.id}/`;
  const title = `${gig.title} | Kretopia`;
  const typeLabel = gig.type === "barter" ? "Barter" : gig.type === "collab" ? "Collab" : "Paid Gig";
  const parts = [typeLabel];
  if (gig.location) parts.push(gig.location);
  if (gig.compensation) parts.push(gig.compensation);
  const subtitle = parts.join(" · ");
  const description = gig.description
    ? `${subtitle} — ${truncate(gig.description, 120)}`
    : `${subtitle} — Apply now on Kretopia, the Creative OS for professionals.`;
  const ctaDescription = `${description} Browse opportunities and apply directly.`;
  const image = gig.image_url || FALLBACK_OG_IMAGE;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(ctaDescription)}" />
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="${gigUrl}" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(ctaDescription)}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:site_name" content="Kretopia" />
    <meta property="og:image" content="${escapeHtml(image)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(ctaDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />

    <meta http-equiv="refresh" content="0;url=${gigUrl}" />
    <script>window.location.replace(${JSON.stringify(gigUrl)});</script>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(gig.title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
      <p>${escapeHtml(ctaDescription)}</p>
      <p><a href="${gigUrl}">Apply now on Kretopia</a></p>
    </main>
  </body>
</html>`;
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
