// Smart Gig Scout — finds REAL external gigs for one creator.
//
// Sources, cheapest first:
//   1. Public job feeds (Remote OK, We Work Remotely, Jobicy, Arbeitnow). No key,
//      free, fresh to the hour, scored deterministically against the profile.
//   2. Firecrawl web search across gig boards, ATS, LinkedIn public pages and
//      Instagram casting hashtags. Needs FIRECRAWL_API_KEY. Manual/cron runs only.
//   3. AI extraction of those Firecrawl pages. Needs LOVABLE_API_KEY and credit;
//      without either, the same pages go through the deterministic scorer.
//
// No key is required for Scout to work. It used to answer HTTP 500 "Scout not
// configured" when FIRECRAWL_API_KEY or LOVABLE_API_KEY was missing, which also
// made the daily cron fail for every user. Missing pieces now degrade the scan
// (and are reported in `degraded`) instead of killing it.
//
// Triggers: "manual" (Scan now), "cron" (daily job), "live" (background refresh
// while Scout is open: feeds only, throttled, spends nothing).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { PREMIUM_ENFORCED } from "../_shared/premiumSwitch.ts";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import {
  dedupeKey,
  firecrawlToCandidate,
  isEligible,
  isGenericListingUrl,
  loadPublicFeeds,
  profileBlob,
  rankCandidates,
  toTextList,
  type ScoredCandidate,
  type ScoutCandidate,
  type ScoutPrefsLite,
  type ScoutProfile,
  type ScoutSource,
} from "../_shared/scoutSources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL = "https://api.firecrawl.dev/v2/search";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A background "live" refresh never runs twice within this window per user. */
const LIVE_MIN_GAP_MS = 2 * 60_000;
/** Stop launching new Firecrawl batches after this long; the edge runtime has a wall clock. */
const FIRECRAWL_BUDGET_MS = 55_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// True only for the daily cron job, which proves itself with the shared
// x-cron-secret header (same secret requireAdminOrCron checks in the other
// cron-called functions). Constant-time comparison.
function isCronRequest(req: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET");
  const given = req.headers.get("x-cron-secret");
  if (!expected || !given || expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// Whose Scout run is this? The request body is attacker-controlled, so a
// body.user_id must never be trusted on its own: it used to be accepted from
// anyone holding the public anon key, letting them trigger (and spend the
// Firecrawl / AI budget of) a run for any user. A signed-in user can only scout
// for themselves; acting for another user is reserved for the cron job.
function resolveActingUser(
  bodyUserId: unknown,
  jwtUserId: string | null,
  viaCron: boolean,
): { ok: true; userId: string } | { ok: false; status: number; error: string } {
  const requested = typeof bodyUserId === "string" && bodyUserId ? bodyUserId : null;
  if (viaCron) {
    if (requested) {
      return UUID_RE.test(requested)
        ? { ok: true, userId: requested }
        : { ok: false, status: 400, error: "Invalid user_id" };
    }
    return jwtUserId ? { ok: true, userId: jwtUserId } : { ok: false, status: 401, error: "Unauthorized" };
  }
  if (!jwtUserId) return { ok: false, status: 401, error: "Unauthorized" };
  if (requested && requested !== jwtUserId) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true, userId: jwtUserId };
}

interface ScoutPrefs extends ScoutPrefsLite {
  sources: string[];
  instructions: string | null;
}

// Curated, scrapable, English-speaking creative gig sources
const WEB_SITES = [
  "mandy.com", "backstage.com", "productionhub.com", "stage32.com",
  "soundbetter.com", "workingnotworking.com", "contra.com",
  "weworkremotely.com", "mediabistro.com", "coroflot.com",
  "dribbble.com/jobs", "behance.net/joblist", "authenticjobs.com",
  "remoteok.com", "freelancer.com", "upwork.com", "peopleperhour.com",
  "twine.net", "thedots.co", "krop.com", "talenthouse.com",
  "wellfound.com", "ycombinator.com/jobs", "remote.co", "justremote.co",
  "weworkremotely.com/categories/remote-design-jobs",
  "creativepool.com", "if-you-could.co.uk", "designjobsboard.com",
  "freelancermap.com", "wellfound.com/jobs",
];

const ATS_SITES = [
  "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com",
  "jobs.smartrecruiters.com", "myworkdayjobs.com", "bamboohr.com/jobs",
  "recruitee.com", "teamtailor.com", "jobvite.com",
];

const FB_QUERIES = [
  "facebook.com/groups creative gigs",
  "facebook.com/groups freelance",
];

function buildSearchQueries(p: ScoutProfile, prefs: ScoutPrefs): { source: ScoutSource; query: string }[] {
  const role = p.role || "creative";
  const subs = (p.sub_roles || []).slice(0, 2);
  const skills = (p.skills || []).slice(0, 4);
  const jobTypes = (prefs.job_types || []).slice(0, 3);
  const empTypes = (prefs.employment_types || []).slice(0, 2);
  // Locations: user-tuned list wins, else profile location, else "remote"
  const userLocs = (prefs.locations || []).filter(Boolean);
  const locList = prefs.remote_only ? ["remote"] : (userLocs.length ? userLocs : [p.location || "remote"]);
  const extra = (prefs.extra_keywords || []).slice(0, 3).join(" ");
  const empSuffix = empTypes.length ? ` ${empTypes.join(" OR ")}` : "";

  const baseRole = [jobTypes[0] || role, ...subs, ...skills.slice(0, 2), extra].filter(Boolean).join(" ").trim();
  const queries: { source: ScoutSource; query: string }[] = [];

  // Fan out across each preferred location (cap to 3 to keep request count sane)
  for (const loc of locList.slice(0, 3)) {
    const baseTerms = `${baseRole}${empSuffix} ${loc}`.trim();

    if (prefs.sources.includes("web")) {
      for (const site of WEB_SITES.slice(0, 6)) {
        queries.push({ source: "web", query: `site:${site} ${baseTerms}` });
      }
    }
    if (prefs.sources.includes("ats")) {
      for (const site of ATS_SITES) {
        queries.push({ source: "ats", query: `site:${site} ${jobTypes[0] || role} ${skills[0] || ""} ${loc}`.trim() });
      }
    }
    if (prefs.sources.includes("linkedin")) {
      queries.push({ source: "linkedin", query: `site:linkedin.com/jobs "${jobTypes[0] || skills[0] || role}" ${loc}` });
    }
    if (prefs.sources.includes("instagram")) {
      queries.push({ source: "instagram", query: `site:instagram.com/explore/tags casting ${jobTypes[0] || role} ${loc}` });
      queries.push({ source: "instagram", query: `site:instagram.com "open call" ${jobTypes[0] || role} ${loc}` });
    }
    if (prefs.sources.includes("facebook")) {
      for (const q of FB_QUERIES) {
        queries.push({ source: "web", query: `site:${q} ${jobTypes[0] || role} ${loc}` });
      }
    }
  }
  return queries;
}

// Per-source timeout: one dead/slow query must not stall the whole scan.
// Firecrawl calls that exceed this are aborted and treated as "no results"
// for that source, not a fatal error for the run.
const SOURCE_TIMEOUT_MS = 9000;

type FirecrawlItem = { url: string; title?: string; markdown?: string; description?: string; image_url?: string | null };

async function firecrawlSearch(query: string, key: string): Promise<FirecrawlItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(FIRECRAWL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit: 6,
        // RECENCY: only results from the past WEEK (was past month)
        tbs: "qdr:w",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    console.warn("[scout] firecrawl", timedOut ? "timeout" : "network error", query);
    return [];
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    console.warn("[scout] firecrawl fail", query, r.status);
    return [];
  }
  const j = await r.json();
  const arr = Array.isArray(j.data) ? j.data
    : Array.isArray(j.data?.web) ? j.data.web
    : Array.isArray(j.web) ? j.web
    : [];
  return arr.map((it: any) => {
    const meta = it.metadata || {};
    const md = it.markdown || "";
    const mdImg = md.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp|gif))/i);
    return {
      url: it.url,
      title: it.title,
      markdown: md,
      description: it.description,
      image_url: meta.ogImage || meta["og:image"] || meta.image || meta.twitterImage || (mdImg ? mdImg[1] : null),
    };
  });
}

