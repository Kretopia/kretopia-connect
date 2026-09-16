import { useEffect, useRef, useCallback } from "react";

const AUTOSAVE_DELAY = 2000; // 2 seconds debounce

export function useAutoSaveDraft<T>(
  key: string,
  data: T,
  isActive: boolean
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with debounce
  useEffect(() => {
    if (!isActive) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const payload = { data, savedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(payload));
      } catch (e) {
        console.warn("Auto-save failed:", e);
      }
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, data, isActive]);

  const loadDraft = useCallback((): { data: T; savedAt: number } | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Only return drafts less than 7 days old
      if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [key]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [key]);

  const hasDraft = useCallback((): boolean => {
    return loadDraft() !== null;
  }, [loadDraft]);

  return { loadDraft, clearDraft, hasDraft };
}
