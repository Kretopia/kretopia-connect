import { createClient } from "@supabase/supabase-js";
import { brokeredPreviewStorage } from "./previewAuthStorage";
import type { Database } from "./legacyTypes";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function legacyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  if (publishableKey.startsWith("sb_publishable_") && headers.get("Authorization") === `Bearer ${publishableKey}`) {
    headers.delete("Authorization");
  }
  headers.set("apikey", publishableKey);
  return fetch(input, { ...init, headers });
}

export const supabase = createClient<Database>(supabaseUrl, publishableKey, {
  global: { fetch: legacyFetch },
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});