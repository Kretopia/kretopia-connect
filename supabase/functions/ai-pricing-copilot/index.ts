import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { messages, currency, document_type, existing_items, current_details, project_context, scan_image } = await req.json();

    const docLabel = document_type === "quote" ? "quote" : "invoice";

    // Build a compact, structured snapshot of the live Studio so the AI can
    // pre-fill the quote with what the user has already captured.
    let projectBlock = "";
    if (project_context && (project_context.project || project_context.notes?.length || project_context.deliverables?.length || project_context.files?.length)) {
      const p = project_context.project || {};
      const notes = (project_context.notes || []).slice(0, 10);
      const delivs = (project_context.deliverables || []).slice(0, 20);
      const files = (project_context.files || []).slice(0, 20);
      const client = project_context.client || {};

      projectBlock = `\n\n=== LIVE PROJECT CONTEXT (Studio) ===
Use this as the source of truth. Pull line items from the deliverables and notes whenever possible — DO NOT ask the user to re-type details that are already here. Reference specific items by name.

Project: ${p.title || "Untitled"}${p.workspace_type ? ` (${p.workspace_type})` : ""}
${p.description ? `Brief: ${p.description}` : ""}
${p.budget ? `Budget: ${p.budget}` : ""}
${p.deadline ? `Deadline: ${p.deadline}` : ""}
${p.currency ? `Project currency: ${p.currency}` : ""}
${client.name || p.client_name ? `Client: ${client.name || p.client_name}${client.company ? ` (${client.company})` : ""}` : ""}
${client.email ? `Client email: ${client.email}` : ""}
${client.address ? `Client address: ${client.address}` : ""}

${delivs.length ? `Deliverables (${delivs.length}):\n${delivs.map((d: any, i: number) => `  ${i + 1}. ${d.title}${d.kind ? ` [${d.kind}]` : ""}${d.status ? ` — ${d.status}` : ""}${d.description ? ` :: ${String(d.description).slice(0, 200)}` : ""}`).join("\n")}` : ""}

${notes.length ? `Notes from the Pad (${notes.length}):\n${notes.map((n: any, i: number) => `  ${i + 1}. ${n.title}${n.content ? `: ${String(n.content).slice(0, 400)}` : ""}`).join("\n")}` : ""}

${files.length ? `Files in Vault (${files.length}): ${files.map((f: any) => f.file_name).join(", ")}` : ""}
=== END PROJECT CONTEXT ===`;
    }

    // Pull THRIVE MEMORY (saved rates, vendors, repeat clients, preferences) so
    // the co-pilot remembers what the user has told it across sessions.
    // Also pull the user's profile location so pricing is sanity-checked
    // against the local market (Bali ≠ NYC ≠ London).
    let memoryBlock = "";
    let locationBlock = "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const [memRes, profRes] = await Promise.all([
            userClient
              .from("thrive_memory")
              .select("kind, label, body, importance")
              .eq("user_id", user.id)
              .in("kind", ["rate", "vendor", "client", "preference", "contact", "fact"])
              .order("importance", { ascending: false })
              .order("last_used_at", { ascending: false, nullsFirst: false })
              .limit(25),
            userClient
              .from("profiles")
              .select("country, city, primary_role")
              .eq("user_id", user.id)
              .maybeSingle(),
          ]);
          const memRows = memRes.data;
          if (memRows && memRows.length) {
            memoryBlock = `\n\n=== THRIVE MEMORY (things this user has told you to remember) ===
Use these as defaults — saved rates, repeat clients, vendor costs, preferences. Reference them by name when relevant ("your usual rate is…", "for ${"${client}"} you normally…"). Don't repeat back the whole block; weave them in.

${memRows.map((m: any) => `- [${m.kind}] ${m.label}${m.body ? `: ${String(m.body).slice(0, 240)}` : ""}`).join("\n")}
=== END THRIVE MEMORY ===`;
          }
          const prof = profRes.data;
          const projLocation = (project_context?.project as any)?.location
            || (project_context?.client as any)?.address
            || null;
          if (prof?.country || prof?.city || projLocation) {
            locationBlock = `\n\n=== LOCATION CONTEXT ===
User base: ${[prof?.city, prof?.country].filter(Boolean).join(", ") || "unknown"}
${prof?.primary_role ? `Role: ${prof.primary_role}` : ""}
${projLocation ? `Project / client location: ${projLocation}` : ""}
Currency on the document: ${currency || "USD"}

PRICING MUST BE LOCAL-MARKET-AWARE:
- Bali / Lombok / SE Asia tourism creative work runs ~30–60% of US/EU rates. A "good" day rate for a Bali photo/video shoot is typically USD 250–600/day, not USD 1,200+.
- LATAM / Caribbean / Africa: discount US rates ~35–55%.
- US tier-1 cities, London, Sydney, Dubai, Singapore: full premium rates.
- Always think about WHERE THE WORK IS DELIVERED and WHO THE CLIENT IS, not where the freelancer normally lives.
- When you propose a rate, present a RANGE first (low / typical / high) for that locale, then the recommended number — so the user has a sanity check.
- If your suggestion is >40% above the local typical, FLAG IT explicitly: "⚠️ This is well above local norms — great if they say yes, but could lose the job. Want to drop to {typical}?"
- Default markups: 15–25% standard, 25–40% agency, 50%+ only for rush or specialized work. Never silently apply >40% markup; always show the math and ask.
=== END LOCATION CONTEXT ===`;
          }
        }
      } catch (e) {
        console.warn("ai-pricing-copilot: memory/profile fetch failed", e);
      }
    }

    const hasScan = !!(scan_image && typeof scan_image === "string" && scan_image.startsWith("data:image/"));

    const scanRules = hasScan ? `

=== IMAGE / BRIEF SCAN MODE — STRICT EXTRACTIVE RULES ===
A brief, flyer, screenshot or quote image is attached. You MUST:
1. **First, transcribe what you literally see.** Before proposing anything, write a short "📋 What I read from your brief" section listing each line item / service / deliverable EXACTLY as it appears in the image, including the original numbers, units (hours, days, units, sqm, words, pieces, etc.), and currency symbols VERBATIM. Do not translate, do not normalize, do not invent.
2. **Never invent units, quantities, rates or currencies that are not visible.** If the image says "2 days @ TT$1,500" → quantity=2, unit="days", rate=1500, currency=TTD. If a unit is unclear, write "unit: ?" and ASK the user before guessing. Common confusions to avoid: hours vs days, per-unit vs total, gross vs net, USD vs TTD vs local currency.
3. **Preserve the source currency** the brief uses. Only convert if the user explicitly asks. If the brief currency differs from the document currency (${currency}), flag it and ask which to use.
4. **Math check.** For every line, verify quantity × rate ≈ stated total (if a total is shown). If it doesn't match, flag the discrepancy in plain language — don't silently "fix" it.
5. **Confidence flags.** For anything you're <80% sure of, prefix with "⚠️ Please confirm:". Better to ask one question than push a wrong number.
6. **Then, and only then,** propose line items. Wait for the user's confirmation before calling generate_line_items — unless they've already said "just generate it".
=== END SCAN RULES ===
` : "";

    const systemPrompt = `You are ThriveQuote — an expert pricing co-pilot for creative freelancers and agencies. You help users build professional quotes and invoices through natural conversation.${scanRules}

Your capabilities:
1. **Cost Analysis**: When a user shares supplier/subcontractor costs, calculate appropriate markups based on industry standards
2. **Line Item Generation**: Break down vague project descriptions into professional, detailed line items
3. **Market Pricing**: Suggest rates based on creative industry standards for the user's region
4. **Description Enhancement**: Improve service descriptions to sound more professional
5. **Terms & Notes**: Suggest professional terms, payment conditions, and notes
6. **Client Details Collection**: Gather client name, email, address, dates, currency, tax info naturally through conversation

Document type: ${docLabel}
Currency: ${currency || "USD"}

CONVERSATION FLOW:
- If LIVE PROJECT CONTEXT is provided below, START by proposing draft line items derived from the deliverables + notes (one line per deliverable when sensible, with a sensible default rate or a clear "TBD — what's your cost?" placeholder). Then ask only for what's missing (rates, supplier costs, client email).
- If no project context, start by understanding the project/services
- Help with pricing, markups, and line items
- When discussing client details or when the user provides them, use the set_document_details tool to capture them
- Be proactive: after pricing is sorted, ask "Who is this ${docLabel} for?" to collect client info
- Format tables clearly using markdown tables with proper alignment
- Use bold headers and clean spacing in your responses

RULES:
- Always be conversational and helpful, like a pricing mentor
- When suggesting prices, show the math (cost → markup → client price) in clean markdown tables
- Consider the creative industry context (film, design, music, photography, etc.)
- Typical creative markups: 1.5x-3x for subcontractor costs, 2x-4x for equipment
- Always suggest adding a creative direction/project management fee (10-20% of total)
- When the user is ready, use the generate_line_items tool to output structured data
- When discussing currency, recommend appropriate currency based on client location
- Collect client details naturally — don't dump a form, ask conversationally

${existing_items && existing_items.length > 0 ? `\nCurrent line items on the document:\n${existing_items.map((i: any, idx: number) => `${idx + 1}. "${i.description}" — Qty: ${i.quantity}, Rate: ${currency} ${i.rate}`).join("\n")}` : ""}

${current_details ? `\nCurrently captured details:\n${JSON.stringify(current_details, null, 2)}` : ""}${projectBlock}${memoryBlock}${locationBlock}

REMINDER: You can make mistakes. When you're not sure (rate, currency, unit, scope), ASK — don't guess. The user is the final approver.`;

    // If the client included a scanned brief/flyer image, attach it as multimodal
    // content on the LAST user message so Gemini can read it.
    let aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
    if (scan_image && typeof scan_image === "string" && scan_image.startsWith("data:image/")) {
      const lastUserIdx = (() => {
        for (let i = aiMessages.length - 1; i >= 0; i--) {
          if (aiMessages[i].role === "user") return i;
        }
        return -1;
      })();
      const baseText = lastUserIdx >= 0 && typeof aiMessages[lastUserIdx].content === "string"
        ? aiMessages[lastUserIdx].content
        : `Here's a brief/flyer for this ${docLabel}. Extract the project details, deliverables, dates, client name, and any pricing hints. Then propose line items and call generate_line_items.`;
      const multimodalUser = {
        role: "user",
        content: [
          { type: "text", text: baseText },
          { type: "image_url", image_url: { url: scan_image } },
        ],
      };
      if (lastUserIdx >= 0) aiMessages[lastUserIdx] = multimodalUser;
      else aiMessages.push(multimodalUser);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Vision/extraction needs a stronger model when the user scans a brief —
        // 2.5-pro is far less prone to hallucinating units/rates than flash.
        model: hasScan ? "google/gemini-3.1-pro-preview" : "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools: [
          {
            type: "function",
            function: {
              name: "generate_line_items",
              description: "Generate structured line items for the quote/invoice. Call this when the user agrees to pricing or asks to generate the quote.",
              parameters: {
                type: "object",
                properties: {
                  line_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string", description: "Professional service description" },
                        quantity: { type: "number", description: "Quantity (default 1)" },
                        rate: { type: "number", description: "Rate per unit in the specified currency" },
                      },
                      required: ["description", "quantity", "rate"],
                    },
                  },
                  suggested_notes: { type: "string", description: "Suggested notes for the document" },
                  suggested_terms: { type: "string", description: "Suggested terms and conditions" },
                  suggested_tax_rate: { type: "number", description: "Suggested tax rate percentage if applicable" },
                },
                required: ["line_items"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "enhance_descriptions",
              description: "Improve existing line item descriptions to be more professional",
              parameters: {
                type: "object",
                properties: {
                  enhanced_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        original: { type: "string" },
                        enhanced: { type: "string" },
                        suggested_rate: { type: "number", description: "Optionally suggest a better rate" },
                      },
                      required: ["original", "enhanced"],
                    },
                  },
                },
                required: ["enhanced_items"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "set_document_details",
              description: "Capture client and document details when the user provides them during conversation. Call this whenever the user mentions their client name, email, address, preferred currency, tax rate, or due dates.",
              parameters: {
                type: "object",
                properties: {
                  client_name: { type: "string", description: "Client or company name" },
                  client_email: { type: "string", description: "Client email address" },
                  client_address: { type: "string", description: "Client address or location" },
                  currency: { type: "string", description: "Preferred currency code (e.g., USD, EUR, IDR)" },
                  tax_rate: { type: "number", description: "Tax rate percentage" },
                  due_date: { type: "string", description: "Due date or valid until date in YYYY-MM-DD format" },
                  notes: { type: "string", description: "Document notes" },
                },
              },
            },
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e: any) {
    console.error("ai-pricing-copilot error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
