import { supabase } from "@/integrations/supabase/client";
import { isFeatureEnabled, type FeatureFlag } from "@/lib/featureFlags";

// Typed client for the buildathon sponsor AI adapters (nebius-inference,
// minimax-inference edge functions). Both flags default off and no API
// keys are configured server-side yet, so every call today returns a
// mock-mode response (mode: "mock") -- this exists so a future feature can
// be built against a stable, typed contract without waiting on real
// credentials. Not wired into any UI yet.

export interface AIProviderRequest {
  prompt: string;
  system?: string;
  maxTokens?: number;
}

export interface AIProviderResult {
  text: string;
  mode: "mock" | "live";
  model?: string;
  latencyMs: number;
}

async function invokeProvider(
  functionName: "nebius-inference" | "minimax-inference",
  flag: FeatureFlag,
  request: AIProviderRequest,
): Promise<AIProviderResult> {
  if (!isFeatureEnabled(flag)) {
    throw new Error(`${flag} is disabled`);
  }
  const { data, error } = await supabase.functions.invoke(functionName, { body: request });
  if (error) throw error;
  return data as AIProviderResult;
}

export const callNebius = (request: AIProviderRequest) =>
  invokeProvider("nebius-inference", "FEATURE_NEBIUS_INFERENCE", request);

export const callMiniMax = (request: AIProviderRequest) =>
  invokeProvider("minimax-inference", "FEATURE_MINIMAX_INFERENCE", request);
