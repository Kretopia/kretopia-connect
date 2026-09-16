import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Try slug first, then ID
  let { data: article } = await supabase
    .from("magazine_articles")
    .select("title, subtitle, cover_image_url, content, author_name, category, created_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!article) {
    const res = await supabase
      .from("magazine_articles")
      .select("title, subtitle, cover_image_url, content, author_name, category, created_at")
      .eq("id", slug)
      .eq("is_published", true)
      .maybeSingle();
    article = res.data;
  }

  if (!article) {
    return Response.redirect("https://www.kretopia.com/magazine", 302);
  }

  const canonicalUrl = `https://www.kretopia.com/magazine/${slug}`;
  const description = article.subtitle || (article.content?.slice(0, 155).replace(/[#*>\n]/g, "") + "...");
  const image = article.cover_image_url || "https://www.kretopia.com/og-image.png";
  const title = `${article.title} | Kretopia Magazine`;

  // Check if this is a bot/crawler
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const isCrawler = /whatsapp|facebookexternalhit|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|bot|crawler|spider|preview/i.test(userAgent);

  if (!isCrawler) {
    // Real user — redirect to the SPA
    return Response.redirect(canonicalUrl, 302);
  }

  // Crawler — serve HTML with OG tags
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(article.title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="Kretopia Magazine" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(article.title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <link rel="canonical" href="${canonicalUrl}" />
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(article.title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${canonicalUrl}">Read on Kretopia Magazine</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
