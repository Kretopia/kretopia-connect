// Phase 14 — Thrive drafts short, on-brand reply options for a Hot Lead.
// Voice: warm Executive Producer. Never says "AI". Always 3 options.
import { z } from 'npm:zod@4';
import { corsFor, readJson, safeError } from '../_shared/guard.ts';
import { requireAiCaller } from '../_shared/aiPerimeter.ts';
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from '../_shared/promptIsolation.ts';
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const BodySchema = z.object({
  inbound: z.string().trim().min(1).max(16000),
  senderName: z.string().max(255).optional(),
  myName: z.string().max(255).optional(),
  myRole: z.string().max(255).optional(),
});

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    await requireAiCaller(req, 'draft-lead-reply');
    const body = await readJson(req, BodySchema);
    const inbound = String(body?.inbound || '').slice(0, 1200).trim();
    if (!inbound) {
      return new Response(JSON.stringify({ error: 'inbound required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderName = (body.senderName || 'them').slice(0, 60);
    const myName = (body.myName || 'the creator').slice(0, 60);
    const myRole = (body.myRole || '').slice(0, 80);

    const sys = `You are Kreto, the creator's Executive Producer.
Draft EXACTLY 3 short reply options to an inbound hire/booking message.
Voice: warm, confident, human, low-friction. NEVER say "AI", "I'm an assistant", or use emoji.
Each draft is 1–2 sentences, max ~220 chars. Each ends with a clear next step (ask scope, propose a quick call, share rate range, or confirm availability).
Vary the three: (1) quick yes + ask scope, (2) propose 15-min call, (3) share rate window / availability.
Return JSON only.${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

    const user = wrapUntrustedContent('reply context', `Creator: ${myName}${myRole ? ` (${myRole})` : ''}
From: ${senderName}
Inbound message:
"""${inbound}"""

Reply on behalf of ${myName}. First person.`);

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('AI configuration unavailable');
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        tools: [{
          type: 'function',
          function: {
            name: 'return_drafts',
            description: 'Return three reply drafts',
            parameters: {
              type: 'object',
              properties: {
                drafts: {
                  type: 'array',
                  minItems: 3, maxItems: 3,
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string', description: 'Short 2-3 word label e.g. "Quick yes", "Hop on call", "Share rate"' },
                      text: { type: 'string', description: 'The reply itself' },
                    },
                    required: ['label', 'text'],
                  },
                },
              },
              required: ['drafts'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_drafts' } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('Reply provider failed', res.status, t);
      return safeError(new Error('Reply provider failed'), req);
    }
    const data = await res.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { drafts: [] };
    return new Response(JSON.stringify({ drafts: args.drafts || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return safeError(e, req);
  }
});
