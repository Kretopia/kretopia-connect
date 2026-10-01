import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageBackButtonProps {
  /** Where to go when there's no real history to pop (e.g. a deep link
   *  opened directly). Defaults to Today, the app's one safe home base. */
  fallbackTo?: string;
  className?: string;
  /** "corner" (default): absolutely positioned top-4/left-4, for pages with
   *  a FeaturePageHeader-style hero -- wrap it in a `relative` parent.
   *  "inline": flows normally in whatever row you place it in, for pages
   *  with their own bespoke header layout and no hero to anchor against. */
  variant?: "corner" | "inline";
}

/**
 * CDO audit canonical back control (L4: BackAction). Quiet, accessible exit
 * path for secondary views — every page using this renders it inside a
 * `relative` wrapper around its own header, absolutely positioned at
 * top-4/left-4 (mirrors FeaturePageHeader's own tutorial-trigger corner
 * placement on the opposite side) rather than as a prop on the shared
 * header templates themselves, since those are reused by ~17+ pages and
 * not every one of them wants a back control.
 */
export function PageBackButton({ fallbackTo = "/today", className, variant = "corner" }: PageBackButtonProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  };
  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className={cn(
        "z-20 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "corner" && "absolute left-4",
        className,
      )}
      style={variant === "corner" ? { top: "calc(1rem + env(safe-area-inset-top))" } : undefined}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
    </button>
  );
}

export default PageBackButton;
