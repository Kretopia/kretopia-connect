import { useLocation } from "react-router-dom";
import { Mic, Sparkles, ArrowUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { inferSurface } from "@/lib/thriveCopilot";

/**
 * The Thrive Bar — a persistent composer docked above the mobile bottom nav.
 * Replaces the floating "Chat" pill so it never sits on top of content.
 *
 * Tap the input → opens the Copilot drawer (text mode).
 * Tap the mic → opens the drawer in voice mode (auto-starts recording).
 *
 * Hidden on desktop (KretoLauncher handles it there), on full-screen surfaces
 * (auth, onboarding, calls), and on the Desk Messages tab.
 */

const HIDDEN_PATH_PREFIXES = [
  "/auth",
  "/login",
  "/signup",
  "/onboarding",
  "/claim",
  "/accept-invite",
  "/landing",
  "/check-in",
  "/call/",
  "/guest-call",
  "/messages",
  "/epk/",
  "/u/",
  "/site/",
  "/website-builder",
];

const PLACEHOLDER_BY_SURFACE: Record<string, string> = {
  desk: "Ask Kreto about this project…",
  pay: "Draft an invoice, summarise the week…",
  match: "Find a videographer in Trinidad…",
  gigs: "Find gigs that fit my skills…",
  home: "Ask Kreto anything…",
  profile: "Polish my bio, suggest a credit…",
  credit: "Tag collaborators, verify a credit…",
  event: "Draft a recap, plan kickoff post…",
};

export const ThriveBar = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;
  if (HIDDEN_PATH_PREFIXES.some((p) => location.pathname.startsWith(p))) return null;

  const surface = inferSurface(location.pathname);
  const placeholder = PLACEHOLDER_BY_SURFACE[surface] ?? PLACEHOLDER_BY_SURFACE.home;

  const openChat = (mode: "chat" | "voice" = "chat") => {
    window.dispatchEvent(
      new CustomEvent("thrive-copilot:open", { detail: { mode } }),
    );
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 lg:hidden px-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.25rem)" }}
      role="region"
      aria-label="Kreto composer"
    >
      <div
        className={cn(
          "mx-auto flex items-center gap-2 h-14 px-2 rounded-2xl",
          "bg-card border border-border shadow-lg",
        )}
      >
        <span
          className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center"
          aria-hidden
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={() => openChat("chat")}
          className="flex-1 min-w-0 text-left text-sm text-muted-foreground truncate active:opacity-70"
          aria-label="Open Kreto chat"
        >
          {placeholder}
        </button>
        <button
          type="button"
          onClick={() => openChat("voice")}
          className="h-11 w-11 shrink-0 rounded-full text-primary hover:bg-primary/10 active:scale-95 transition-all flex items-center justify-center"
          aria-label="Talk to Kreto"
          title="Tap to talk"
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => openChat("chat")}
          className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground active:scale-95 transition-all flex items-center justify-center"
          aria-label="Open Kreto"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
