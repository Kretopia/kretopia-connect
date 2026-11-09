import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { saveVibe, getStoredVibe, isVibe, type Vibe } from "@/components/VibeThemeSync";
import { NAV_ICON, NAV_ICON_BUTTON, NAV_ICON_STROKE, SUN_ICON } from "@/components/nav/navIcon";
import { cn } from "@/lib/utils";

/** Top-nav toggle: flips between Daylight (light) and Midnight (dark). */
export function ThemeToggle({ className }: { className?: string }) {
  const [vibe, setVibe] = useState<Vibe>("daylight");
  const [mounted, setMounted] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    setVibe(getStoredVibe());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (isVibe(detail)) setVibe(detail);
    };
    window.addEventListener("ui-vibe:change", onChange);
    return () => window.removeEventListener("ui-vibe:change", onChange);
  }, []);

  const isDark = vibe !== "daylight";

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={cn(NAV_ICON_BUTTON, className)}>
        <Sun className={NAV_ICON} {...SUN_ICON} />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        const next: Vibe = isDark ? "daylight" : "midnight";
        setVibe(next);
        saveVibe(next, setTheme);
      }}
      className={cn(NAV_ICON_BUTTON, "transition-smooth", className)}
      aria-label={`Switch to ${isDark ? "Daylight" : "Midnight"} vibe`}
      title={isDark ? "Switch to Daylight" : "Switch to Midnight"}
    >
      {isDark ? <Sun className={NAV_ICON} {...SUN_ICON} /> : <Moon className={NAV_ICON} strokeWidth={NAV_ICON_STROKE} />}
    </Button>
  );
}
