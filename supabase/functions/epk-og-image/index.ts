// Dynamic Open Graph image generator for Kretopia EPKs.
// Returns a 1200x630 PNG (avatar + name + role + verified credits + Kretopia mark)
// for WhatsApp / iMessage / Twitter / LinkedIn link unfurls.
// Public function — verify_jwt=false.
//
// Usage: GET /functions/v1/epk-og-image?user_id=<uuid>

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
  await initWasm(await wasmRes.arrayBuffer());
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

async function fetchAvatarDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function buildSvg(opts: {
  name: string;
  role: string;
  location: string | null;
  creditsCount: number;
  verified: boolean;
  avatarDataUri: string | null;
}): string {
  const initials = opts.name.split(/\s+/).map((p) => p[0] || "").slice(0, 2).join("").toUpperCase() || "·";
  const roleStr = opts.role.length > 38 ? opts.role.slice(0, 35) + "…" : opts.role;
  const nameStr = opts.name.length > 24 ? opts.name.slice(0, 23) + "…" : opts.name;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F0B1F"/>
      <stop offset="55%" stop-color="#1F1342"/>
      <stop offset="100%" stop-color="#0A0815"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7B61FF"/>
      <stop offset="100%" stop-color="#5B6BF5"/>
    </linearGradient>
    <clipPath id="avatarClip">
      <circle cx="280" cy="315" r="170"/>
    </clipPath>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="80" r="200" fill="#7B61FF" opacity="0.18"/>
  <circle cx="80" cy="600" r="220" fill="#5B6BF5" opacity="0.12"/>

  <!-- Brand -->
  <text x="80" y="100" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="32" font-weight="800" fill="#ffffff">Kretopia</text>
  <text x="80" y="135" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="20" fill="#C6FF00" font-weight="600">Verified Creative EPK</text>

  <!-- Avatar ring -->
  <circle cx="280" cy="315" r="178" fill="url(#accent)"/>
  <circle cx="280" cy="315" r="172" fill="#0A0815"/>
  ${opts.avatarDataUri
    ? `<image href="${opts.avatarDataUri}" x="110" y="145" width="340" height="340" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
    : `<circle cx="280" cy="315" r="170" fill="#1F1342"/>
       <text x="280" y="345" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="120" font-weight="800" fill="#ffffff">${escapeXml(initials)}</text>`}

  <!-- Verified tick -->
  ${opts.verified ? `
  <circle cx="400" cy="445" r="34" fill="#5B6BF5" stroke="#0A0815" stroke-width="6"/>
  <path d="M384 445 l12 12 l22 -24" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ""}

  <!-- Name + role -->
  <text x="500" y="270" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="64" font-weight="800" fill="#ffffff">${escapeXml(nameStr)}</text>
  <text x="500" y="320" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="32" font-weight="600" fill="#C6FF00">${escapeXml(roleStr)}</text>

  ${opts.location ? `
  <text x="500" y="368" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#9090B0">${escapeXml(opts.location)}</text>` : ""}

  <!-- Credits chip -->
  ${opts.creditsCount > 0 ? `
  <rect x="500" y="400" width="${120 + String(opts.creditsCount).length * 18}" height="56" rx="28" fill="#1F1342" stroke="#5B6BF5" stroke-width="2"/>
  <text x="${528}" y="436" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="700" fill="#ffffff">${opts.creditsCount} verified credit${opts.creditsCount === 1 ? "" : "s"}</text>` : ""}

  <!-- Footer -->
  <text x="500" y="540" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="#9090B0">View EPK · credits · rates · contact</text>

  <!-- CTA pill -->
  <rect x="900" y="510" width="220" height="64" rx="32" fill="url(#accent)"/>
  <text x="1010" y="552" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="700" fill="#ffffff">kretopia.com</text>
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await supabase
      .from("public_profiles_safe")
      .select("full_name, role, avatar_url, location, verification_tier")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: creditsCount } = await supabase
      .from("credits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const avatarDataUri = await fetchAvatarDataUri(profile.avatar_url);

    const svg = buildSvg({
      name: profile.full_name || "Creative Professional",
      role: profile.role || "Creative",
      location: profile.location || null,
      creditsCount: creditsCount || 0,
      verified: !!profile.verification_tier && profile.verification_tier !== "none",
      avatarDataUri,
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
  } catch (err: any) {
    console.error("epk-og-image error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
