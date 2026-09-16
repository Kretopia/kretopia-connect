import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE = "https://www.kretopia.com";
const FALLBACK_OG_IMAGE = `${SITE}/og-image.png`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Support both ?slug=... and trailing path /og-campaign/<slug>
  let slug = url.searchParams.get("slug");
  if (!slug) {
    const parts = url.pathname.split("/").filter(Boolean);
    slug = parts[parts.length - 1] || null;
    if (slug === "og-campaign") slug = null;
  }

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: c } = await supabase
    .from("campaigns")
    .select("slug,title,tagline,story,cover_image_url,goal_amount,total_raised,backer_count,currency,deadline,status")
    .eq("slug", slug)
    .maybeSingle();

  const canonicalUrl = `${SITE}/fund/${slug}`;

  if (!c) {
    return Response.redirect(`${SITE}/fund`, 302);
  }

  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const isCrawler = /whatsapp|facebookexternalhit|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|pinterest|redditbot|embedly|quora|bot|crawler|spider|preview/i.test(userAgent);

  if (!isCrawler) {
    return Response.redirect(canonicalUrl, 302);
  }

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
  const title = `${c.title} | Kretopia Fund on Kretopia`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(ctaDescription)}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(ctaDescription)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="Kretopia" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(ctaDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <link rel="canonical" href="${canonicalUrl}" />
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(c.title)}</h1>
  <p>${escapeHtml(stat)}</p>
  <p>${escapeHtml(tagline)}</p>
  <a href="${canonicalUrl}">Back this campaign on Kretopia</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});

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
