import { useEffect, useSyncExternalStore } from "react";
import type { KretoSceneId } from "@/components/brand/kretoScenes";

/**
 * Hand-off between a page's FeaturePageHeader (which knows the feature's Kreto
 * scene) and its FeatureWrapped panel (the main component). When both are
 * mounted, the panel draws the scene banner as its own head and the header
 * stops drawing it, so the Kretopia x feature banner is fused, never doubled.
 */
type State = { scene: KretoSceneId | null; label: string; panels: number };
let state: State = { scene: null, label: "", panels: 0 };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const get = () => state;

export function useFeatureSceneState() {
  return useSyncExternalStore(subscribe, get, get);
}

export function usePublishFeatureScene(scene: KretoSceneId | undefined, label: string) {
  useEffect(() => {
    if (!scene) return;
    set({ scene, label });
    return () => {
      if (state.scene === scene) set({ scene: null, label: "" });
    };
  }, [scene, label]);
}

export function useRegisterFeaturePanel() {
  useEffect(() => {
    set({ panels: state.panels + 1 });
    return () => set({ panels: Math.max(0, state.panels - 1) });
  }, []);
}
