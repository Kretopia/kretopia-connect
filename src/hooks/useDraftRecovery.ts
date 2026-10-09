import { useCallback, useEffect, useRef, useState } from "react";
import { clearDraft, readDraft, writeDraft } from "@/lib/draftStorage";

/**
 * Keeps what a person is typing safe until the server confirms it is saved.
 *
 *  - while `value` differs from `saved`, it is written to the device (debounced), so a crash, a closed tab,
 *    an expired session or a failed save never costs the text;
 *  - when `key` becomes active (a note is opened) and a different draft exists for it, it is handed to
 *    `onRestore` once and `restoredAt` tells the UI to say so ("Restored your unsaved edits"), with a way
 *    to discard;
 *  - the draft is only deleted by `markSaved()` (after a confirmed save) or `discard()`.
 *
 * `status` is what the UI may truthfully claim: it never says "saved" for something only held locally.
 */
export type DraftStatus = "clean" | "dirty" | "kept-on-device" | "not-kept";

export interface UseDraftRecoveryOptions<T> {
  /** Stable identity of the thing being edited, e.g. draftKey("note", projectId, noteId). null disables. */
  key: string | null;
  /** What the server holds right now (the baseline). */
  saved: T;
  /** What is currently in the editor. */
  value: T;
  /** The server version the edits started from (e.g. updated_at). */
  base?: string | null;
  /** Put a recovered draft back into the editor. */
  onRestore: (value: T) => void;
  /** Skip recovery for this key activation (e.g. the user explicitly started from a template). */
  skipRestore?: boolean;
  debounceMs?: number;
}

const same = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

export function useDraftRecovery<T>({
  key,
  saved,
  value,
  base = null,
  onRestore,
  skipRestore = false,
  debounceMs = 600,
}: UseDraftRecoveryOptions<T>) {
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [status, setStatus] = useState<DraftStatus>("clean");
  const restoredKey = useRef<string | null>(null);
  const savedRef = useRef(saved);
  const onRestoreRef = useRef(onRestore);
  savedRef.current = saved;
  onRestoreRef.current = onRestore;
  const dirtyNow = !same(value, saved);
  const latest = useRef({ key, value, base, dirty: dirtyNow });
  latest.current = { key, value, base, dirty: dirtyNow };

  // Activate a key: bring back unsaved edits, once.
  useEffect(() => {
    setRestoredAt(null);
    if (!key) {
      restoredKey.current = null;
      return;
    }
    if (restoredKey.current === key) return;
    restoredKey.current = key;
    if (skipRestore) {
      clearDraft(key);
      return;
    }
    const draft = readDraft<T>(key);
    if (draft && !same(draft.value, savedRef.current)) {
      onRestoreRef.current(draft.value);
      setRestoredAt(draft.savedAt);
    } else if (draft) {
      clearDraft(key); // identical to what the server holds: nothing to recover
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const dirty = !same(value, saved);

  // Persist while dirty; forget when the editor equals the server.
  useEffect(() => {
    if (!key) return;
    if (!dirty) {
      clearDraft(key);
      setStatus("clean");
      return;
    }
    setStatus("dirty");
    const t = setTimeout(() => {
      const ok = writeDraft(key, value, base);
      setStatus(ok ? "kept-on-device" : "not-kept");
    }, debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dirty, JSON.stringify(value), base, debounceMs]);

  /**
   * Write the current edits to the device right now (skips the debounce). Call it before switching to
   * another document, and it also runs when the tab is hidden or closed.
   */
  const flush = useCallback(() => {
    const l = latest.current;
    if (!l.key || !l.dirty) return;
    setStatus(writeDraft(l.key, l.value, l.base) ? "kept-on-device" : "not-kept");
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (typeof document === "undefined" || document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  /** Call after the server confirmed the save. */
  const markSaved = useCallback(() => {
    if (key) clearDraft(key);
    setRestoredAt(null);
    setStatus("clean");
  }, [key]);

  /** Throw the unsaved edits away and go back to what the server holds. */
  const discard = useCallback(() => {
    if (key) clearDraft(key);
    setRestoredAt(null);
    setStatus("clean");
    onRestoreRef.current(savedRef.current);
  }, [key]);

  return { dirty, status, restoredAt, markSaved, discard, flush };
}
