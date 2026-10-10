import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface WrappedStatusProps {
  /** Lit dot (the energy colour) when what the panel shows is current; grey when it is not. */
  active: boolean;
  /** The dot pings. Only while the panel is on screen and healthy. */
  pinging?: boolean;
  /** "Live", "Offline", "Checked 3 min ago": the one thing the line says. */
  label: ReactNode;
  /** Optional second part, e.g. "· updated 12 s ago". */
  detail?: ReactNode;
}

/** The status line of a Wrapped panel: a dot and one honest word, then how old it is. */
export function WrappedStatus({ active, pinging = false, label, detail }: WrappedStatusProps) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <span className="relative inline-flex h-2 w-2" aria-hidden>
          {pinging && <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--energy))] opacity-60 motion-safe:animate-ping" />}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", active ? "bg-[hsl(var(--energy))]" : "bg-muted-foreground")} />
        </span>
        {label}
      </span>
      {detail ? <span>{detail}</span> : null}
    </>
  );
}

export default WrappedStatus;
