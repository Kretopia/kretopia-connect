import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { User, Briefcase, DollarSign } from "lucide-react";

/**
 * PassportAnchorStrip — single horizontal nav for Passport surfaces.
 *
 * Cleanup pass: collapsed from 8→4→3 anchors. Pay/Wallet/Receipts moved
 * back to /thrivepay (their own tool surface).
 *
 *   Identity → /profile (the who-you-are page)
 *   Work     → /credits (My Work + Explore tabs)
 *   Hire Me  → /profile#hire (scrolls to hire-me section)
 */

type Anchor = {
  id: string;
  label: string;
  to: string;
  hash?: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, hash: string) => boolean;
};

const ANCHORS: Anchor[] = [
  { id: "identity", label: "Identity", to: "/profile",                icon: User,      match: (p, h) => p === "/profile" && h !== "#hire" },
  { id: "work",     label: "Stamps",   to: "/credits",                icon: Briefcase, match: (p) => p.startsWith("/credits") },
  { id: "hire",     label: "Hire Me",  to: "/profile", hash: "#hire", icon: DollarSign, match: (p, h) => p === "/profile" && h === "#hire" },
];

export function PassportAnchorStrip({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();

  const handleClick = (a: Anchor) => {
    // In-page scroll when already on /profile and target is a hash anchor
    if (pathname === "/profile" && (a.id === "identity" || a.id === "hire")) {
      const targetId = a.id === "identity" ? "identity" : "hire";
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Update hash without full nav
        if (a.hash) history.replaceState(null, "", a.hash);
        else history.replaceState(null, "", "/profile");
        return;
      }
    }
    navigate(a.to + (a.hash || ""));
  };

  return (
    <div className={cn("relative -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 bg-background", className)}>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground pr-2 shrink-0">
          Passport
        </span>
        {ANCHORS.map((a) => {
          const active = a.match(pathname, hash);
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => handleClick(a)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 shrink-0 px-3 h-8 rounded-full text-[12px] font-medium border transition-colors",
                active
                  ? "bg-background text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40 ring-1 ring-[hsl(var(--signal-teal))]/20 shadow-sm"
                  : "bg-foreground/5 hover:bg-foreground/10 text-foreground/75 border-transparent"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PassportAnchorStrip;
