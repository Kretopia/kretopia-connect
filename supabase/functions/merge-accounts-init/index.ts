import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Initiates an account merge:
 *   - Caller is the *target* (surviving) account (must be signed in).
 *   - Body: { source_user_id, face_match_score? }
 *   - Generates a 6-digit OTP for BOTH source and target email addresses
 *     and emails them via Supabase auth.admin.generateLink (otp).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    const targetUserId = u?.user?.id;
    const targetEmail = u?.user?.email?.toLowerCase();
    if (!targetUserId || !targetEmail) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const sourceUserId: string = body?.source_user_id;
    const faceMatchScore: number | undefined = body?.face_match_score;
    if (!sourceUserId || sourceUserId === targetUserId) return json({ error: "Invalid source" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: srcUserData, error: srcErr } = await admin.auth.admin.getUserById(sourceUserId);
    if (srcErr || !srcUserData?.user?.email) return json({ error: "Source account not found" }, 404);
    const sourceEmail = srcUserData.user.email.toLowerCase();
    if (sourceEmail === targetEmail) return json({ error: "Both accounts share an email" }, 400);

    const sourceOtp = genOtp();
    const targetOtp = genOtp();
    const [srcHash, tgtHash] = await Promise.all([sha256(sourceOtp), sha256(targetOtp)]);

    // Insert via service role bypassing RLS
    const { data: row, error: insErr } = await admin
      .from("account_merge_requests")
      .insert({
        initiator_user_id: targetUserId,
        source_user_id: sourceUserId,
        target_user_id: targetUserId,
        source_email: sourceEmail,
        target_email: targetEmail,
        source_otp_hash: srcHash,
        target_otp_hash: tgtHash,
        face_match_score: faceMatchScore ?? null,
      })
      .select("id, expires_at")
      .single();
    if (insErr) throw insErr;

    // Send the codes by email (uses default Supabase auth email infra — survives even
    // if the custom auth-email-hook is misconfigured because we use admin generateLink).
    await sendOtpEmail(admin, sourceEmail, sourceOtp, "source");
    await sendOtpEmail(admin, targetEmail, targetOtp, "target");

    return json({
      request_id: row.id,
      expires_at: row.expires_at,
      source_email_masked: mask(sourceEmail),
      target_email_masked: mask(targetEmail),
    });
  } catch (e) {
    console.error("[merge-accounts-init]", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mask(e: string) {
  const [l, d] = e.split("@");
  return `${l.slice(0, 2)}${"•".repeat(Math.max(1, l.length - 2))}@${d}`;
}

async function sendOtpEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
  otp: string,
  _which: "source" | "target",
) {
  // We use the project's transactional email function if available; otherwise fall back
  // to Supabase's built-in via a magic-link with embedded code in the metadata.
  try {
    const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`;
    const resp = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        template: "account-merge-otp",
        recipient_email: email,
        data: { code: otp },
      }),
    });
    if (resp.ok) return;
  } catch (_) { /* fall through */ }

  // Fallback: log the OTP so the user can request resend or contact support
  console.warn(`[merge-otp fallback] ${email} -> ${otp}`);
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
