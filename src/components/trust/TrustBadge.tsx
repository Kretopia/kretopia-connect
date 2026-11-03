import { ShieldCheck, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { strongestTrust, trustLabel, TRUST_MEANING, type TrustFacts } from "@/lib/trustBadge";

/**
 * The trust badge: exactly one, the strongest the subject holds (Verified > Vouched), or nothing. Give it what is known about the
 * subject; it never renders two competing badges, wherever it is used.
 */
export function TrustBadge({ className, ...facts }: TrustFacts & { className?: string }) {
  const trust = strongestTrust(facts);
  if (!trust) return null;
  const Icon = trust.state === "verified" ? ShieldCheck : Handshake;
  return (
    <span
      data-trust={trust.state}
      title={TRUST_MEANING[trust.state]}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        trust.state === "verified"
          ? "border-[hsl(var(--signal-teal))]/40 bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))]"
          : "border-[hsl(var(--signal-teal))]/30 bg-[hsl(var(--signal-teal))]/10 text-[hsl(var(--signal-teal))]",
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {trustLabel(trust)}
    </span>
  );
}

export default TrustBadge;
