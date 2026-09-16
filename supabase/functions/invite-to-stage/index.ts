import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://www.kretopia.com";

/**
 * Host-only: invite emails to a private/unlisted curated stage.
 * Adds rows to curated_stage_invites and best-effort fires a transactional email
 * with a magic join link that carries the stage's invite_token.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const stage_id = String(body?.stage_id || "");
    const emailsInput: unknown = body?.emails;
    const personalNote: string = String(body?.note || "").slice(0, 500);
    if (!stage_id) throw new Error("stage_id required");

    const emails = Array.isArray(emailsInput)
      ? emailsInput
          .map((e) => String(e || "").trim().toLowerCase())
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
          .slice(0, 100)
      : [];
    if (!emails.length) throw new Error("At least one valid email required");

    const { data: stage } = await admin
      .from("curated_stages")
      .select("id, host_user_id, title, starts_at, invite_token, visibility")
      .eq("id", stage_id)
      .maybeSingle();
    if (!stage) throw new Error("Stage not found");
    if (stage.host_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the host can invite" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure an invite_token exists (legacy public stages flipped to private may not have one yet)
    let inviteToken = stage.invite_token;
    if (!inviteToken) {
      inviteToken = Array.from(crypto.getRandomValues(new Uint8Array(18)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      await admin.from("curated_stages").update({ invite_token: inviteToken }).eq("id", stage_id);
    }

    // Upsert one row per email (idempotent).
    const rows = emails.map((email) => ({
      stage_id, email, invited_by: user.id, status: "invited",
    }));
    const { data: inserted, error } = await admin
      .from("curated_stage_invites")
      .upsert(rows, { onConflict: "stage_id,email" })
      .select("id, email, token");
    if (error) throw error;

    // Host name for the email
    const { data: hostProfile } = await admin
      .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const hostName = hostProfile?.full_name || "A host on Kretopia";

    // Best-effort transactional email per invitee
    const stageLink = `${APP_URL}/circle/stage/${stage_id}?invite=${inviteToken}`;
    await Promise.all(
      (inserted || []).map((row) =>
        admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "curated-stage-invite",
            recipientEmail: row.email,
            idempotencyKey: `stage-invite-${row.id}`,
            templateData: {
              hostName,
              stageTitle: stage.title,
              startsAt: stage.starts_at,
              joinUrl: stageLink,
              personalNote: personalNote || undefined,
            },
          },
        }).catch((e) => console.warn("[invite-to-stage] email failed", row.email, e?.message)),
      ),
    );

    return new Response(JSON.stringify({
      invited: inserted?.length ?? 0,
      invite_token: inviteToken,
      share_url: stageLink,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[invite-to-stage]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
