import { Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionGate } from "@/lib/statusEngine";

interface ConnectionGateBannerProps {
  gate: ConnectionGate;
  message: string | null;
  recipientName?: string;
  className?: string;
}

/**
 * Renders an inline banner explaining why a connection will be gated.
 * Only shows for "request_only" — "open" returns null.
 */
export function ConnectionGateBanner({ gate, message, recipientName, className }: ConnectionGateBannerProps) {
  if (gate === "open" || !message) return null;

  return (
    <div className={cn(
      "flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-xs",
      className,
    )}>
      <Shield className="h-4 w-4 text-accent shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="font-semibold text-accent">Filtered Request</p>
        <p className="text-muted-foreground leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
