import { AlertTriangle, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "banner" | "footer" | "inline";
  className?: string;
}

/**
 * Legal disclaimer for contract features.
 * Kretopia is not a law firm and contract templates are not legal advice.
 */
export function ContractDisclaimer({ variant = "banner", className }: Props) {
  if (variant === "footer") {
    return (
      <p className={cn("text-[10px] text-muted-foreground leading-relaxed border-t border-border pt-2 mt-3", className)}>
        ⚖️ Kretopia is not a law firm. This contract is a private written agreement between the parties.
        Enforceability and required clauses depend on the jurisdiction(s) of the parties. For high-value or
        cross-border deals, consult a licensed attorney in your country.
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-muted-foreground flex items-start gap-1.5", className)}>
        <Scale className="h-3 w-3 mt-0.5 shrink-0" />
        <span>Not legal advice — see disclaimer in the contract.</span>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex gap-3",
        className,
      )}
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Important: this is not legal advice
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
          Kretopia is not a law firm. Our contracts are written agreements between you and the other party.
          They're enforceable as private contracts in most jurisdictions, but specific clauses
          (taxes, IP, dispute resolution, consumer protection) vary by country. For deals over a few thousand
          dollars or anything cross-border, have a licensed attorney in your country review it.
        </p>
      </div>
    </div>
  );
}
