import { intentMeta, normalizeIntents, type PrimaryIntent } from "@/lib/intents";

interface IntentBadgeProps {
  /** Raw intents from DB (array or single legacy value). */
  intents: unknown;
  /** Visual size. */
  size?: "sm" | "md";
  /** Show all selected or just the first one. */
  showAll?: boolean;
  className?: string;
}

/**
 * Public-facing intent badge. Brand-aligned: lime energy dot + emoji + short label.
 * Use on profile hero, creator cards, match feed.
 */
export const IntentBadge = ({ intents, size = "sm", showAll = false, className = "" }: IntentBadgeProps) => {
  const list = normalizeIntents(intents);
  if (list.length === 0) return null;

  const items = showAll ? list : list.slice(0, 1);
  const isSm = size === "sm";

  return (
    <div className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {items.map((id: PrimaryIntent) => {
        const meta = intentMeta(id);
        if (!meta) return null;
        return (
          <span
            key={id}
            className={`
              inline-flex items-center gap-1 rounded-full border border-energy/30
              bg-energy/10 text-foreground font-semibold
              ${isSm ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]"}
            `}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" aria-hidden />
            <span aria-hidden>{meta.emoji}</span>
            <span className="leading-none">{meta.badge}</span>
          </span>
        );
      })}
    </div>
  );
};
