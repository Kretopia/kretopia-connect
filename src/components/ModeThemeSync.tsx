import { useEffect } from "react";
import { useNavMode } from "@/hooks/useNavMode";

/**
 * Syncs the current nav mode to a data attribute on <html> so CSS
 * tokens (--mode-accent, --mode-glow) update automatically.
 */
export function ModeThemeSync() {
  const { mode } = useNavMode();

  useEffect(() => {
    document.documentElement.setAttribute("data-nav-mode", mode);
    return () => document.documentElement.removeAttribute("data-nav-mode");
  }, [mode]);

  return null;
}
