// Acceptance of Kretopia's Terms and Conditions, recorded on the account itself (auth user metadata) with the version accepted and
// when, so no schema change is needed and the record follows the account across devices. The version is the Terms page's
// "Last updated" date: when the Terms change, bump it and people are asked again where this check runs (onboarding).
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const TERMS_VERSION = "2026-10-07";

export function hasAcceptedCurrentTerms(user: Pick<User, "user_metadata"> | null | undefined): boolean {
  return user?.user_metadata?.terms_version === TERMS_VERSION;
}

/** Records the acceptance; resolves to an error message when it could not be saved (nothing is assumed accepted then). */
export async function recordTermsAcceptance(): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() } });
  return error ? error.message || "Could not save your acceptance." : null;
}
