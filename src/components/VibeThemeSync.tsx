import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Neon retired -- exactly two selectable vibes now (see VibePicker). The DB
// column's CHECK constraint still allows 'neon' for any pre-existing rows
// (not migrated, out of scope here); normalizeVibe() below is what keeps
// those rows from ever reaching the UI as a third, unselectable option.
export type Vibe = "daylight" | "midnight";
const STORAGE_KEY = "ui_vibe";

export function isVibe(v: unknown): v is Vibe {
  return v === "daylight" || v === "midnight";
}

/** Coerces any stored value -- including the retired "neon" -- to a
 *  supported vibe, defaulting unknown/missing values to Midnight (the
 *  product's current default look). */
function normalizeVibe(v: unknown): Vibe {
  return isVibe(v) ? v : "midnight";
}

export function applyVibe(vibe: Vibe, setNextTheme?: (t: string) => void) {
  document.documentElement.setAttribute("data-vibe", vibe);
  try {
    localStorage.setItem(STORAGE_KEY, vibe);
  } catch {}
  // Midnight uses the .dark class so shadcn dark variants apply.
  if (setNextTheme) {
    setNextTheme(vibe === "daylight" ? "light" : "dark");
  }
  window.dispatchEvent(new CustomEvent("ui-vibe:change", { detail: vibe }));
}

export function getStoredVibe(): Vibe {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v !== null) return normalizeVibe(v);
  } catch {}
  return "midnight";
}

/**
 * Mirrors ModeThemeSync. index.html's own inline script already applies
 * the stored vibe before first paint (see index.html) so there's no flash
 * of the wrong theme -- this hook just wires that same value into
 * next-themes/React state, then reconciles with profiles.ui_vibe for a
 * signed-in user (e.g. picked on another device) once that fetch resolves,
 * strictly after first paint so it never re-introduces the flicker.
 */
export function VibeThemeSync() {
  const { setTheme } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    applyVibe(getStoredVibe(), setTheme);
  }, [setTheme]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("ui_vibe")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (cancelled || !data?.ui_vibe) return;
          const remote = normalizeVibe(data.ui_vibe);
          if (remote !== getStoredVibe()) applyVibe(remote, setTheme);
        },
        () => {},
      );
    return () => {
      cancelled = true;
    };
  }, [user, setTheme]);

  return null;
}

/** Persist a vibe to the user's profile + apply locally. Pass next-themes'
 *  setTheme (from useTheme()) so the .dark class actually flips immediately
 *  -- without it, applyVibe only sets data-vibe/localStorage and the visible
 *  theme wouldn't change until the next full page load re-ran VibeThemeSync's
 *  own mount effect (which does pass setTheme). */
export async function saveVibe(vibe: Vibe, setNextTheme?: (t: string) => void) {
  applyVibe(vibe, setNextTheme);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ ui_vibe: vibe } as any)
      .eq("user_id", user.id);
  } catch (err) {
    console.warn("[saveVibe] failed", err);
  }
}
