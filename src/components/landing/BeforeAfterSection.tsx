import { X, Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Side-by-side comparison: Regular Portfolio vs Kretopia Verified Profile
 */
export const BeforeAfterSection = () => {
  return (
    <section className="py-10 px-4 sm:px-6">
      <div className="container mx-auto max-w-3xl">
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-primary font-semibold mb-3">
          Why Kretopia?
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-center text-foreground mb-6">
          Regular Portfolio <span className="text-muted-foreground font-normal">vs</span>{" "}
          <span className="text-primary">Kretopia</span>
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Before */}
          <div className="rounded-2xl border border-border bg-card/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Traditional
            </p>
            <ul className="space-y-2.5">
              {[
                "Self-reported credits",
                "No work verification",
                "Static PDF résumé",
                "Manual job hunting",
                "No payment protection",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <X className="h-3.5 w-3.5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] font-bold px-2 py-0.5 rounded-bl-lg">
              NEW
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
              Kretopia
            </p>
            <ul className="space-y-2.5">
              {[
                "Verified credits",
                "Peer & brand endorsements",
                "Living, searchable profile",
                "Smart-matched opportunities",
                "Escrow-protected payments",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[11px] text-foreground">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-center mt-5">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
          >
            Start building your verified profile <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
};
