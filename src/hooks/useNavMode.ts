import { useState, useCallback, useEffect, useSyncExternalStore } from "react";

export type NavMode = "create" | "work";

const STORAGE_KEY = "thrivein-nav-mode";
const listeners = new Set<() => void>();
let currentMode: NavMode = (() => {
  try {
    return (localStorage.getItem(STORAGE_KEY) as NavMode) || "create";
  } catch {
    return "create";
  }
})();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentMode;
}

function setModeGlobal(m: NavMode) {
  if (m === currentMode) return;
  currentMode = m;
  try { localStorage.setItem(STORAGE_KEY, m); } catch {}
  emitChange();
}

// Sync across tabs / same-tab storage events
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      currentMode = e.newValue as NavMode;
      emitChange();
    }
  });
}

export function useNavMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setMode = useCallback((m: NavMode) => setModeGlobal(m), []);
  const toggle = useCallback(() => setModeGlobal(currentMode === "create" ? "work" : "create"), []);

  return { mode, setMode, toggle };
}
