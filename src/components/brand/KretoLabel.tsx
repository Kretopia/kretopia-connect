/**
 * KretoLabel -- the small "Kreto · <context>" heading used on feature headers
 * and tips, with the mini Kreto robot standing in for the word "Kreto".
 *
 * Sighted users see the robot plus the context (e.g. "Circle"); screen
 * readers still hear the full "Kreto · Circle", so nothing is lost for them.
 * The robot is KretoPresence at its `micro` size (24px, no badge), decorative
 * and always `idle`: a label is never a claim that Kreto is doing anything.
 * KretoPresence already respects reduced motion.
 */
import { KretoPresence } from "@/components/brand/KretoPresence";
import { cn } from "@/lib/utils";

interface KretoLabelProps {
  /** What this label heads, e.g. "Circle" or "Waiting on you". */
  context: string;
  /** For a card that already shows the Kretopia K-mark beside the label: drop
   *  the mini robot and spell the label out ("Kreto · Scout") instead of
   *  stacking a second logo next to the first. */
  plain?: boolean;
  className?: string;
}

export const KretoLabel = ({ context, plain = false, className }: KretoLabelProps) =>
  plain ? (
    <span data-kreto-label="" className={className}>
      Kreto · {context}
    </span>
  ) : (
    <span data-kreto-label="" className={cn("inline-flex items-center gap-1.5 align-middle -my-1", className)}>
      <KretoPresence size="micro" state="idle" />
      <span className="sr-only">Kreto · {context}</span>
      <span aria-hidden="true">{context}</span>
    </span>
  );

export default KretoLabel;
