// Unsaved-work safety net: a small, defensive wrapper around localStorage for
// drafts (a note being typed, a credit being filled in).
//
// Rules this module guarantees:
//   * it never throws (private windows, blocked storage, quota, corrupt JSON all read as "no draft"),
//   * a draft expires (14 days) so abandoned text does not sit on a shared device forever,
//   * a draft is only ever removed on purpose: after a confirmed save, an explicit discard, or expiry,
//   * everything lives under one prefix so "sign out / clear my drafts" can wipe it in one call.

const PREFIX = "kretopia:draft:";
const VERSION = 1;
export const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_CHARS = 400_000;

export interface StoredDraft<T> {
  v: number;
  /** When the draft was last written (ms since epoch). */
  savedAt: number;
  /** The server version the edits started from (e.g. updated_at), if any. */
  base: string | null;
  value: T;
}

const storage = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const draftKey = (...parts: Array<string | number | null | undefined>) =>
  PREFIX + parts.map((p) => String(p ?? "_")).join(":");

export function readDraft<T>(key: string, now = Date.now()): StoredDraft<T> | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || parsed.v !== VERSION || typeof parsed.savedAt !== "number" || !("value" in parsed)) {
      s.removeItem(key);
      return null;
    }
    if (now - parsed.savedAt > DRAFT_TTL_MS) {
      s.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Returns false when the draft could not be kept (storage unavailable, quota, too large). */
export function writeDraft<T>(key: string, value: T, base: string | null = null, now = Date.now()): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const raw = JSON.stringify({ v: VERSION, savedAt: now, base, value } satisfies StoredDraft<T>);
    if (raw.length > MAX_CHARS) return false;
    s.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    /* nothing to clear */
  }
}

/** Remove every draft written by this module (call on explicit sign-out of a shared device). */
export function clearAllDrafts(): number {
  const s = storage();
  if (!s) return 0;
  let n = 0;
  try {
    for (const k of Object.keys(s)) {
      if (k.startsWith(PREFIX)) {
        s.removeItem(k);
        n++;
      }
    }
  } catch {
    /* ignore */
  }
  return n;
}

/** Drop expired drafts; cheap, safe to run once on app start. */
export function sweepExpiredDrafts(now = Date.now()): number {
  const s = storage();
  if (!s) return 0;
  let n = 0;
  try {
    for (const k of Object.keys(s)) {
      if (!k.startsWith(PREFIX)) continue;
      const d = readDraft(k, now); // readDraft removes expired / corrupt entries
      if (!d) n++;
    }
  } catch {
    /* ignore */
  }
  return n;
}
