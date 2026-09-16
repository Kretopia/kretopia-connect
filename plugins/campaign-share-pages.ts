import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

interface CampaignSharePagesPluginOptions {
  projectUrl: string;
  publishableKey: string;
  siteUrl: string;
}

interface CampaignRow {
  slug: string;
  title: string;
  tagline: string | null;
  story: string | null;
  category: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  total_raised: number;
  backer_count: number;
  currency: string;
  deadline: string;
  status: string;
}

const FALLBACK_OG_IMAGE = "https://www.kretopia.com/og-image.png";

export function campaignSharePagesPlugin(options: CampaignSharePagesPluginOptions): Plugin {
  return {
    name: "campaign-share-pages",
    apply: "build",
    async closeBundle() {
      if (!options.projectUrl || !options.publishableKey || !options.siteUrl) {
        console.warn("[campaign-share-pages] Missing configuration; skipping.");
        return;
      }

      const siteUrl = options.siteUrl.replace(/\/$/, "");
      const projectUrl = options.projectUrl.replace(/\/$/, "");
      const outDir = resolve(process.cwd(), "dist");

      const response = await fetch(
        `${projectUrl}/rest/v1/campaigns?select=slug,title,tagline,story,category,cover_image_url,goal_amount,total_raised,backer_count,currency,deadline,status&status=in.(active,funded)&order=created_at.desc&limit=300`,
        {
          headers: {
            apikey: options.publishableKey,
            Authorization: `Bearer ${options.publishableKey}`,
          },
        }
      );

      if (!response.ok) {
        console.warn(`[campaign-share-pages] Failed to fetch campaigns: ${response.status}`);
        return;
      }

      const campaigns = (await response.json()) as CampaignRow[];
      let count = 0;

      for (const c of campaigns) {
        if (!c.slug) continue;
        const shareDir = resolve(outDir, "share", "fund", c.slug);
        mkdirSync(shareDir, { recursive: true });
        writeFileSync(resolve(shareDir, "index.html"), buildCampaignShareHtml(c, siteUrl));
        count++;
      }

      console.log(`[campaign-share-pages] Generated ${count} campaign share page(s).`);
    },
  };
}

function buildCampaignShareHtml(c: CampaignRow, siteUrl: string) {
  const campaignUrl = `${siteUrl}/fund/${c.slug}`;
  const shareUrl = `${siteUrl}/share/fund/${c.slug}/`;
  const title = `${c.title} | ThriveFund on Kretopia`;

  const pct = c.goal_amount > 0 ? Math.round((c.total_raised / c.goal_amount) * 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const goalFormatted = formatMoney(c.goal_amount, c.currency);

  const stat = c.status === "funded"
    ? `🎉 Funded · ${goalFormatted} raised · ${c.backer_count} backers`
    : `${pct}% funded · ${goalFormatted} goal · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;

  const tagline = c.tagline?.trim() || (c.story ? truncate(c.story, 120) : "Back this creative project on Kretopia Fund.");
  const description = `${stat} — ${tagline}`;
  const ctaDescription = `${description} Pledge on Kretopia, the Creative OS — only charged if it funds.`;
  const image = c.cover_image_url || FALLBACK_OG_IMAGE;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(ctaDescription)}" />
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="${campaignUrl}" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(ctaDescription)}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:site_name" content="Kretopia" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(ctaDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />

    <meta http-equiv="refresh" content="0;url=${campaignUrl}" />
    <script>window.location.replace(${JSON.stringify(campaignUrl)});</script>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(c.title)}</h1>
      <p>${escapeHtml(stat)}</p>
      <p>${escapeHtml(tagline)}</p>
      <p><a href="${campaignUrl}">Back this campaign on Kretopia</a></p>
    </main>
  </body>
</html>`;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString()}`;
  }
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
