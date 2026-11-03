import { useCallback, useState } from "react";

/**
 * useState that survives leaving the page and coming back in the same tab (sessionStorage, never localStorage: it is not kept beyond
 * the session). Storage can be missing or blocked, so every access is guarded and the state then simply behaves like useState.
 */
export function useSessionState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* unreadable or blocked: start from the default */
    }
    return initial;
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* not stored: still correct for this visit */
      }
    },
    [key],
  );
  return [value, update];
}
