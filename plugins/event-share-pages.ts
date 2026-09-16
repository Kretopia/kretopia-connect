import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

interface EventSharePagesPluginOptions {
  projectUrl: string;
  publishableKey: string;
  siteUrl: string;
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_time: string;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  cover_image_url: string | null;
  is_ticketed: boolean | null;
  ticket_price: number | null;
  ticket_currency: string | null;
}

const FALLBACK_OG_IMAGE = "https://www.kretopia.com/og-image.png";

export function eventSharePagesPlugin(options: EventSharePagesPluginOptions): Plugin {
  return {
    name: "event-share-pages",
    apply: "build",
    async closeBundle() {
      if (!options.projectUrl || !options.publishableKey || !options.siteUrl) {
        console.warn("[event-share-pages] Missing configuration; skipping.");
        return;
      }

      const siteUrl = options.siteUrl.replace(/\/$/, "");
      const projectUrl = options.projectUrl.replace(/\/$/, "");
      const outDir = resolve(process.cwd(), "dist");

      const response = await fetch(
        `${projectUrl}/rest/v1/creative_jams?select=id,title,description,category,start_time,end_time,venue_name,venue_address,cover_image_url,is_ticketed,ticket_price,ticket_currency&status=eq.upcoming&order=start_time.asc&limit=200`,
        {
          headers: {
            apikey: options.publishableKey,
            Authorization: `Bearer ${options.publishableKey}`,
          },
        }
      );

      if (!response.ok) {
        console.warn(`[event-share-pages] Failed to fetch events: ${response.status}`);
        return;
      }

      const events = (await response.json()) as EventRow[];
      let count = 0;

      for (const event of events) {
        const shareDir = resolve(outDir, "share", "event", event.id);
        mkdirSync(shareDir, { recursive: true });
        writeFileSync(resolve(shareDir, "index.html"), buildEventShareHtml(event, siteUrl));
        count++;
      }

      console.log(`[event-share-pages] Generated ${count} event share page(s).`);
    },
  };
}

function buildEventShareHtml(event: EventRow, siteUrl: string) {
  const eventUrl = `${siteUrl}/event/${event.id}`;
  const shareUrl = `${siteUrl}/share/event/${event.id}/`;
  const title = `${event.title} | Kretopia`;

  const eventDate = new Date(event.start_time).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const eventTime = new Date(event.start_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const parts = [`📅 ${eventDate} at ${eventTime}`];
  if (event.venue_name) parts.push(`📍 ${event.venue_name}`);
  if (event.is_ticketed && event.ticket_price) {
    parts.push(`🎟️ ${event.ticket_currency || "$"}${event.ticket_price}`);
  } else {
    parts.push("🎟️ Free");
  }
  const subtitle = parts.join(" · ");

  const description = event.description
    ? `${subtitle} — ${truncate(event.description, 120)}`
    : `${subtitle} — RSVP now on Kretopia, the Creative OS.`;
  const ctaDescription = `${description} Join the creative community.`;
  // Prefer dynamic OG image (live attendee count) over static cover, fall back gracefully
  const projectRef = process.env.VITE_SUPABASE_PROJECT_ID || "kwmcocsitwssrtzkdojh";
  const dynamicOg = `https://${projectRef}.supabase.co/functions/v1/event-og-image?event_id=${event.id}`;
  const image = dynamicOg;
  const fallbackImage = event.cover_image_url || FALLBACK_OG_IMAGE;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(ctaDescription)}" />
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="${eventUrl}" />

    <meta property="og:type" content="event" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(ctaDescription)}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:site_name" content="Kretopia" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(event.title)} on Kretopia" />
    <meta property="og:image:secondary" content="${escapeHtml(fallbackImage)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(ctaDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />

    <meta http-equiv="refresh" content="0;url=${eventUrl}" />
    <script>window.location.replace(${JSON.stringify(eventUrl)});</script>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(event.title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
      <p>${escapeHtml(ctaDescription)}</p>
      <p><a href="${eventUrl}">RSVP on Kretopia</a></p>
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
