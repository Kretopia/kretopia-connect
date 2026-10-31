import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizePublicSearch } from '../_shared/publicSearchPolicy.ts';
import { sourcedPublicResults, rankPublicSources } from '../_shared/publicPresenceResults.ts';
import { GEMINI_3_FLASH } from '../_shared/aiModels.ts';
import { publicPerimeter } from '../_shared/publicPerimeter.ts';
import { corsFor, readJson, safeError, GuardError } from '../_shared/guard.ts';
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from '../_shared/promptIsolation.ts';
import { z } from 'npm:zod@4';

const searchSchema = z.object({ query: z.string().trim().min(2).max(200), stream: z.boolean().optional() });

Deno.serve(async req => {
  const corsHeaders = corsFor(req);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ available: false, error: 'Method not allowed' }, 405);
  // Server-only switch. Deploying code alone must never start paid anonymous consumption.
  if (Deno.env.get('PUBLIC_PRESENCE_SEARCH_ENABLED') !== 'true') return json({ available: false, results: [] }, 503);
  try {
    const input = await readJson(req, searchSchema, 2048);
    await publicPerimeter(req, "public-digital-presence", 30);
    const dbUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!dbUrl || !serviceKey || !firecrawlKey || !aiKey) return json({ available: false, error: 'Search is not configured' }, 503);
    const admin = createClient(dbUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // Global durable budget is mandatory even when reliable proxy identity is unavailable.
    // RPC must atomically enforce its server-owned limits; callers cannot supply caps.
    const search = await authorizePublicSearch(input, 'public-presence-global', {
      consume: async () => {
        const { data, error } = await admin.rpc('consume_public_presence_search');
        if (error) throw new Error('Search protection unavailable');
        return data === true;
      },
    });
    // Direct Firecrawl mode: verified connection uses provider credentials, not the gateway.
    const response = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: search.query, limit: search.limit }),
    });
    if (!response.ok) {
      const details = await response.text();
      console.error(`Public search provider failed [${response.status}]: ${details}`);
      throw new Error('Public search provider failed');
    }
    const payload = await response.json();
    const sources = sourcedPublicResults(Array.isArray(payload.data) ? payload.data : payload.data?.web ?? payload.web);
    if (!sources.length) return json({ available: true, results: [], source: 'web' });
    const rank = async () => {
      try {
        const ai = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GEMINI_3_FLASH, max_tokens: 200,
        messages: [
          { role: 'system', content: 'Rank public search snippets for relevance. Return JSON {"indices":[0,1,...]} using only supplied numeric indices. Do not generate facts or URLs. ' + PROMPT_INJECTION_DEFENSE_CLAUSE },
          { role: 'user', content: wrapUntrustedContent('Search sources', JSON.stringify({ query: search.query, sources: sources.map((r, index) => ({ index, ...r })) })) },
        ], response_format: { type: 'json_object' } }),
    });
        if (!ai.ok) return { available: true, results: sources, source: 'web', aiAvailable: false, phase: 'complete' };
        const ranked = await ai.json();
        let indices: unknown;
        try { indices = JSON.parse(ranked.choices?.[0]?.message?.content ?? '{}').indices; } catch { indices = undefined; }
        return { available: true, results: rankPublicSources(sources, indices), source: 'web', aiAvailable: true, phase: 'complete' };
      } catch {
        // AI failures must never discard real Web sources already received.
        return { available: true, results: sources, source: 'web', aiAvailable: false, phase: 'complete' };
      }
    };
    if (input.stream === true) {
      const encoder = new TextEncoder();
      let cancelled = false;
      const body = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ available: true, results: sources, source: 'web', phase: 'web' }) + '\n'));
          const result = await rank();
          if (!cancelled) {
            controller.enqueue(encoder.encode(JSON.stringify(result) + '\n'));
            controller.close();
          }
        },
        cancel() { cancelled = true; },
      });
      return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    return json(await rank());
  } catch (error) {
    if (error instanceof Error && error.message === 'Search limit reached') {
      return safeError(new GuardError(429, { available: false, error: 'Search limit reached' }, { 'Retry-After': '60' }), req);
    }
    return safeError(error, req);
  }
});