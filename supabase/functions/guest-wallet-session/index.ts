import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-guest-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  email: z.string().trim().email().max(255).transform((s) => s.toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hashCode(email: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${email}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid email or code" }, 400);
    const { email, code } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---------- STEP 1: request a verification code ----------
    if (!code) {
      // Basic abuse guard: max 5 codes per email per hour
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("guest_wallet_email_codes")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", since);
      if ((count ?? 0) >= 5) {
        return json({ error: "Too many verification requests. Try again later." }, 429);
      }

      const generated = String(Math.floor(100000 + Math.random() * 900000));
      const { error: insertError } = await admin
        .from("guest_wallet_email_codes")
        .insert({ email, code_hash: await hashCode(email, generated) });
      if (insertError) throw insertError;

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        // Fail closed — never mint a session without a delivered code.
        return json({ error: "Email verification is temporarily unavailable" }, 503);
      }

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Kretopia <info@kretopia.com>",
          to: [email],
          subject: `${generated} is your Kretopia wallet code`,
          html: `<p>Your Kretopia guest wallet verification code is:</p>
                 <p style="font-size:28px;font-weight:700;letter-spacing:4px">${generated}</p>
                 <p>This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
        }),
      });
      if (!emailRes.ok) {
        console.error("[guest-wallet-session] email send failed", emailRes.status);
        return json({ error: "Could not send verification email" }, 502);
      }

      return json({ requiresCode: true });
    }

    // ---------- STEP 2: verify the code, then mint the session ----------
    const { data: record } = await admin
      .from("guest_wallet_email_codes")
      .select("id, code_hash, attempts, expires_at, consumed_at")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!record) return json({ error: "Request a new code" }, 401);
    if (new Date(record.expires_at) < new Date()) return json({ error: "Code expired" }, 401);
    if (record.attempts >= 5) return json({ error: "Too many attempts. Request a new code." }, 429);

    const expected = await hashCode(email, code);
    if (expected !== record.code_hash) {
      await admin
        .from("guest_wallet_email_codes")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);
      return json({ error: "Incorrect code" }, 401);
    }

    await admin
      .from("guest_wallet_email_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", record.id);

    // Upsert wallet only after ownership of the email is proven
    const { data: existing } = await admin
      .from("guest_wallets")
      .select("id, balance_cents, currency")
      .eq("email", email)
      .maybeSingle();

    let walletId: string;
    let balance = 0;
    let currency = "USD";

    if (existing) {
      walletId = existing.id;
      balance = existing.balance_cents;
      currency = existing.currency;
    } else {
      const { data: created, error } = await admin
        .from("guest_wallets")
        .insert({ email })
        .select("id, balance_cents, currency")
        .single();
      if (error) throw error;
      walletId = created.id;
      balance = created.balance_cents;
      currency = created.currency;
    }

    const { data: session, error: sessionError } = await admin
      .from("guest_wallet_sessions")
      .insert({ wallet_id: walletId })
      .select("token, expires_at")
      .single();
    if (sessionError) throw sessionError;

    return json({
      token: session.token,
      expiresAt: session.expires_at,
      walletId,
      balanceCents: balance,
      currency,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[guest-wallet-session] error:", msg);
    return json({ error: "Could not start session" }, 500);
  }
});
