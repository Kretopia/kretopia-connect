import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { generateOtp } from "../_shared/phoneOtp.ts";

import { corsFor } from '../_shared/guard.ts';
// A merge request mails a code to two inboxes, one of which is not the
// caller's: the number of requests one account can open is bounded.
const MAX_MERGE_REQUESTS_PER_HOUR = 3;


/**
 * Initiates an account merge:
 *   - Caller is the *target* (surviving) account (must be signed in).
 *   - Body: { source_user_id, face_match_score? }
 *   - Generates a 6-digit OTP for BOTH source and target email addresses
 *     and emails them via Supabase auth.admin.generateLink (otp).
 */
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
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
    if (!sourceUserId || sourceUserId === targetUserId) return json({ error: "Invalid source" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: srcUserData, error: srcErr } = await admin.auth.admin.getUserById(sourceUserId);
    if (srcErr || !srcUserData?.user?.email) return json({ error: "Source account not found" }, 404);
    const sourceEmail = srcUserData.user.email.toLowerCase();
    if (sourceEmail === targetEmail) return json({ error: "Both accounts share an email" }, 400);

    const { count: recentRequests, error: recentErr } = await admin
      .from("account_merge_requests")
      .select("id", { count: "exact", head: true })
      .eq("initiator_user_id", targetUserId)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (recentErr) return json({ error: "Could not start the verification, try again shortly" }, 503);
    if ((recentRequests ?? 0) >= MAX_MERGE_REQUESTS_PER_HOUR) {
      return json({ error: "Too many merge requests, try again later" }, 429);
    }

    const sourceOtp = generateOtp();
    const targetOtp = generateOtp();
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
        // Never the client's value: nothing in this function can prove a face match.
        face_match_score: null,
      })
      .select("id, expires_at")
      .single();
    if (insErr) throw insErr;

    // Send the codes by email (uses default Supabase auth email infra — survives even
    // if the custom auth-email-hook is misconfigured because we use admin generateLink).
    const [sourceSent, targetSent] = await Promise.all([
      sendOtpEmail(sourceEmail, sourceOtp),
      sendOtpEmail(targetEmail, targetOtp),
    ]);
    if (!sourceSent || !targetSent) {
      // A request whose codes nobody received must not stay open.
      await admin
        .from("account_merge_requests")
        .update({ status: "failed", error: "code_delivery_failed" })
        .eq("id", row.id);
      return json({ error: "We could not send the verification codes. Please try again later." }, 503);
    }

    return json({
      request_id: row.id,
      expires_at: row.expires_at,
      // The other account's address is not shown: the caller supplied only a
      // user id, so a masked address would disclose it to someone who may not own it.
      source_email_masked: "the other account's email address",
      target_email_masked: mask(targetEmail),
    });
  } catch (e) {
    console.error("[merge-accounts-init]", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mask(e: string) {
  const [l, d] = e.split("@");
  return `${l.slice(0, 2)}${"•".repeat(Math.max(1, l.length - 2))}@${d}`;
}

async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  // Delivery goes through the transactional sender with the keys it reads
  // (templateName, recipientEmail, templateData). The code itself is never
  // logged: a failed delivery is reported to the caller, not written to a log.
  try {
    const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`;
    const resp = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        templateName: "account-merge-otp",
        recipientEmail: email,
        templateData: { code: otp },
      }),
    });
    return resp.ok;
  } catch (_) {
    return false;
  }
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
