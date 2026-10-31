// Phase E — Outcome Composer router.
// Takes a free-text user request inside a Studio ("make me a sponsor deck for
// Bali Carnival, premium tone") and decides which Executive-Producer outcome
// to spin up. Returns a routing payload the client uses to navigate.
//
// No DB writes. Pure routing decision. Studio Brain is already injected by
// the destination engine (thrive-document-engine), so we don't re-fetch it.
//
// Free by design: the decision is made by the rules in
// _shared/studioOutcomeRouter.ts, with no network call. The AI gateway is only
// asked for a request the rules cannot place, and its absence (no key, credits
// exhausted: 402, rate limit, timeout, any error) is never an error for the
// user: they get the rule result, which for an unplaced request is "chat". This
// function therefore never answers 402 or 429 on behalf of the gateway.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH_LITE } from "../_shared/aiModels.ts";
import { DOC_INTENTS, routeByRules, type RoutedOutcome } from "../_shared/studioOutcomeRouter.ts";


import { corsFor } from '../_shared/guard.ts';
const SYSTEM = `You are Kreto's Studio Outcome Router. The user is inside a Studio (a project workspace) and just told you what they want to make. Decide the OUTCOME to spin up and respond by calling the route_outcome tool.

Outcomes you can return:
- make_document  : user wants a deck/proposal/treatment/rate card/moodboard/one-pager/letter of intent. Pick doc_intent from: sponsor_deck, pitch_deck, business_plan, client_proposal, treatment, rate_card, moodboard_deck, one_pager, letter_of_intent. Choose letter_of_intent when the user says "LOI", "letter of intent", "letterhead", "formal letter", or describes writing to a government body / partner / sponsor as a signed letter (not a deck).
- find_people    : looking for collaborators, talent, vendors, suppliers, crew. (e.g. "find a videographer in Bali")
- find_gigs      : looking for paid work, sponsors, opportunities for this project.
- draft_invoice  : "send a quote", "invoice the client", "bill them for X".
- chat           : open-ended question, planning, brainstorming — opens Thrive Copilot pre-filled.

Rules:
- pick exactly ONE outcome.
- doc_intent is REQUIRED when outcome === make_document, else null.
- refined_brief: a clean, 1-3 sentence brief the engine should use. Strip filler ("make me", "can you"), keep specifics (audience, tone, deadline, numbers).
- preview: ONE warm sentence (≤100 chars) confirming what you're about to do. No emojis. No quotes.
- target_query: refined search query for find_people / find_gigs (else null).`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** The payload the client reads (the rule result without its internal flag). */
function payloadOf(r: RoutedOutcome) {
  const { confident: _confident, ...rest } = r;
  return rest;
}

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, project_title } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return json({ error: "prompt required" }, 400);
    }

    // 1. The rules decide, for free, whenever they recognise the request.
    const ruled = routeByRules(prompt, typeof project_title === "string" ? project_title : undefined);
    if (ruled.confident) return json(payloadOf(ruled));

    // 2. Unplaced: the AI may refine it, if it is available. Any failure falls
    //    back to the rule result (chat), never to an error.
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(payloadOf(ruled));

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 8000);
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: ac.signal,
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GEMINI_FLASH_LITE,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Studio: "${String(project_title || "Untitled").slice(0, 80)}"\n\nUser said: ${prompt.trim().slice(0, 600)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "route_outcome",
              description: "Return the routing decision.",
              parameters: {
                type: "object",
                properties: {
                  outcome: {
                    type: "string",
                    enum: ["make_document", "find_people", "find_gigs", "draft_invoice", "chat"],
                  },
                  doc_intent: {
                    type: ["string", "null"],
                    enum: [...DOC_INTENTS, null],
                  },
                  refined_brief: { type: "string" },
                  target_query: { type: ["string", "null"] },
                  preview: { type: "string" },
                },
                required: ["outcome", "doc_intent", "refined_brief", "target_query", "preview"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "route_outcome" } },
        }),
      });
      if (!resp.ok) {
        // 402 (credits), 429, 5xx: the user is not told, and nothing is charged to them.
        console.warn("route-studio-outcome: gateway unavailable, using rules", resp.status);
        return json(payloadOf(ruled));
      }
      const data = await resp.json();
      const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc) return json(payloadOf(ruled));
      const parsed = JSON.parse(tc.function.arguments);
      return json({ ...parsed, routed_by: "ai" });
    } catch (e) {
      console.warn("route-studio-outcome: gateway call failed, using rules", e instanceof Error ? e.message : e);
      return json(payloadOf(ruled));
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    console.error("route-studio-outcome error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
