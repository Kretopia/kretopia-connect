// Ambassador referral attribution
// 1. Captures ?amb=CODE from any URL into sessionStorage / localStorage on first arrival.
// 2. After sign-in, writes the code to profiles.referred_by_ambassador (one-shot).
// 3. Exposes a verification helper used by the Ambassador dashboard / debug tools.

import { supabase } from "@/integrations/supabase/client";

const KEY = "thrivein_amb_code";
// localStorage mirror so the code survives an OAuth redirect that wipes sessionStorage.
const PERSIST_KEY = "thrivein_amb_code_persist";

export type AttributionStage =
  | "none"            // no code seen
  | "captured"        // code is in storage, not yet attached
  | "attached"        // code is on the user's profile
  | "invalid"         // code didn't match any ambassador
  | "already_set";    // user already had a different ambassador attributed

export interface AttributionStatus {
  stage: AttributionStage;
  capturedCode: string | null;       // what's currently in storage
  profileCode: string | null;        // what's on the profile (if signed in)
  ambassadorName: string | null;     // resolved owner of capturedCode (if valid)
  checkedAt: string;
}

function readCaptured(): string | null {
  try {
    return (
      sessionStorage.getItem(KEY) ||
      localStorage.getItem(PERSIST_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

function clearCaptured() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // ignore
  }
}

/** Call once on app boot (or any time on landing) to capture ?amb= */
export function captureAmbassadorCodeFromUrl() {
  try {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("amb");
    if (!code) return;
    const clean = code.trim().toUpperCase().slice(0, 12);
    if (!clean) return;
    sessionStorage.setItem(KEY, clean);
    try { localStorage.setItem(PERSIST_KEY, clean); } catch { /* ignore */ }
    console.info("[ambassadorAttribution] captured code", clean);
  } catch {
    // ignore
  }
}

/** After auth, attach the captured code to the user's profile (idempotent). */
export async function attachAmbassadorCodeToProfile(userId: string) {
  try {
    const code = readCaptured();
    if (!code) return;
    // Verify the code corresponds to a real ambassador
    const { data: amb } = await supabase.rpc("get_ambassador_by_code", { _code: code });
    if (!amb || (Array.isArray(amb) && amb.length === 0)) {
      console.warn("[ambassadorAttribution] invalid code, clearing", code);
      clearCaptured();
      return;
    }
    // Don't overwrite if already set
    const { data: profile } = await supabase
      .from("profiles")
      .select("referred_by_ambassador")
      .eq("user_id", userId)
      .maybeSingle();
    const p = profile as { referred_by_ambassador: string | null } | null;
    if (p && !p.referred_by_ambassador) {
      const { error } = await supabase
        .from("profiles")
        .update({ referred_by_ambassador: code })
        .eq("user_id", userId);
      if (error) {
        console.warn("[ambassadorAttribution] update failed", error);
        return; // keep code in storage so we retry on next sign-in
      }
      console.info("[ambassadorAttribution] attached code", code);
    } else {
      console.info("[ambassadorAttribution] profile already has ambassador, skipping");
    }
    clearCaptured();
  } catch (e) {
    console.warn("[ambassadorAttribution] attach failed", e);
  }
}

/**
 * Inspect the current attribution state.
 * Safe to call signed-out (profileCode will be null).
 */
export async function getAttributionStatus(userId?: string | null): Promise<AttributionStatus> {
  const capturedCode = readCaptured();
  let ambassadorName: string | null = null;
  let stage: AttributionStage = capturedCode ? "captured" : "none";

  if (capturedCode) {
    try {
      const { data } = await supabase.rpc("get_ambassador_by_code", { _code: capturedCode });
      const row = Array.isArray(data) ? data[0] : null;
      if (row && (row as any).ambassador_code) {
        ambassadorName = (row as any).full_name ?? null;
      } else {
        stage = "invalid";
      }
    } catch (e) {
      console.warn("[ambassadorAttribution] verify failed", e);
    }
  }

  let profileCode: string | null = null;
  if (userId) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("referred_by_ambassador")
        .eq("user_id", userId)
        .maybeSingle();
      profileCode = ((profile as any)?.referred_by_ambassador as string | null) ?? null;
      if (profileCode) {
        if (capturedCode && capturedCode !== profileCode) {
          stage = "already_set";
        } else {
          stage = "attached";
        }
      }
    } catch (e) {
      console.warn("[ambassadorAttribution] profile read failed", e);
    }
  }

  return {
    stage,
    capturedCode,
    profileCode,
    ambassadorName,
    checkedAt: new Date().toISOString(),
  };
}

/** Force re-run of attach (useful after a user signs up while a code is captured). */
export async function retryAttachment(userId: string) {
  await attachAmbassadorCodeToProfile(userId);
  return getAttributionStatus(userId);
}
