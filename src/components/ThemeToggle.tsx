import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { saveVibe, getStoredVibe, isVibe, type Vibe } from "@/components/VibeThemeSync";

/** Top-nav toggle: flips between Daylight (light) and Midnight (dark). */
export function ThemeToggle() {
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
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Sun className="h-4 w-4" />
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
      className="h-9 w-9 transition-smooth"
      aria-label={`Switch to ${isDark ? "Daylight" : "Midnight"} vibe`}
      title={isDark ? "Switch to Daylight" : "Switch to Midnight"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
