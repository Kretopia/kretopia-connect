import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { handlePaddleWebhook } from "../_shared/paddleWebhook.ts";

// Paddle Billing notifications (Kretopia subscriptions only). The logic lives in _shared/paddleWebhook.ts.
serve((req) =>
  handlePaddleWebhook(req, {
    db: createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } }),
    env: Deno.env.toObject(),
  })
);
