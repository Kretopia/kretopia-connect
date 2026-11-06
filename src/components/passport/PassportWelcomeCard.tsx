import { Button } from "@/components/ui/button";
import { KretoMark } from "@/components/brand/KretoMark";

interface PassportWelcomeCardProps {
  /** The member's first name, when known. */
  firstName?: string | null;
  /** Opens the existing Passport tutorial (the same one the header's "How this works" replays). */
  onTour: () => void;
  onDismiss: () => void;
}

/**
 * The moment after onboarding: the member's Passport exists. Static copy in Kreto's identity (the K-mark, not a portrait or an AI
 * orb): nothing here is generated, so it appears at once and never says anything the product cannot back. The tour is offered, never
 * forced, and can be replayed later from the Passport header.
 */
export function PassportWelcomeCard({ firstName, onTour, onDismiss }: PassportWelcomeCardProps) {
  const name = firstName?.trim();
  return (
    <section
      aria-labelledby="passport-welcome-title"
      className="mb-4 rounded-2xl border border-border bg-card p-5"
      data-testid="passport-welcome"
    >
      <div className="flex items-start gap-4">
        <KretoMark size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id="passport-welcome-title" className="text-lg font-semibold text-foreground">
            {name ? `Congratulations, ${name}.` : "Congratulations."}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Creative Passport is live. Every credit, co-sign and collaboration from here builds your verified record, and Kreto
            helps you keep it sharp.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onTour}>
              Take the quick tour
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
