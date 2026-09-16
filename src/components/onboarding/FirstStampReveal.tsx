import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { ThrivePresence } from "@/components/ThrivePresence";
import { BRAND } from "@/lib/brandLexicon";

interface FirstStampRevealProps {
  open: boolean;
  onContinue: () => void;
  credit?: {
    project_name?: string;
    role?: string;
    year?: number | string | null;
    platform?: string | null;
  } | null;
  /** Total Stamps discovered (drives the "+N more" line). */
  total?: number;
}

/**
 * First-Stamp reveal — the moment Thrive finds the user's first verified work.
 * Cinematic, single beat. One CTA: "Continue building your Passport".
 *
 * Used in onboarding between Discover and Review when discovery returns ≥1 credit.
 */
export function FirstStampReveal({ open, onContinue, credit, total }: FirstStampRevealProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!open) { setRevealed(false); return; }
    const t = setTimeout(() => setRevealed(true), 450);
    return () => clearTimeout(t);
  }, [open]);

  const extra = Math.max(0, (total ?? 1) - 1);

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-sm border-primary/15 bg-background overflow-hidden p-0 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Atmospheric wash */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-energy/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative z-10 px-6 pt-8 pb-6 text-center space-y-5">
          {/* Thrive presence — active tone */}
          <div className="flex justify-center">
            <ThrivePresence size="xl" tone="active" label="Thrive found your first Stamp" />
          </div>

          {/* Eyebrow */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-energy">
              First {BRAND.stampSingular} earned
            </p>
            <h2 className="font-serif text-3xl leading-tight">
              Your {BRAND.passport} just came alive.
            </h2>
            <p className="text-sm text-muted-foreground">
              Thrive verified your first piece of work. This is how the world will see you.
            </p>
          </div>

          {/* Stamp card — animated in */}
          {credit && (
            <div
              className={`mx-auto max-w-xs rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm p-4 text-left transition-all duration-700 ${
                revealed ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-energy/25 to-primary/15 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-energy" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {BRAND.stampSingular}
                  </p>
                  <p className="font-semibold text-sm truncate">
                    {credit.project_name || "Untitled project"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[credit.role, credit.year, credit.platform].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              {extra > 0 && (
                <p className="mt-3 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                  + {extra} more {extra === 1 ? "Stamp" : "Stamps"} ready to confirm
                </p>
              )}
            </div>
          )}

          <Button
            onClick={onContinue}
            size="lg"
            className="w-full h-12 gap-2 text-base"
          >
            Continue building your {BRAND.passport}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FirstStampReveal;
