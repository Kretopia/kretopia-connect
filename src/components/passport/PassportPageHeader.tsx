import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { PASSPORT_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import type { PassportSurface } from "@/lib/passport/passportNav";

interface PassportPageHeaderProps {
  /** Which view this is. The words, the hierarchy, the branding and the tour are the same on both. */
  surface: PassportSurface;
}

/**
 * The one header of a Passport, private or public: the shared feature header with the same title, the same line under it and the same
 * "How this works" tour. It carries no link between the two views: that switch ("View my public Passport" / "View my private Passport",
 * see passportNavFor) belongs to the Passport card itself, under its actions, where the owner already looks for what to do with the
 * Passport, not in a corner beside the tour sticker.
 */
export function PassportPageHeader({ surface }: PassportPageHeaderProps) {
  return (
    <FeaturePageHeader
      eyebrow="Passport"
      title="Passport."
      accentTitle="Work, verified."
      subtitle="Identity, strongest credits and every co-sign, each with the evidence behind it."
      // The tour is about building one's own Passport: it opens by itself only there, never on somebody else's page.
      tutorial={{ featureKey: "passport", label: "How Passport works", steps: PASSPORT_TUTORIAL, autoOpen: surface === "private" }}
    />
  );
}

export default PassportPageHeader;
