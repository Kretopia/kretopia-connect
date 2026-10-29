// Client side of "Strengthen your Passport": ask the draft function once, show what came back, and write only the
// fields the person accepted. A draft is never saved by asking for it, and a saved work item is self-reported.

export type DraftField = "bio" | "photo" | "work_item";
export type Decision = "accepted" | "rejected";

export interface PassportDraft {
  bio: { text: string } | null;
  photo: { url: string; source: "auth_provider" | "credit_media" } | null;
  work_item: { project_name: string; role: string; url: string; source_label: string } | null;
}

export type UnavailableReason = "already_complete" | "not_enough_facts" | "unsupported_claims" | "no_candidates" | "nothing_suitable";

export type DraftOutcome =
  | { status: "ready"; draft: PassportDraft; unavailable: Partial<Record<DraftField, UnavailableReason>>; partial: boolean }
  | { status: "failed"; code: string; message: string };

export const FIELD_ORDER: DraftField[] = ["bio", "photo", "work_item"];
export const FIELD_LABEL: Record<DraftField, string> = { bio: "Bio", photo: "Photo", work_item: "Work item" };

export const REASON_COPY: Record<UnavailableReason, string> = {
  already_complete: "Already on your Passport.",
  not_enough_facts: "Kreto needs more on your profile (role, skills or a credit) to write this honestly.",
  unsupported_claims: "The draft said more than your profile supports, so it was discarded.",
  no_candidates: "Nothing you already have on Kretopia can fill this in.",
  nothing_suitable: "Nothing you already have looked suitable.",
};

const FAILURE_COPY: Record<string, string> = {
  rate_limited: "Too many requests. Try again in a minute.",
  ai_credits: "Drafting is paused right now.",
  ai_unavailable: "Drafting is not available right now.",
  profile_unreadable: "Your profile could not be read.",
  ai_failed: "The draft could not be written.",
  ai_unreadable: "The draft could not be read.",
};

type Invoke = (name: string, opts: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>;

/** One call. A transport error, an error body or an unreadable answer is a failure the person can retry. */
export async function requestPassportDraft(invoke: Invoke): Promise<DraftOutcome> {
  let result: { data: unknown; error: unknown };
  try {
    result = await invoke("draft-passport-profile", { body: {} });
  } catch {
    return { status: "failed", code: "network", message: "Could not reach Kreto. Check your connection and try again." };
  }
  let payload = result.data as { ok?: boolean; code?: string; error?: string; draft?: Partial<PassportDraft>; unavailable?: Record<string, UnavailableReason> } | null;
  if (result.error) {
    try {
      payload = await (result.error as { context: Response }).context.json();
    } catch {
      payload = { ok: false, code: "unavailable" };
    }
  }
  if (!payload || payload.ok !== true || !payload.draft) {
    const code = payload?.code ?? "unavailable";
    return { status: "failed", code, message: FAILURE_COPY[code] ?? payload?.error ?? "The draft could not be prepared." };
  }
  const draft: PassportDraft = {
    bio: payload.draft.bio?.text ? { text: payload.draft.bio.text } : null,
    photo: payload.draft.photo?.url ? payload.draft.photo : null,
    work_item: payload.draft.work_item?.url ? payload.draft.work_item : null,
  };
  const unavailable = (payload.unavailable ?? {}) as Partial<Record<DraftField, UnavailableReason>>;
  const offered = FIELD_ORDER.filter((f) => draft[f]);
  const missing = FIELD_ORDER.filter((f) => unavailable[f] !== "already_complete");
  return { status: "ready", draft, unavailable, partial: offered.length < missing.length };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export interface SaveResult {
  saved: DraftField[];
  failed: { field: DraftField; message: string }[];
}

/** Writes only the accepted fields. Each write is checked: a field that did not save is reported, never assumed. */
export async function savePassportDraft(db: Db, userId: string, draft: PassportDraft, accepted: DraftField[]): Promise<SaveResult> {
  const out: SaveResult = { saved: [], failed: [] };

  const profileUpdate: Record<string, string> = {};
  if (accepted.includes("bio") && draft.bio) profileUpdate.bio = draft.bio.text;
  if (accepted.includes("photo") && draft.photo) profileUpdate.avatar_url = draft.photo.url;
  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await db.from("profiles").update(profileUpdate).eq("user_id", userId);
    const fields = (["bio", "photo"] as const).filter((f) => accepted.includes(f) && draft[f]);
    if (error) fields.forEach((field) => out.failed.push({ field, message: "Your profile could not be updated." }));
    else out.saved.push(...fields);
  }

  if (accepted.includes("work_item") && draft.work_item) {
    const w = draft.work_item;
    const { data: existing, error: lookupError } = await db.from("credits").select("id").eq("user_id", userId).eq("url", w.url).limit(1).maybeSingle();
    if (lookupError) out.failed.push({ field: "work_item", message: "Could not check your existing work." });
    else if (existing) out.saved.push("work_item"); // already there: adding it twice would not help
    else {
      const { error } = await db.from("credits").insert({
        user_id: userId,
        project_name: w.project_name,
        role: w.role,
        url: w.url,
        source: "portfolio",
        // The claim rung: a link the person points to, not a credit anyone has verified.
        verification_status: "self_reported",
        credit_category: "Other",
        tags: [],
      });
      if (error) out.failed.push({ field: "work_item", message: "The work item could not be added." });
      else out.saved.push("work_item");
    }
  }
  return out;
}
