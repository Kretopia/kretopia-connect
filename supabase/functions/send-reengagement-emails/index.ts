import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ISO week number for weekly idempotency (one email per user per week max)
function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

const DAILY_CAP = 30; // protect sender reputation during ramp-up

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[REENGAGE] Starting re-engagement job");

    const now = new Date();
    const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
    const sevenDaysAgo = toDateStr(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = toDateStr(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000));

    // last_active_date is a DATE column — pass YYYY-MM-DD strings.
    const { data: dormant, error: dormantError } = await supabase
      .from("profiles")
      .select("user_id, full_name, last_active_date, updated_at")
      .gte("last_active_date", sixtyDaysAgo)
      .lte("last_active_date", sevenDaysAgo)
      .order("last_active_date", { ascending: false })
      .limit(DAILY_CAP);

    if (dormantError) throw dormantError;

    console.log(`[REENGAGE] Found ${dormant?.length || 0} dormant users`);

    if (!dormant || dormant.length === 0) {
      return new Response(
        JSON.stringify({ message: "No dormant users", enqueued: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Active gigs count for personalization
    const { count: activeGigsCount } = await supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    const week = isoWeek(now);
    let enqueued = 0;
    const errors: string[] = [];

    for (const user of dormant) {
      try {
        // Resolve email via auth admin
        const { data: u, error: uErr } = await supabase.auth.admin.getUserById(user.user_id);
        if (uErr || !u?.user?.email) continue;
        const email = u.user.email;

        const daysInactive = user.last_active_date
          ? Math.floor((now.getTime() - new Date(user.last_active_date).getTime()) / 86400000)
          : 0;

        const idempotencyKey = `reengage-${user.user_id}-${week}`;

        const { error: invokeErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "re-engagement",
            recipientEmail: email,
            idempotencyKey,
            // Sanitize: filter out generic seed names like "New User", "Test", etc.
            templateData: (() => {
              const raw = (user.full_name || "").trim();
              const first = raw.split(/\s+/)[0] || "";
              const generic = /^(new|test|user|creative|guest|anonymous|unknown)$/i;
              const safeName = first && !generic.test(first) && first.length > 1 ? first : null;
              return {
                name: safeName,
                daysInactive,
                activeGigsCount: activeGigsCount ?? 0,
              };
            })(),
          },
        });

        if (invokeErr) {
          errors.push(`${email}: ${invokeErr.message}`);
        } else {
          enqueued++;
        }
      } catch (err: any) {
        errors.push(`${user.user_id}: ${err.message}`);
      }
    }

    console.log(`[REENGAGE] Enqueued ${enqueued}, errors ${errors.length}`);

    return new Response(
      JSON.stringify({ success: true, enqueued, dormantCount: dormant.length, errors: errors.slice(0, 10) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[REENGAGE] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
