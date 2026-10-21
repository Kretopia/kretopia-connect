import { createContext, useContext, type RefObject } from "react";

export type CallWindowMode = "full" | "floating" | "minimized";

export interface CallWindowState {
  mode: CallWindowMode;
  rootRef: RefObject<HTMLDivElement>;
  /** Shrinks the full-screen call to the miniature (which keeps the video visible). */
  minimize: () => void;
}

export const CallWindowContext = createContext<CallWindowState | null>(null);

/** Where the call currently lives, for UI inside it that must not cover the window's own controls. Null outside a call window. */
export const useCallWindow = () => useContext(CallWindowContext);
