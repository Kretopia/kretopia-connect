// Public-safe link metadata fetcher.
// Given a URL, detects provider and returns { title, thumbnail, provider }.
// Uses HEAD/GET on the page itself, parses OpenGraph + provider hints.
// Note: CORS open; called from authed clients only. No user data is stored.

import { safeFetch } from "../_shared/ssrf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROVIDERS: Array<{ test: RegExp; name: string }> = [
  { test: /(^|\.)docs\.google\.com/i, name: "Google Docs" },
  { test: /(^|\.)sheets\.google\.com/i, name: "Google Sheets" },
  { test: /(^|\.)slides\.google\.com/i, name: "Google Slides" },
  { test: /(^|\.)drive\.google\.com/i, name: "Google Drive" },
  { test: /(^|\.)dropbox\.com/i, name: "Dropbox" },
  { test: /(^|\.)notion\.(so|site)/i, name: "Notion" },
  { test: /(^|\.)figma\.com/i, name: "Figma" },
  { test: /(^|\.)miro\.com/i, name: "Miro" },
  { test: /(^|\.)youtube\.com|(^|\.)youtu\.be/i, name: "YouTube" },
  { test: /(^|\.)vimeo\.com/i, name: "Vimeo" },
  { test: /(^|\.)loom\.com/i, name: "Loom" },
  { test: /(^|\.)spotify\.com/i, name: "Spotify" },
  { test: /(^|\.)soundcloud\.com/i, name: "SoundCloud" },
  { test: /(^|\.)pinterest\.com/i, name: "Pinterest" },
  { test: /(^|\.)behance\.net/i, name: "Behance" },
  { test: /(^|\.)dribbble\.com/i, name: "Dribbble" },
  { test: /(^|\.)instagram\.com/i, name: "Instagram" },
  { test: /(^|\.)tiktok\.com/i, name: "TikTok" },
  { test: /(^|\.)canva\.com/i, name: "Canva" },
  { test: /(^|\.)airtable\.com/i, name: "Airtable" },
];

const detectProvider = (url: URL): string => {
  for (const p of PROVIDERS) if (p.test.test(url.hostname)) return p.name;
  return url.hostname.replace(/^www\./, "");
};

const extractMeta = (html: string, names: string[]): string | null => {
  for (const name of names) {
    // <meta property="og:title" content="...">
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
    // reverse order
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return m2[1].trim();
  }
  return null;
};

const extractTitleTag = (html: string): string | null => {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() || null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { url: raw } = await req.json();
    if (!raw || typeof raw !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^https?:$/.test(url.protocol)) {
      return new Response(JSON.stringify({ error: "Only http(s) URLs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = detectProvider(url);
    let title: string | null = null;
    let thumbnail: string | null = null;

    // YouTube fast path: oEmbed (no scraping flakiness)
    if (provider === "YouTube") {
      try {
        const oembed = await fetch(
          `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`,
        );
        if (oembed.ok) {
          const j = await oembed.json();
          title = j.title || null;
          thumbnail = j.thumbnail_url || null;
        }
      } catch {
        // fall back to OG below
      }
    }

    if (!title || !thumbnail) {
      try {
        const { response: res } = await safeFetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; Kretopia-LinkPreview/1.0; +https://kretopia.com)",
            Accept: "text/html,application/xhtml+xml",
          },
        }, { maxRedirects: 3, timeoutMs: 8000 });
        if (res.ok) {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("text/html")) {
            const html = (await res.text()).slice(0, 200_000);
            title =
              title ||
              extractMeta(html, ["og:title", "twitter:title"]) ||
              extractTitleTag(html);
            thumbnail =
              thumbnail ||
              extractMeta(html, ["og:image", "twitter:image", "twitter:image:src"]);
          }
        }
      } catch {
        // ignore — we still return provider + url
      }
    }

    // Fallback title = path tail
    if (!title) {
      const tail = decodeURIComponent(
        url.pathname.split("/").filter(Boolean).pop() || url.hostname,
      );
      title = tail.replace(/[-_]+/g, " ").slice(0, 120);
    }

    return new Response(
      JSON.stringify({ title, thumbnail, provider, url: url.toString() }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
