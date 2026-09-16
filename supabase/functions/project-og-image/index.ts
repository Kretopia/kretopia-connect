// Dynamic Open Graph image for Kretopia Desk invite/share links.
// Returns 1200x630 PNG. Public — no JWT required.
//
// Usage: GET /functions/v1/project-og-image?project_id=<uuid>

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
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + "…";
  }
  return lines;
}

// Mood → accent gradient (mirrors src/lib/moodGradient.ts vibes)
const MOOD_GRADIENTS: Record<string, [string, string, string]> = {
  focused:  ["#0F1B3D", "#1E2D5C", "#0A0F26"],
  hyped:    ["#3A0E5C", "#5B1E8C", "#1A0530"],
  chill:    ["#0E2A3C", "#155A6C", "#06141C"],
  cinematic:["#1A0E2C", "#3D1F5C", "#0A0518"],
  neon:     ["#0E2A14", "#1F5C28", "#04140A"],
  warm:     ["#3D1A0E", "#6C3015", "#1C0904"],
  default:  ["#0F0B1F", "#1F1342", "#0A0815"],
};

function moodColors(mood: string | null): [string, string, string] {
  if (!mood) return MOOD_GRADIENTS.default;
  return MOOD_GRADIENTS[mood.toLowerCase()] || MOOD_GRADIENTS.default;
}

const WORKSPACE_LABELS: Record<string, string> = {
  general: "Project",
  event: "Event",
  music: "Music Release",
  music_release: "Music Release",
  podcast: "Podcast",
  content: "Content Studio",
  campaign: "Campaign",
  brand_campaign: "Campaign",
  photo: "Photo Project",
};

function buildSvg(opts: {
  title: string;
  workspaceLabel: string;
  inviterName: string | null;
  collaboratorCount: number;
  bg: [string, string, string];
}): string {
  const titleLines = wrapText(opts.title, 24, 3);
  const titleY = 230;
  const lineH = 84;
  const [c1, c2, c3] = opts.bg;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7B61FF"/>
      <stop offset="100%" stop-color="#5B6BF5"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Glow accents -->
  <circle cx="1080" cy="80" r="220" fill="#7B61FF" opacity="0.22"/>
  <circle cx="80" cy="600" r="260" fill="#5B6BF5" opacity="0.14"/>

  <!-- Brand row -->
  <text x="80" y="100" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="32" font-weight="800" fill="#ffffff">
    Kretopia
  </text>
  <text x="80" y="138" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="20" fill="#C6FF00" font-weight="600">
    ThriveDesk · ${escapeXml(opts.workspaceLabel)}
  </text>

  <!-- Eyebrow -->
  <text x="80" y="190" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="22" fill="#B8B8D4" font-weight="500" letter-spacing="2">
    YOU'RE INVITED TO COLLABORATE
  </text>

  <!-- Title -->
  ${titleLines.map((line, i) => `
  <text x="80" y="${titleY + i * lineH}" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="72" font-weight="800" fill="#ffffff">
    ${escapeXml(line)}
  </text>`).join("")}

  <!-- Inviter -->
  ${opts.inviterName ? `
  <text x="80" y="555" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="26" fill="#E0E0F0" font-weight="500">
    Invited by ${escapeXml(opts.inviterName)}
  </text>` : ""}
  ${opts.collaboratorCount > 0 ? `
  <text x="80" y="588" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="20" fill="#9090B0" font-weight="500">
    ${opts.collaboratorCount} ${opts.collaboratorCount === 1 ? "collaborator" : "collaborators"} on the project
  </text>` : ""}

  <!-- CTA pill -->
  <rect x="900" y="520" width="240" height="64" rx="32" fill="url(#accent)"/>
  <text x="1020" y="562" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff">
    Join Desk →
  </text>
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    if (!projectId) {
      return new Response(JSON.stringify({ error: "Missing project_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: project, error } = await supabase
      .from("projects")
      .select("title, mood, workspace_type, created_by")
      .eq("id", projectId)
      .maybeSingle();

    if (error || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let inviterName: string | null = null;
    if (project.created_by) {
      const { data: inviter } = await supabase
        .from("public_profiles_safe")
        .select("full_name")
        .eq("user_id", project.created_by)
        .maybeSingle();
      inviterName = inviter?.full_name || null;
    }

    const { count: collaboratorCount } = await supabase
      .from("project_collaborators")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "accepted");

    const svg = buildSvg({
      title: project.title || "Untitled Project",
      workspaceLabel: WORKSPACE_LABELS[project.workspace_type || "general"] || "Project",
      inviterName,
      collaboratorCount: collaboratorCount || 0,
      bg: moodColors(project.mood),
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
    console.error("project-og-image error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
