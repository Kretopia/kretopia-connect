import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { KretoMark } from "@/components/brand/KretoMark";

/**
 * Shown on a member's own profile until onboarding is finished. New members now land
 * on their profile straight after confirming their email, so the setup wizard is one
 * clear step away instead of being the first screen they hit.
 */
export const FinishProfileBanner = () => (
  <aside
    aria-label="Finish setting up your profile"
    className="mb-4 flex items-center gap-3 rounded-2xl border border-[hsl(var(--energy)/0.35)] bg-[hsl(var(--energy)/0.06)] p-3"
  >
    <KretoMark variant="compact" size="md" className="shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold leading-tight">Welcome to Kretopia</p>
      <p className="text-xs text-muted-foreground leading-snug">
        Finish setting up your profile so people can find you. It takes about two minutes.
      </p>
    </div>
    <Button asChild size="sm" className="shrink-0">
      <Link to="/onboarding">Finish setup</Link>
    </Button>
  </aside>
);
