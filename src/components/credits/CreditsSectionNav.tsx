import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "hire-me", label: "Hire Me" },
  { id: "stamps", label: "Stamps" },
  { id: "activity", label: "Activity" },
  { id: "record", label: "Full record" },
  { id: "insights", label: "Next steps" },
];

/**
 * CreditsSectionNav — sticky anchor strip for the Credits dashboard, mirroring
 * the Passport anchor strip pattern. Solid background (no blur) per brand rules.
 */
export function CreditsSectionNav() {
  const [active, setActive] = useState<string>("identity");

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: [0.1, 0.4] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      aria-label="Credits sections"
      className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background px-4 py-2"
    >
      <ul className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              aria-current={active === s.id ? "true" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                active === s.id
                  ? "border-[hsl(var(--accent-passport))] bg-[hsl(var(--accent-passport))]/10 text-[hsl(var(--accent-passport))]"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default CreditsSectionNav;