interface AiGig {
  title: string;
  company?: string;
  location?: string;
  remote?: boolean;
  description?: string;
  compensation?: string;
  contact_email?: string;
  apply_url?: string;
  source_url: string;
  source: string;
  source_name?: string;
  skills?: string[];
  fit_score: number;
  fit_reason: string;
  posted_age: string;
}

// Optional step. Returns [] on ANY failure (no key, no credit, timeout, bad
// JSON) and the caller falls back to the deterministic scorer, so a dry AI
// gateway never means an empty Scout.
async function extractAndScore(
  raw: Array<FirecrawlItem & { source: string }>,
  profile: ScoutProfile,
  prefs: ScoutPrefs,
  lovableKey: string,
): Promise<AiGig[]> {
  if (raw.length === 0) return [];
  const snippets = raw
    .slice(0, 30)
    .map((r, i) =>
      `[${i + 1}] SOURCE:${r.source}\nURL:${r.url}\nTITLE:${r.title || ""}\nCONTENT:${(r.markdown || r.description || "").slice(0, 1200)}`,
    )
    .join("\n\n---\n\n");

  const prefBlurb = [
    prefs.job_types?.length ? `Wants roles: ${prefs.job_types.join(", ")}` : "",
    prefs.employment_types?.length ? `Employment: ${prefs.employment_types.join(", ")}` : "",
    prefs.locations?.length ? `Preferred locations: ${prefs.locations.join(", ")}` : "",
    prefs.remote_only ? "Remote only: YES" : "",
    prefs.travel_ok ? "Open to travel: YES" : "Open to travel: NO",
    prefs.exclude_keywords?.length ? `Exclude: ${prefs.exclude_keywords.join(", ")}` : "",
    prefs.instructions ? `User notes: ${prefs.instructions.slice(0, 600)}` : "",
  ].filter(Boolean).join("\n");

  const profileBlurb = `Role: ${profile.role || "creative"}
Sub-roles: ${(profile.sub_roles || []).join(", ")}
Skills: ${(profile.skills || []).join(", ")}
Location: ${profile.location || "remote"}
Bio: ${(profile.bio || "").slice(0, 300)}
${prefBlurb ? `\nUSER SCOUT PREFERENCES:\n${prefBlurb}` : ""}`;

  const aiController = new AbortController();
  const aiTimer = setTimeout(() => aiController.abort(), 25000);
  let r: Response;
  try {
    r = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    signal: aiController.signal,
    body: JSON.stringify({
      model: GEMINI_3_FLASH,
      messages: [
        {
          role: "system",
          content:
            "You extract REAL, RECENTLY POSTED paid creative gigs from search results. STRICT RULES: (1) REJECT anything older than 14 days — if snippet says '3 weeks ago', '1 month ago', '6 months ago', 'no longer accepting', 'expired', 'closed', 'filled', REJECT. (2) REJECT generic listing/search/category pages, articles, blog posts, 'top 10' roundups. The URL MUST be a deep-link to ONE specific job/casting/gig posting (e.g. .../jobs/12345, .../p/AbC123, .../job-title-slug-id). REJECT URLs that end in /jobs, /jobs/, /careers, /search, /browse, /explore, /tags, /listings, /opportunities, or are just a domain homepage. (3) REJECT entries where you cannot extract a real role title AND at least one concrete detail (description, compensation, or company). Do NOT invent details. (4) BALANCE SOURCES — do not return more than 3 LinkedIn results total; prioritize gig boards, ATS, Instagram open calls, and indie creative platforms. (5) HONOR USER SCOUT PREFERENCES strictly — if user lists preferred job_types/employment_types, only return matching roles; if user lists preferred locations, only return gigs in those cities OR remote (unless travel_ok=YES); if remote_only=YES, only return remote gigs; respect 'Exclude' keywords and 'User notes' as hard filters. (6) Score fit 0-100 against the creator profile + preferences (boost when role/location/employment match). (7) ELIGIBILITY GATE — REJECT entirely any opportunity that restricts applicants by demographic (gender, age bracket, ethnicity, nationality, country/region of residence, religion, disability status, student status, alumni-only, members-only) UNLESS the creator profile clearly matches the restriction. Examples to REJECT for a generic profile: 'for women only', 'young women entrepreneurs', 'Black creators only', 'Africa-based founders', 'under 25', 'students only', 'US citizens only', 'EU residents only'. Do NOT include these as low-score gigs — drop them completely. When in doubt about eligibility, REJECT.",
        },
        {
          role: "user",
          content: `TODAY: ${new Date().toISOString().slice(0,10)}\n\nCREATOR PROFILE:\n${profileBlurb}\n\nSEARCH RESULTS:\n${snippets}\n\nExtract ONLY active gigs posted in the LAST 14 DAYS that link to a SPECIFIC posting page (not a category/search). Cap LinkedIn at 3 max. For each: title, company, location, remote, description (2-4 sentences with REAL details from the snippet — never blank, never "see post"), compensation, contact_email, apply_url (MUST be the deep-link to the specific posting), posted_age (REQUIRED), skills, fit_score, fit_reason, source.`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "save_gigs",
          description: "Save extracted real gigs",
          parameters: {
            type: "object",
            properties: {
              gigs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    company: { type: "string" },
                    location: { type: "string" },
                    remote: { type: "boolean" },
                    description: { type: "string" },
                    compensation: { type: "string" },
                    contact_email: { type: "string" },
                    apply_url: { type: "string" },
                    source_url: { type: "string" },
                    source: { type: "string", enum: ["web","linkedin","instagram","ats","gigboard"] },
                    source_name: { type: "string" },
                    skills: { type: "array", items: { type: "string" } },
                    fit_score: { type: "number" },
                    fit_reason: { type: "string" },
                    posted_age: { type: "string", description: "e.g. '2 days ago', '3 weeks ago'" },
                  },
                  required: ["title","source_url","source","fit_score","fit_reason","posted_age"],
                },
              },
            },
            required: ["gigs"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "save_gigs" } },
    }),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    console.error("[scout] AI", timedOut ? "timeout" : "network error", e);
    return [];
  } finally {
    clearTimeout(aiTimer);
  }
  if (!r.ok) {
    console.error("[scout] AI fail", r.status, await r.text());
    return [];
  }
  const j = await r.json();
  try {
    const args = JSON.parse(j.choices[0].message.tool_calls[0].function.arguments);
    return (args.gigs || []) as AiGig[];
  } catch (e) {
    console.error("[scout] parse fail", e);
    return [];
  }
}

