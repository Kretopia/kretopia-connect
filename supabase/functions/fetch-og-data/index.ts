import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SSRF protection: blocked hosts
const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0',
  '169.254.169.254', // AWS/GCP metadata
  '10.', '172.16.', '192.168.' // Private IP ranges
];

// Input validation schema
const RequestSchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          // Only allow HTTP(S)
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
          }
          // Block internal IPs
          return !BLOCKED_HOSTS.some(h => parsed.hostname.includes(h));
        } catch {
          return false;
        }
      },
      'Internal or invalid URLs not allowed'
    )
});

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawData = await req.json();
    const validationResult = RequestSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url } = validationResult.data;

    console.log("Fetching Open Graph data for:", url);

    // Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ThriveBot/1.0; +https://lovable.app)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract Open Graph tags
    const ogData: OpenGraphData = {};
    
    const extractMetaContent = (property: string): string | undefined => {
      // Try property attribute first (og: tags)
      const propertyRegex = new RegExp(
        `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`,
        "i"
      );
      const propertyMatch = html.match(propertyRegex);
      if (propertyMatch) return propertyMatch[1];
      
      // Try reverse order
      const reverseRegex = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`,
        "i"
      );
      const reverseMatch = html.match(reverseRegex);
      if (reverseMatch) return reverseMatch[1];
      
      // Try name attribute as fallback
      const nameRegex = new RegExp(
        `<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`,
        "i"
      );
      const nameMatch = html.match(nameRegex);
      if (nameMatch) return nameMatch[1];
      
      // Try reverse for name
      const nameReverseRegex = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`,
        "i"
      );
      const nameReverseMatch = html.match(nameReverseRegex);
      return nameReverseMatch ? nameReverseMatch[1] : undefined;
    };

    ogData.title = extractMetaContent("og:title") || extractMetaContent("twitter:title");
    ogData.description = extractMetaContent("og:description") || 
                        extractMetaContent("twitter:description") || 
                        extractMetaContent("description");
    ogData.image = extractMetaContent("og:image") || 
                  extractMetaContent("twitter:image") || 
                  extractMetaContent("twitter:image:src");
    ogData.url = extractMetaContent("og:url") || url;
    ogData.siteName = extractMetaContent("og:site_name") || extractMetaContent("twitter:site");
    ogData.type = extractMetaContent("og:type");

    // If no OG title found, try to extract from <title> tag
    if (!ogData.title) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) ogData.title = titleMatch[1].trim();
    }

    // If no description, try standard meta description
    if (!ogData.description) {
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
      if (descMatch) ogData.description = descMatch[1].trim();
    }
    
    // Try to find any image if still none
    if (!ogData.image) {
      const imgMatch = html.match(/<meta[^>]*content=["'](https?:\/\/[^"']*\.(jpg|jpeg|png|gif|webp)[^"']*)["']/i);
      if (imgMatch) ogData.image = imgMatch[1];
    }

    console.log("Extracted OG data:", JSON.stringify(ogData, null, 2));

    // Verify the domain for basic trust
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const isVerifiedDomain = [
      "imdb.com",
      "spotify.com",
      "youtube.com",
      "linkedin.com",
      "behance.net",
      "twitter.com",
      "x.com",
      "instagram.com",
      "forbes.com",
      "variety.com",
      "hollywoodreporter.com",
      "billboard.com",
      "rollingstone.com",
    ].some((d) => domain.includes(d));

    return new Response(
      JSON.stringify({
        success: true,
        data: ogData,
        isVerifiedDomain,
        domain,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching Open Graph data:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});