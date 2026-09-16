// Dynamic Open Graph image generator for Kretopia events.
// Returns a 1200x630 PNG suitable for WhatsApp / iMessage / Twitter / LinkedIn link previews.
// Public function — no JWT required (verify_jwt=false).
//
// Usage: GET /functions/v1/event-og-image?event_id=<uuid>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let wasmInitialized = false;
async function ensureWasm() {
  if (wasmInitialized) return;
  const wasmRes = await fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
  const wasmBuffer = await wasmRes.arrayBuffer();
  await initWasm(wasmBuffer);
  wasmInitialized = true;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxChars) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.length > lines.join(" ").split(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + "…";
  }
  return lines;
}

function buildSvg(opts: {
  title: string;
  dateStr: string;
  venue: string | null;
  hostName: string | null;
  attendeeCount: number;
  isTicketed: boolean;
  priceLabel: string | null;
}): string {
  const titleLines = wrapText(opts.title, 28, 3);
  const titleY = 200;
  const lineH = 80;

  const meta: string[] = [];
  meta.push(`📅 ${opts.dateStr}`);
  if (opts.venue) meta.push(`📍 ${opts.venue.length > 40 ? opts.venue.slice(0, 37) + "…" : opts.venue}`);
  if (opts.attendeeCount > 0) meta.push(`👥 ${opts.attendeeCount} going`);

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F0B1F"/>
      <stop offset="50%" stop-color="#1F1342"/>
      <stop offset="100%" stop-color="#0A0815"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7B61FF"/>
      <stop offset="100%" stop-color="#5B6BF5"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Glow accents -->
  <circle cx="1050" cy="80" r="180" fill="#7B61FF" opacity="0.18"/>
  <circle cx="100" cy="600" r="220" fill="#5B6BF5" opacity="0.12"/>

  <!-- Kretopia brand -->
  <text x="80" y="100" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="32" font-weight="800" fill="#ffffff">
    Kretopia
  </text>
  <text x="80" y="135" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="20" fill="#C6FF00" font-weight="600">
    The Creative OS · IRL Event
  </text>

  <!-- Title -->
  ${titleLines.map((line, i) => `
  <text x="80" y="${titleY + i * lineH}" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="68" font-weight="800" fill="#ffffff">
    ${escapeXml(line)}
  </text>`).join("")}

  <!-- Meta block -->
  <g transform="translate(80, ${titleY + titleLines.length * lineH + 40})">
    ${meta.map((m, i) => `
    <text x="0" y="${i * 50}" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="32" fill="#E0E0F0" font-weight="500">
      ${escapeXml(m)}
    </text>`).join("")}
  </g>

  <!-- Host -->
  ${opts.hostName ? `
  <text x="80" y="560" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="24" fill="#9090B0" font-weight="500">
    Hosted by ${escapeXml(opts.hostName)}
  </text>` : ""}

  <!-- CTA pill -->
  <rect x="900" y="520" width="240" height="64" rx="32" fill="url(#accent)"/>
  <text x="1020" y="562" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff">
    ${opts.isTicketed && opts.priceLabel ? opts.priceLabel : "RSVP free"}
  </text>
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("event_id");
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: event, error } = await supabase
      .from("creative_jams")
      .select("title, start_time, venue_name, is_ticketed, ticket_price, ticket_currency, created_by")
      .eq("id", eventId)
      .eq("is_public", true)
      .maybeSingle();

    if (error || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let hostName: string | null = null;
    if (event.created_by) {
      const { data: host } = await supabase
        .from("public_profiles_safe")
        .select("full_name")
        .eq("user_id", event.created_by)
        .maybeSingle();
      hostName = host?.full_name || null;
    }

    const { count: attendeeCount } = await supabase
      .from("jam_participants")
      .select("id", { count: "exact", head: true })
      .eq("jam_id", eventId)
      .in("status", ["going", "interested"]);

    const date = new Date(event.start_time);
    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) + " · " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const sym = event.ticket_currency === "EUR" ? "€" : event.ticket_currency === "GBP" ? "£" : event.ticket_currency === "TTD" ? "TT$" : "$";
    const priceLabel = event.is_ticketed && event.ticket_price ? `${sym}${event.ticket_price}` : null;

    const svg = buildSvg({
      title: event.title || "Event",
      dateStr,
      venue: event.venue_name || null,
      hostName,
      attendeeCount: attendeeCount || 0,
      isTicketed: !!event.is_ticketed,
      priceLabel,
    });

    await ensureWasm();
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
    const png = resvg.render().asPng();

    return new Response(png, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("event-og-image error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
