// Helpers shared by weekly bulk emails sent through Resend.
// (send-weekly-digest still carries its own copy of fetchAllRows and
// getUnsubscribeToken; moving it onto this module is a follow-up.)

export const SITE_URL = "https://www.kretopia.com";

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** UTC date (YYYY-MM-DD) of the Monday that starts the current week. */
export function currentMondayISO(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff)).toISOString().slice(0, 10);
}

// PostgREST returns at most 1000 rows per request; page through the rest.
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// One unsubscribe token per address, same scheme as send-transactional-email
// (email_unsubscribe_tokens + the /unsubscribe page). Returns null when the
// address already used its token or no token can be stored: such an email is
// never sent without a working unsubscribe link.
export async function getUnsubscribeToken(admin: any, email: string): Promise<string | null> {
  const normalized = email.toLowerCase();
  const { data: existing, error } = await admin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (error) return null;
  if (existing) return existing.used_at ? null : existing.token;

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error: upsertError } = await admin
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
  if (upsertError) return null;
  const { data: stored } = await admin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  return stored?.token ?? null;
}

/** profiles.professional_skills is a JSON array of strings or { skill } objects. */
export function skillNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === "string" ? s : (s as { skill?: string } | null)?.skill || ""))
    .map((s) => s.trim())
    .filter(Boolean);
}
