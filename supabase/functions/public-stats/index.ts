import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

// Internal accounts to exclude from public stats
const EXCLUDED_EMAILS = [
  "ethanauguste@hotmail.com",
  "ethan@thrivein.io",
  "test@thrivein.io",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Run all reads in parallel
    const [
      profilesCount,
      connectionsCount,
      creditsCount,
      gigsCount,
      eventsCount,
      circlesCount,
      projectsCount,
      locationsRes,
      rolesRes,
      wauRes,
      mauRes,
      dauRes,
    ] = await Promise.all([
      supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("onboarding_completed", true),
      supabase.from("connections").select("id", { count: "exact", head: true }).eq("status", "accepted"),
      supabase.from("credits").select("id", { count: "exact", head: true }),
      supabase.from("opportunities").select("id", { count: "exact", head: true }),
      supabase.from("creative_jams").select("id", { count: "exact", head: true }),
      supabase.from("spark_rooms").select("id", { count: "exact", head: true }),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("location").not("location", "is", null).neq("location", ""),
      supabase.from("profiles").select("role").not("role", "is", null).neq("role", ""),
      supabase.from("user_session_pings").select("user_id").gte("ping_date", sevenDaysAgo),
      supabase.from("user_session_pings").select("user_id").gte("ping_date", thirtyDaysAgo),
      supabase.from("user_session_pings").select("user_id").eq("ping_date", today),
    ]);

    // Featured creators: latest onboarded, prefer those with avatars + names.
    // Run separately so a slow query doesn't block stats.
    const { data: featuredRows } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .eq("onboarding_completed", true)
      .not("full_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);
    const featured = (featuredRows || [])
      .sort((a: any, b: any) => {
        const aHas = a.avatar_url ? 1 : 0;
        const bHas = b.avatar_url ? 1 : 0;
        return bHas - aHas;
      })
      .slice(0, 12);

    // Aggregate locations (top 6)
    const locCounts = new Map<string, number>();
    (locationsRes.data || []).forEach((row: any) => {
      const loc = String(row.location).trim();
      if (loc) locCounts.set(loc, (locCounts.get(loc) || 0) + 1);
    });
    const topLocations = Array.from(locCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([location, count]) => ({ location, count }));

    // Aggregate roles (top 8)
    const roleCounts = new Map<string, number>();
    (rolesRes.data || []).forEach((row: any) => {
      const r = String(row.role).trim();
      if (r) roleCounts.set(r, (roleCounts.get(r) || 0) + 1);
    });
    const topRoles = Array.from(roleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([role, count]) => ({ role, count }));

    // Country derivation from location strings
    const countrySet = new Set<string>();
    locCounts.forEach((_, loc) => {
      const parts = loc.split(",").map((s) => s.trim());
      const country = parts[parts.length - 1];
      if (country && country.length >= 2) countrySet.add(country);
    });

    const payload = {
      stats: {
        creators: profilesCount.count || 0,
        connections: connectionsCount.count || 0,
        credits: creditsCount.count || 0,
        gigs: gigsCount.count || 0,
        events: eventsCount.count || 0,
        circles: circlesCount.count || 0,
        projects: projectsCount.count || 0,
        countries: countrySet.size,
        dau: new Set((dauRes.data || []).map((r: any) => r.user_id)).size,
        wau: new Set((wauRes.data || []).map((r: any) => r.user_id)).size,
        mau: new Set((mauRes.data || []).map((r: any) => r.user_id)).size,
      },
      topLocations,
      topRoles,
      featured,
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
