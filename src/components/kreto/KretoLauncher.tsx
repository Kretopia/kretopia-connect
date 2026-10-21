import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { KretoTyping } from "@/components/brand/KretoTyping";
import { Button } from "@/components/ui/button";

/**
 * KretoLauncher — the single, subtle "open Kreto" affordance on desktop.
 * Replaces the old side-positioned star pill (DesktopCopilotRail's collapsed
 * state). Dispatches the same `thrive-copilot:open` event every other
 * surface already uses, so it opens the real ThriveAgentFab Sheet with no
 * new backend or event plumbing.
 *
 * Always shown on desktop (lg+). On a phone the same mascot floats just
 * above the bottom nav, but only where `showOnMobile` says so (App.tsx
 * passes `showKretoMascotOnMobile`: where the bottom nav shows, and not on
 * calls, messages, onboarding or public pages). It replaced the docked
 * "Ask Kreto" composer bar, so there is still exactly one entry point.
 *
 * Kreto pilot surface #1 (KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md): shows
 * KretoPresence at state="idle" only. This button is hidden the moment any
 * dialog opens (see below), which is exactly when a real request would be
 * "processing" -- while this launcher is visible, Kreto is, truthfully,
 * always idle. No fake processing/proposal/success state is invented here.
 */
export function KretoLauncher({ showOnMobile = false }: { showOnMobile?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Hide while any Sheet/Dialog (Kreto itself, menu, notifications,
  // messages, etc.) is open, so it never sits on top of a drawer.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const check = () => {
      setDialogOpen(
        document.body.hasAttribute("data-scroll-locked") ||
          !!document.querySelector('[role="dialog"][data-state="open"]')
      );
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
      childList: true,
      subtree: true,
    });
    return () => obs.disconnect();
  }, []);

  if (dialogOpen) return null;

  return (
    <Button
      variant="link"
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: {} }))}
      aria-label="Open Kreto"
      title="Open Kreto"
      className={cn(
        "group fixed z-40 items-end justify-center h-20 w-20 lg:h-24 lg:w-24 p-0 hover:no-underline",
        showOnMobile ? "flex" : "hidden lg:flex",
        // Phone: above the bottom nav (and its safe area), at the right edge.
        // Desktop: the bottom-right corner, as before.
        "right-3 bottom-[calc(env(safe-area-inset-bottom)_+_4.75rem)]",
        "lg:right-[max(1.25rem,env(safe-area-inset-right))] lg:bottom-[max(1.25rem,env(safe-area-inset-bottom))]",
        "hover:scale-105 active:scale-95",
        "transition-transform duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <span className="absolute inset-x-2 bottom-0 h-5 rounded-full bg-primary/20 blur-lg transition-opacity group-hover:opacity-100" aria-hidden />
      <KretoTyping autoPlay className="h-20 lg:h-24 drop-shadow-2xl" />
      <span className="sr-only">Open Kreto</span>
    </Button>
  );
}

export default KretoLauncher;
