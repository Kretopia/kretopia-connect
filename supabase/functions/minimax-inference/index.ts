// Buildathon sponsor adapter: MiniMax.
// Contract: OpenAI-compatible chat-completions style per
// platform.minimax.io/docs. MINIMAX_API_KEY is not configured anywhere yet
// -- this runs in mock mode until it is. Verify the exact base URL and
// model id against MiniMax's docs before relying on it for anything real;
// MiniMax also documents Anthropic- and Responses-compatible request
// shapes, this adapter only implements the OpenAI-compatible one.
//
// Required env var (Supabase Edge Function secret, never client-side):
//   MINIMAX_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callAIProvider, type AIProviderRequest } from "../_shared/aiProviderAdapter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MINIMAX_MODEL = "MiniMax-M2"; // placeholder -- confirm against MiniMax model catalog

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const body = (await req.json()) as AIProviderRequest;
    if (!body?.prompt || typeof body.prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = await callAIProvider(body, {
      apiKey: Deno.env.get('MINIMAX_API_KEY'),
      endpoint: "https://api.minimax.io/v1/text/chatcompletion_v2",
      model: MINIMAX_MODEL,
      mockText: "No MINIMAX_API_KEY configured yet -- this is a mock response so the caller can be built and tested ahead of real credentials.",
      buildBody: (r, model) => ({
        model,
        messages: [
          ...(r.system ? [{ role: "system", content: r.system }] : []),
          { role: "user", content: r.prompt },
        ],
        max_tokens: r.maxTokens ?? 512,
      }),
      extractText: (json) => json?.choices?.[0]?.message?.content ?? "",
    });

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("[minimax-inference] error", error instanceof Error ? error.message : String(error));
    const message = error instanceof Error && error.message === "AI_PROVIDER_UNAVAILABLE"
      ? "MiniMax is temporarily unavailable. Try again shortly."
      : "Couldn't complete that request.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
