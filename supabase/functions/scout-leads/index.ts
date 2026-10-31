import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { dedupeLeads, knownLeadKeys, splitByExisting, splitEvenly } from "../_shared/leadExtraction.ts";
import { fetchAllRows } from "../_shared/weeklyEmail.ts";


import { corsFor, safeError } from '../_shared/guard.ts';
// --- Speed notes -----------------------------------------------------------
// A search used to be slow for two reasons, both on this server:
//  1. Firecrawl was asked to SCRAPE the full page of up to 40 results
//     (`scrapeOptions`), but only the first 500 characters of each were ever
//     used. Without scrapeOptions Firecrawl returns title + description + url
//     only, which is what the extraction below now reads. Set
//     SCOUT_LEADS_SCRAPE_PAGES=true to restore the page scrape.
//  2. One AI call had to WRITE all 25-50 leads before anything came back.
//     The results are now split into a few chunks extracted in parallel, so
//     the wait is roughly the longest chunk, not the sum.
const SEARCH_LIMIT = 40;
const MAX_SNIPPETS = 36;           // 3 chunks x 12
const AI_CHUNKS = 3;
const SEARCH_TIMEOUT_MS = 45_000;  // time to first byte, per upstream call
const AI_TIMEOUT_MS = 60_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_leads",
    description: "Extract structured lead data from search results",
    parameters: {
      type: "object",
      properties: {
        leads: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              company: { type: "string" },
              role: { type: "string" },
              email: { type: "string" },
              website: { type: "string" },
              notes: { type: "string" },
              type: { type: "string", enum: ["client", "collaborator"] },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["name", "notes"],
          },
        },
      },
      required: ["leads"],
    },
  },
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAiCaller(req, "scout-leads");
    const { query, industry, location } = await req.json();
    if (!query) return json({ error: "Query is required" }, 400);

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!firecrawlKey) return json({ error: "Firecrawl not configured" }, 500);
    if (!lovableKey) return json({ error: "AI not configured" }, 500);

    const t0 = Date.now();

    // Who is asking: resolved while the search runs instead of after it.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userPromise: Promise<string | null> = token
      ? admin.auth.getUser(token).then(({ data }) => data?.user?.id ?? null, () => null)
      : Promise.resolve(null);

    // Build search query
    let searchQuery = query;
    if (industry) searchQuery += ` ${industry}`;
    if (location) searchQuery += ` ${location}`;
    searchQuery += " contact email";

    console.log("Searching for leads:", searchQuery);

    // Step 1: Search the web with Firecrawl
    const scrapePages = Deno.env.get("SCOUT_LEADS_SCRAPE_PAGES") === "true";
    let searchRes: Response;
    try {
      searchRes = await fetchWithTimeout("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          limit: SEARCH_LIMIT,
          ...(scrapePages ? { scrapeOptions: { formats: ["markdown"] } } : {}),
        }),
      }, SEARCH_TIMEOUT_MS);
    } catch (e) {
      console.error("Firecrawl request failed:", e);
      return json({ error: "Search timed out, please try again" }, 504);
    }

    const searchData = await searchRes.json();
    if (!searchRes.ok) {
      console.error("Firecrawl error:", searchData);
      return json({ error: "Search failed" }, 500);
    }

    const results = searchData.data || [];
    if (results.length === 0) return json({ leads: [], message: "No results found" });
    const tSearch = Date.now();

    // Step 2: Use AI to extract structured leads from the search results,
    // a few chunks at a time in parallel.
    const snippets: string[] = results
      .slice(0, MAX_SNIPPETS)
      .map((r: any) => `URL: ${r.url}\nTitle: ${r.title || "N/A"}\nContent: ${(r.description || r.markdown || "").slice(0, 500)}`);
    const chunks = splitEvenly(snippets, AI_CHUNKS);
    const aim = chunks.length > 1
      ? `${Math.ceil(25 / chunks.length)}-${Math.ceil(50 / chunks.length)}`
      : "25-50";

    type Chunk = { ok: boolean; status: number; leads: any[] };
    const extract = async (chunk: string[]): Promise<Chunk> => {
      const text = chunk.map((s, i) => `[${i + 1}] ${s}`).join("\n\n---\n\n");
      try {
        const aiRes = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: GEMINI_3_FLASH,
            messages: [
              {
                role: "system",
                content: `You are an expert lead extraction agent. Extract ALL potential business leads/contacts from web search results — aim for ${aim} leads. Be thorough: extract every person, company, brand, studio, agency, or freelancer mentioned. For each lead found, extract: name, company, role/title, email (if found), website, and a brief note about why they're relevant. Return ONLY valid JSON array. If you can't find leads, return empty array [].`,
              },
              {
                role: "user",
                content: `The user is searching for: "${query}"${industry ? ` in the ${industry} industry` : ""}${location ? ` based in ${location}` : ""}.

Extract potential leads from these search results:

${text}

Return a JSON array of objects with these fields:
- name (string, required)
- company (string or null)
- role (string or null)
- email (string or null)
- website (string or null)
- notes (string - why this is a relevant lead)
- type ("client" or "collaborator")
- priority ("high", "medium", or "low")`,
              },
            ],
            tools: [EXTRACT_TOOL],
            tool_choice: { type: "function", function: { name: "extract_leads" } },
          }),
        }, AI_TIMEOUT_MS);

        if (!aiRes.ok) {
          console.error("AI error:", aiRes.status, await aiRes.text());
          return { ok: false, status: aiRes.status, leads: [] };
        }
        const aiData = await aiRes.json();
        try {
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            return { ok: true, status: 200, leads: JSON.parse(toolCall.function.arguments).leads || [] };
          }
        } catch (e) {
          console.error("Failed to parse AI response:", e);
        }
        return { ok: true, status: 200, leads: [] };
      } catch (e) {
        console.error("AI request failed:", e);
        return { ok: false, status: 504, leads: [] };
      }
    };

    const settled = await Promise.all(chunks.map(extract));
    if (settled.every((c) => !c.ok)) {
      const status = settled[0]?.status;
      if (status === 429) return json({ error: "Rate limited, please try again shortly" }, 429);
      if (status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI extraction failed" }, 500);
    }
    // Some chunks failing (rate limit, timeout) still returns what the others found.
    const leads = dedupeLeads(settled.flatMap((c) => c.leads));
    const tAi = Date.now();

    console.log(`Found ${leads.length} leads`);

    // Persist leads into the user's Rolodex so they're actually visible somewhere.
    //
    // Only leads that are NOT already in the user's leads are inserted (same
    // person = same email, else same name + company). Without that, every
    // repeat search re-added the same people, and the app's own Save buttons
    // added them a second time. Each lead in the response carries
    // `in_leads: true` when it is now (or already was) in the user's leads, so
    // the UI can show it as saved instead of offering to save it again. If the
    // lookup of existing leads fails, nothing is inserted: a missed auto-save is
    // better than duplicates, and the user can still save from the results.
    let saved_count = 0;
    let already_saved_count = 0;
    try {
      const user_id = await userPromise;
      if (user_id && leads.length) {
        const candidates = leads.slice(0, 50);
        const existing = await fetchAllRows<{ name: string | null; company: string | null; email: string | null }>(
          (from, to) => admin.from("leads").select("name, company, email").eq("user_id", user_id).range(from, to),
        );
        const { fresh, existing: alreadyThere } = splitByExisting(candidates, knownLeadKeys(existing));
        already_saved_count = alreadyThere.length;
        alreadyThere.forEach((l: any) => { l.in_leads = true; });

        const sourceTag = `thrive-research: ${query}${location ? ` · ${location}` : ""}`.slice(0, 200);
        const rows = fresh.map((l: any) => ({
          user_id,
          name: String(l.name || "Unknown").slice(0, 200),
          company: l.company || null,
          role: l.role || null,
          email: l.email || null,
          profile_url: l.website || null,
          notes: l.notes || null,
          type: l.type === "collaborator" ? "collaborator" : "client",
          stage: "cold",
          priority: ["high", "medium", "low"].includes(l.priority) ? l.priority : "medium",
          source: sourceTag,
          tags: location ? [location] : [],
        }));
        if (rows.length) {
          const { error: insErr, data: ins } = await admin.from("leads").insert(rows).select("id");
          if (insErr) console.warn("scout-leads persist failed:", insErr.message);
          else {
            saved_count = ins?.length ?? 0;
            fresh.forEach((l: any) => { l.in_leads = true; });
          }
        }
      }
    } catch (persistErr) {
      console.warn("scout-leads persist exception:", persistErr);
    }

    console.log(
      `[scout-leads] timings search=${tSearch - t0}ms ai=${tAi - tSearch}ms persist=${Date.now() - tAi}ms ` +
      `chunks=${chunks.length} results=${results.length} scraped=${scrapePages}`,
    );

    return json({
      leads,
      count: leads.length,
      saved_count,
      already_saved_count,
      query,
      location: location ?? null,
      action_url: "/sales",
      sources: results.map((r: any) => r.url),
    });
  } catch (e) {
    console.error("scout-leads error:", e);
    return safeError(e, req);
  }
});
