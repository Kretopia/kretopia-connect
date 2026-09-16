// Drafts a personalized cover letter for a scouted gig using profile + EPK.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const auth = req.headers.get("Authorization") || "";
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { scouted_gig_id } = await req.json();
    const [{ data: gig }, { data: profile }] = await Promise.all([
      supabase.from("scouted_gigs")
        .select("title, company, description, compensation, location, skills, fit_reason")
        .eq("id", scouted_gig_id).eq("target_user_id", user.id).maybeSingle(),
      supabase.from("profiles")
        .select("full_name, role, sub_roles, professional_skills, passion_skills, bio, location, username")
        .eq("user_id", user.id).maybeSingle(),
    ]);
    if (!gig || !profile) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const epkUrl = `https://www.kretopia.com/${profile.username || user.id}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write short, warm, confident cover letters for creatives. 120-180 words. No fluff. End with the EPK link. First-person, no emojis, no clichés." },
          { role: "user", content: `GIG: ${gig.title} at ${gig.company || "the company"}.
DESCRIPTION: ${gig.description || ""}
COMP: ${gig.compensation || "n/a"}
LOCATION: ${gig.location || "n/a"}
WHY THEY MATCH: ${gig.fit_reason || ""}

CREATOR: ${profile.full_name}, ${profile.role}${profile.sub_roles?.length ? ` (${profile.sub_roles.join(", ")})` : ""}
SKILLS: ${[...(profile.professional_skills || []), ...(profile.passion_skills || [])].join(", ")}
BASED IN: ${profile.location || ""}
BIO: ${profile.bio || ""}
EPK: ${epkUrl}

Draft the letter now.` },
        ],
      }),
    });
    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI failed");
    }
    const j = await r.json();
    const cover_letter = j.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ cover_letter, epk_url: epkUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
