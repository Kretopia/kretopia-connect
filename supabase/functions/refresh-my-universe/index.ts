// "Refresh my universe" — incremental discovery of new credits, press, awards
// and platform uploads for an existing creator. Reuses search-credits-web for
// the heavy web search, then classifies + dedupes + queues to pending_discoveries.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Kind = "credit" | "press" | "award" | "upload";

const PRESS_DOMAINS = [
  "rollingstone", "billboard", "pitchfork", "complex", "thefader",
  "vogue", "gq", "wmagazine", "harpersbazaar", "hypebeast", "highsnobiety",
  "nytimes", "guardian", "bbc", "cnn", "forbes", "fastcompany", "wired",
  "variety", "hollywoodreporter", "deadline", "indiewire",
  "okayplayer", "djmag", "mixmag", "residentadvisor", "ra.co",
  "creativereview", "itsnicethat", "designboom", "dezeen",
  "medium.com", "substack.com",
];

const AWARD_KEYWORDS = [
  "award", "winner", "won", "nominee", "nominated", "shortlist",
  "grammy", "oscar", "emmy", "bafta", "cannes", "sundance",
  "billboard music award", "mtv", "iheartradio", "ama ", "brit award",
  "golden globe", "tony", "pulitzer", "webby", "cleo", "addy",
];

const CREDIT_PLATFORM_RX =
  /(imdb\.com\/name|imdb\.com\/title|muso\.ai|discogs\.com|allmusic\.com|themoviedb\.org|behance\.net|dribbble\.com|spotify\.com\/(?:track|album)|music\.apple\.com\/.+\/(?:album|song))/i;

// Social/own-profile domains — never surface as discoveries (already linked via connected_platforms)
const SOCIAL_PROFILE_RX =
  /(instagram\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|linkedin\.com\/in|threads\.net|snapchat\.com|pinterest\.com)/i;

function classifyKind(url: string, title: string, excerpt: string): Kind | null {
  const u = url.toLowerCase();
  const t = `${title} ${excerpt}`.toLowerCase();

  // Skip social profile pages — these belong in connected platforms, not discoveries
  if (SOCIAL_PROFILE_RX.test(u)) return null;

  // Awards win on any signal
  if (AWARD_KEYWORDS.some((k) => t.includes(k))) return "award";

  // Credits: known credit registries / release pages
  if (CREDIT_PLATFORM_RX.test(u)) return "credit";

  // Uploads: video/audio platforms (channel-owned content)
  if (/youtube\.com\/watch|youtu\.be\/|vimeo\.com\/\d+|soundcloud\.com\/[^/]+\/[^/]+/.test(u)) {
    return "upload";
  }

  // Press: editorial domains
  if (PRESS_DOMAINS.some((d) => u.includes(d))) return "press";

  // Fallback: title/excerpt mentions interview/feature -> press
  // ('profile' removed — too noisy, matched social profile descriptions)
  if (/\b(interview|featured in|premiere|reviewed by)\b/i.test(t)) return "press";

  return null; // skip — too ambiguous
}

function safeDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function dedupeKey(kind: Kind, url: string) {
  // Strip query strings + trailing slashes for stable identity
  const stripped = url.split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase();
  return `${kind}::${stripped}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: support either user JWT or service-role + x-cron-user-id header
    const cronUserId = req.headers.get("x-cron-user-id");
    const authHeader = req.headers.get("Authorization") || "";
    let userId: string | null = null;

    if (cronUserId && authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
      userId = cronUserId;
    } else {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const triggerSource: string = body?.trigger_source || "manual";

    // 1. Load profile + existing identity signals
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, full_name, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.full_name) {
      return new Response(JSON.stringify({ error: "Add your name to your profile first" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create scan row
    const { data: scan, error: scanErr } = await admin
      .from("discovery_scans")
      .insert({
        user_id: userId,
        status: "running",
        trigger_source: triggerSource,
        query_used: profile.full_name,
      })
      .select()
      .single();
    if (scanErr) throw scanErr;

    // 3. Pre-load existing identifiers for dedupe
    const [creditsRes, awardsRes, pressRes, pendingRes] = await Promise.all([
      admin.from("credits").select("verification_url, source_url, project_name").eq("user_id", userId),
      admin.from("awards").select("verification_url, title, organization").eq("user_id", userId),
      // press_links lives on profiles JSONB in this project; treat as best-effort dedupe via URL only
      admin.from("profiles").select("press_links").eq("user_id", userId).maybeSingle(),
      admin.from("pending_discoveries").select("dedupe_key").eq("user_id", userId),
    ]);

    const knownUrls = new Set<string>();
    const pushUrl = (u: string | null | undefined) => {
      if (!u) return;
      const s = u.split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase();
      knownUrls.add(s);
    };
    creditsRes.data?.forEach((c: any) => { pushUrl(c.verification_url); pushUrl(c.source_url); });
    awardsRes.data?.forEach((a: any) => pushUrl(a.verification_url));
    const pressLinks = (pressRes.data as any)?.press_links;
    if (Array.isArray(pressLinks)) pressLinks.forEach((p: any) => pushUrl(typeof p === "string" ? p : p?.url));
    const knownPendingKeys = new Set((pendingRes.data || []).map((p: any) => p.dedupe_key));

    // 4. Run the existing search engine
    let candidates: any[] = [];
    try {
      const searchRes = await fetch(`${SUPABASE_URL}/functions/v1/search-credits-web`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ query: profile.full_name }),
      });
      if (searchRes.ok) {
        const json = await searchRes.json();
        candidates = json?.results || [];
      } else {
        console.warn("search-credits-web non-OK", searchRes.status);
      }
    } catch (e) {
      console.error("search-credits-web call failed", e);
    }

    // 5. Classify + dedupe + insert
    const counts = { credit: 0, press: 0, award: 0, upload: 0 };
    const skipped = { already_on_profile: 0, social_or_ambiguous: 0, already_pending: 0, no_url: 0 };
    const inserts: any[] = [];

    for (const c of candidates) {
      const url: string = c?.url || c?.source_url || "";
      if (!url) { skipped.no_url += 1; continue; }
      const norm = url.split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase();
      if (knownUrls.has(norm)) { skipped.already_on_profile += 1; continue; }

      const title: string = c?.title || c?.project_name || "Untitled";
      const excerpt: string = c?.description || c?.excerpt || "";
      const kind = classifyKind(url, title, excerpt);
      if (!kind) { skipped.social_or_ambiguous += 1; continue; }

      const key = dedupeKey(kind, url);
      if (knownPendingKeys.has(key)) { skipped.already_pending += 1; continue; }
      knownPendingKeys.add(key);

      counts[kind] += 1;
      inserts.push({
        user_id: userId,
        scan_id: scan.id,
        kind,
        title: title.slice(0, 280),
        source_url: url,
        source_domain: safeDomain(url),
        thumbnail_url: c?.image_url || c?.thumbnail_url || null,
        excerpt: excerpt.slice(0, 700),
        payload: c,
        dedupe_key: key,
      });
    }

    if (inserts.length) {
      // Chunk to avoid payload limits
      for (let i = 0; i < inserts.length; i += 50) {
        await admin.from("pending_discoveries").insert(inserts.slice(i, i + 50));
      }
    }

    // 6. Finalize scan + bump profile timestamp
    await admin.from("discovery_scans").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      total_candidates: candidates.length,
      new_credits: counts.credit,
      new_press: counts.press,
      new_awards: counts.award,
      new_uploads: counts.upload,
    }).eq("id", scan.id);

    await admin.from("profiles").update({
      last_universe_scan_at: new Date().toISOString(),
    }).eq("user_id", userId);

    // 7. Notify the creator (in-app + push + email) when there's something new
    const totalNew = counts.credit + counts.press + counts.award + counts.upload;
    if (totalNew > 0) {
      try {
        const parts: string[] = [];
        if (counts.credit) parts.push(`${counts.credit} credit${counts.credit === 1 ? "" : "s"}`);
        if (counts.press) parts.push(`${counts.press} press`);
        if (counts.award) parts.push(`${counts.award} award${counts.award === 1 ? "" : "s"}`);
        if (counts.upload) parts.push(`${counts.upload} upload${counts.upload === 1 ? "" : "s"}`);
        const summary = parts.join(" · ");
        const title = `${totalNew} new item${totalNew === 1 ? "" : "s"} to review`;
        const message = `We found ${summary} that look like yours. Tap to review.`;
        const link = "/?openPendingDiscoveries=1";

        // In-app notification (drives realtime bell + toast via useNotifications)
        await admin.from("notifications").insert({
          user_id: userId,
          title,
          message,
          type: "discovery",
          category: "discovery",
          priority: "normal",
          link,
          action_url: link,
          action_text: "Review findings",
          read: false,
        });

        // Push notification (best effort)
        admin.functions.invoke("send-push-notification", {
          body: {
            userId,
            title,
            body: message,
            tag: "universe-scan",
            data: { type: "discovery", link, scanId: scan.id },
          },
        }).catch((e) => console.error("push notify failed", e));

        // Email notification (best effort) — skipped for manual scans to avoid noise
        if (triggerSource !== "manual") {
          const { data: userRow } = await admin.auth.admin.getUserById(userId);
          const recipientEmail = userRow?.user?.email;
          if (recipientEmail) {
            admin.functions.invoke("send-transactional-email", {
              body: {
                templateName: "universe-scan-findings",
                recipientEmail,
                idempotencyKey: `universe-scan-${scan.id}`,
                templateData: {
                  name: profile.full_name?.split(" ")[0],
                  newCredits: counts.credit,
                  newPress: counts.press,
                  newAwards: counts.award,
                  newUploads: counts.upload,
                  reviewUrl: `https://www.thrivein.io${link}`,
                },
              },
            }).catch((e) => console.error("email notify failed", e));
          }
        }
      } catch (notifyErr) {
        console.error("notification fan-out failed", notifyErr);
      }
    }


    return new Response(JSON.stringify({
      success: true,
      scan_id: scan.id,
      total_candidates: candidates.length,
      new_credits: counts.credit,
      new_press: counts.press,
      new_awards: counts.award,
      new_uploads: counts.upload,
      total_new: counts.credit + counts.press + counts.award + counts.upload,
      skipped,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("refresh-my-universe error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