// Reject anything the extractor dated beyond two weeks.
const isStale = (age: string) => {
  if (!age) return true;
  const a = age.toLowerCase();
  if (/year|yr|month/.test(a)) return true;
  if (/no longer|expired|closed|filled/.test(a)) return true;
  // weeks: only allow "1 week" or "this week"
  const wk = a.match(/(\d+)\s*week/);
  if (wk && parseInt(wk[1], 10) > 2) return true;
  return false;
};

/** AI-extracted gigs through the same gates as before, as scored candidates. */
function acceptAiGigs(extracted: AiGig[], profile: ScoutProfile, prefs: ScoutPrefs, imgByUrl: Map<string, string>): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  let linkedin = 0;
  const profBlob = profileBlob(profile);
  for (const g of extracted) {
    if (!g.title || !g.source_url) continue;
    if ((g.fit_score ?? 0) < prefs.min_fit_score) {
      console.log("[scout] dropped low fit_score:", g.fit_score, "<", prefs.min_fit_score, "-", g.title);
      continue;
    }
    if (isStale(g.posted_age || "")) continue;
    // URL must be a deep-link to a specific posting (not a search/category page)
    const apply = g.apply_url || g.source_url;
    if (isGenericListingUrl(apply) && isGenericListingUrl(g.source_url)) continue;
    // Require a real description so cards aren't empty shells
    const desc = (g.description || "").trim();
    if (desc.length < 40 && !g.compensation && !g.company) continue;
    const blob = `${g.title} ${desc} ${g.posted_age || ""}`.toLowerCase();
    if (/no longer accepting|expired|position closed|1 year ago|2 years ago|months ago/.test(blob)) continue;
    if (!isEligible(blob, profBlob)) {
      console.log("[scout] dropped restricted:", g.title);
      continue;
    }
    if ((prefs.exclude_keywords || []).some((kw) => kw && blob.includes(kw.toLowerCase()))) continue;
    if (g.source === "linkedin") {
      if (linkedin >= 3) continue;
      linkedin++;
    }
    out.push({
      source: (["web", "linkedin", "instagram", "ats", "gigboard"].includes(g.source) ? g.source : "web") as ScoutSource,
      source_name: g.source_name || g.source,
      source_url: g.source_url,
      apply_url: !isGenericListingUrl(g.apply_url || "") ? g.apply_url! : (!isGenericListingUrl(g.source_url) ? g.source_url : (g.apply_url || g.source_url)),
      title: g.title,
      company: g.company || null,
      location: g.location || null,
      remote: !!g.remote,
      description: g.description || null,
      compensation: g.compensation || null,
      posted_at: null,
      tags: g.skills || [],
      image_url: imgByUrl.get(g.source_url) || null,
      fit_score: Math.round(g.fit_score),
      fit_reason: [g.fit_reason, g.posted_age ? `Posted ${g.posted_age}` : ""].filter(Boolean).join(" · "),
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  // Both optional now. See the header comment.
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY") || null;
  const aiKey = Deno.env.get("LOVABLE_API_KEY") || null;

  let userId: string | null = null;
  let trigger = "manual";
  try {
    const body = await req.json().catch(() => ({}));
    trigger = typeof body.trigger === "string" && body.trigger ? body.trigger.slice(0, 24) : "manual";
    const live = trigger === "live";

    // Resolve the user: their own JWT (manual run), or body.user_id when the
    // call carries the cron secret (daily job) -- see resolveActingUser.
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    let jwtUserId: string | null = null;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      jwtUserId = user?.id || null;
    }
    const acting = resolveActingUser(body.user_id, jwtUserId, isCronRequest(req));
    if (!acting.ok) return json({ error: acting.error }, acting.status);
    userId = acting.userId;

    if (live) {
      // Background refresh: never twice in a row. (It skips the AI usage gate
      // below because it calls no AI, but it must not be a way to hammer the feeds.)
      const since = new Date(Date.now() - LIVE_MIN_GAP_MS).toISOString();
      const { count } = await supabase
        .from("scout_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("started_at", since);
      if ((count ?? 0) > 0) return json({ ok: true, skipped: "recent", found: 0, filtered: 0, inserted: 0, queries: 0 });
    } else {
      const rateLimit = await checkAiFeatureRateLimit(supabase, userId, "scout-gigs");
      if (!rateLimit.allowed) return rateLimit.response;
    }

    const [{ data: profile }, { data: prefsRow }] = await Promise.all([
      supabase.from("profiles")
        .select("user_id, full_name, role, sub_roles, professional_skills, passion_skills, location, bio, subscription_tier")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("scout_preferences").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    // Tier gating: free=1 preview/week, creator=daily full, creator_pro=priority+unlimited, founder=unlimited
    const tier = ((profile as any)?.subscription_tier || "free").toLowerCase();
    // Premium is not enforced yet: no account is held to the free-tier weekly preview.
    const isFree = PREMIUM_ENFORCED && (tier === "free" || tier === "spark" || tier === "");
    const perRunCap = isFree ? 1 : (tier === "creator" ? 10 : 25);
    if (isFree) {
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { count } = await supabase
        .from("scouted_gigs")
        .select("id", { count: "exact", head: true })
        .eq("target_user_id", userId)
        .gte("scouted_at", weekAgo);
      if ((count ?? 0) >= 1) {
        return json({
          ok: true, gated: true, tier, message: "Free tier: 1 Scout preview per week. Upgrade to Creator for daily Scout + auto-drafted applications.",
          found: 0, inserted: 0,
        });
      }
    }

    if (!profile) return json({ error: "Profile not found" }, 404);
    // The skills columns are jsonb holding strings for some profiles and
    // { skill, category, level } objects for others: normalise before use.
    const text = (v: unknown) => (typeof v === "string" ? v : null);
    const mergedProfile: ScoutProfile = {
      role: text((profile as any).role),
      sub_roles: toTextList((profile as any).sub_roles),
      skills: [
        ...toTextList((profile as any).professional_skills),
        ...toTextList((profile as any).passion_skills),
      ],
      location: text((profile as any).location),
      bio: text((profile as any).bio),
    };

    // Auto-create prefs if missing
    const prefs: ScoutPrefs = (prefsRow as ScoutPrefs | null) ?? {
      sources: ["web", "linkedin", "instagram", "ats"],
      extra_keywords: null, exclude_keywords: null, remote_only: false, min_fit_score: 60,
      job_types: null, employment_types: null, locations: null, travel_ok: false, instructions: null,
    };
    if (!prefsRow) {
      await supabase.from("scout_preferences").insert({ user_id: userId });
    }

    // What this user already has, so "inserted" means genuinely new and a
    // dismissed gig is never brought back.
    const { data: existingRows } = await supabase
      .from("scouted_gigs")
      .select("dedupe_key")
      .eq("target_user_id", userId)
      .order("scouted_at", { ascending: false })
      .limit(2000);
    const existing = new Set<string>((existingRows || []).map((r: any) => r.dedupe_key));

    let inserted = 0;
    const toRow = (c: ScoredCandidate, via: string) => ({
      target_user_id: userId,
      source: c.source,
      source_name: c.source_name,
      source_url: c.source_url,
      title: c.title.slice(0, 200),
      company: c.company,
      location: c.location,
      remote: c.remote,
      description: c.description,
      compensation: c.compensation,
      contact_email: null,
      apply_url: c.apply_url,
      skills: c.tags.filter((t) => t && t.length <= 30).slice(0, 6),
      fit_score: Math.round(c.fit_score),
      fit_reason: c.fit_reason,
      image_url: c.image_url ?? null,
      posted_at: c.posted_at,
      dedupe_key: dedupeKey(c),
      raw: { via, posted_at: c.posted_at },
    });

    // Saves up to `cap` best candidates that the user does not already have, and
    // returns how many were new. Rows go in as soon as they are ready so the
    // page (which polls while a scan runs) shows them without waiting for the
    // slow sources.
    const saveNew = async (ranked: ScoredCandidate[], cap: number, via: string): Promise<number> => {
      if (cap <= 0) return 0;
      const fresh: ScoredCandidate[] = [];
      for (const c of ranked) {
        if (existing.has(dedupeKey(c))) continue;
        fresh.push(c);
        if (fresh.length >= cap) break;
      }
      if (!fresh.length) return 0;
      const rows = fresh.map((c) => toRow(c, via));
      const { data, error } = await supabase
        .from("scouted_gigs")
        .upsert(rows, { onConflict: "target_user_id,dedupe_key", ignoreDuplicates: true })
        .select("id");
      if (!error) {
        fresh.forEach((c) => existing.add(dedupeKey(c)));
        return data?.length ?? fresh.length;
      }
      console.warn("[scout] batch upsert fail, retrying row by row:", error.message);
      let n = 0;
      for (const [i, row] of rows.entries()) {
        const { error: rowError } = await supabase
          .from("scouted_gigs")
          .upsert(row, { onConflict: "target_user_id,dedupe_key", ignoreDuplicates: true });
        if (rowError) console.warn("[scout] upsert fail", rowError.message);
        else {
          existing.add(dedupeKey(fresh[i]));
          n++;
        }
      }
      return n;
    };

    const degraded: string[] = [];
    const sourcesUsed: string[] = [];

    // ── 1. public feeds: fast, free, no key ───────────────────────────────
    const feeds = await loadPublicFeeds(mergedProfile, prefs);
    const okFeeds = feeds.report.filter((r) => r.ok);
    sourcesUsed.push(...okFeeds.map((r) => r.name));
    if (okFeeds.length === 0) degraded.push("feeds_unavailable");
    else if (okFeeds.length < feeds.report.length) degraded.push("feeds_partial");
    for (const r of feeds.report.filter((x) => !x.ok)) console.warn("[scout] feed down:", r.name, r.error);

    const feedRanked = rankCandidates(feeds.candidates, mergedProfile, prefs);
    console.log("[scout] feeds", feeds.candidates.length, "candidates,", feedRanked.length, "relevant");

    // Firecrawl is the slow, paid source: manual and cron runs only, and only
    // when configured. Leave it room in the cap so it is not crowded out.
    const useFirecrawl = !!fcKey && !live;
    if (!fcKey && !live) degraded.push("web_search_unavailable");
    const feedCap = useFirecrawl ? Math.max(1, Math.ceil(perRunCap * 0.6)) : perRunCap;
    inserted += await saveNew(feedRanked, feedCap, "feed");

    // ── 2. Firecrawl web search (+ optional AI extraction) ────────────────
    let queryCount = okFeeds.length;
    let firecrawlFiltered = 0;
    let firecrawlFound = 0;
    if (useFirecrawl && inserted < perRunCap) {
      sourcesUsed.push("firecrawl");
      const queries = buildSearchQueries(mergedProfile, prefs);
      queryCount += queries.length;
      console.log("[scout] firecrawl queries", queries.length, "for", userId);

      // Concurrent in batches; every call is time-bounded (SOURCE_TIMEOUT_MS),
      // and allSettled means one rejected promise never takes down its batch.
      const allRaw: Array<FirecrawlItem & { source: ScoutSource }> = [];
      const CHUNK = 12;
      for (let i = 0; i < queries.length; i += CHUNK) {
        if (Date.now() - startedAt > FIRECRAWL_BUDGET_MS) {
          console.warn("[scout] firecrawl budget spent, skipping remaining batches");
          break;
        }
        const batch = queries.slice(i, i + CHUNK);
        const results = await Promise.allSettled(batch.map(async (q) => {
          const items = await firecrawlSearch(q.query, fcKey!);
          return items.map((it) => ({ ...it, source: q.source }));
        }));
        for (const r of results) {
          if (r.status === "fulfilled") allRaw.push(...r.value);
        }
      }
      firecrawlFound = allRaw.length;
      console.log("[scout] firecrawl raw results", allRaw.length);

      const imgByUrl = new Map<string, string>();
      for (const r of allRaw) if (r?.url && r?.image_url) imgByUrl.set(r.url, r.image_url);

      let webRanked: ScoredCandidate[] = [];
      if (aiKey) {
        webRanked = acceptAiGigs(await extractAndScore(allRaw, mergedProfile, prefs, aiKey), mergedProfile, prefs, imgByUrl);
        if (webRanked.length === 0 && allRaw.length > 0) degraded.push("ai_unavailable");
      } else {
        degraded.push("ai_unavailable");
      }
      if (webRanked.length === 0) {
        // No AI key, no credit, or it found nothing usable: same pages, scored by rule.
        const candidates = allRaw
          .map((it) => firecrawlToCandidate(it, it.source))
          .filter((c): c is ScoutCandidate => !!c);
        webRanked = rankCandidates(candidates, mergedProfile, prefs);
      }
      webRanked.sort((a, b) => b.fit_score - a.fit_score);
      firecrawlFiltered = webRanked.length;
      inserted += await saveNew(webRanked, perRunCap - inserted, "web");
    }

    // ── 3. backfill from the feeds if the web search left room ────────────
    if (inserted < perRunCap) inserted += await saveNew(feedRanked, perRunCap - inserted, "feed");

    const found = feeds.candidates.length + firecrawlFound;
    const filtered = feedRanked.length + firecrawlFiltered;

    await supabase.from("scout_runs").insert({
      user_id: userId, trigger, sources: sourcesUsed,
      found_count: found, inserted_count: inserted,
      duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
    });
    await supabase.from("scout_preferences")
      .update({ last_run_at: new Date().toISOString() })
      .eq("user_id", userId);

    return json({
      ok: true, found, filtered, inserted, queries: queryCount,
      sources: sourcesUsed, degraded,
    });
  } catch (e) {
    console.error("[scout] error", e);
    if (userId) {
      await supabase.from("scout_runs").insert({
        user_id: userId, trigger, error: String(e),
        duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
      }).then(() => {}, () => {});
    }
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
