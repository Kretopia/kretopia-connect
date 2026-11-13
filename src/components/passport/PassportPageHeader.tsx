import { Link } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";

import { FEATURE_STICKER_CLASS } from "@/components/features/FeatureAITutorial";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { PASSPORT_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { Button } from "@/components/ui/button";
import { passportNavFor, type PassportSurface } from "@/lib/passport/passportNav";
import { cn } from "@/lib/utils";

interface PassportPageHeaderProps {
  /** Which view this is. The words, the hierarchy, the branding and the tour are the same on both; only the link below them differs. */
  surface: PassportSurface;
  /** The signed-in account, as the auth backend reports it; null for a visitor. */
  viewerId: string | null | undefined;
  /** Whose Passport is on the page. Needed on the public view, to know whether the viewer owns it. */
  passportOwnerId?: string | null;
}

/**
 * The one header of a Passport, private or public: the shared feature header with the same title, the same line under it and the same
 * "How this works" tour. Beside that sticker, in the same row and style, sits the single owner-aware link (see passportNavFor): "View my public Passport" on the private view,
 * "Back to my private Passport" on the public view of one's own Passport, and nothing for anybody else. The link is not drawn and then
 * hidden: for anyone but the owner it is not in the page.
 */
export function PassportPageHeader({ surface, viewerId, passportOwnerId }: PassportPageHeaderProps) {
  const nav = passportNavFor({ surface, viewerId, passportOwnerId });
  return (
    <FeaturePageHeader
      eyebrow="Passport"
      title="Passport."
      accentTitle="Work, verified."
      subtitle="Identity, strongest credits and every co-sign, each with the evidence behind it."
      // The tour is about building one's own Passport: it opens by itself only there, never on somebody else's page.
      tutorial={{ featureKey: "passport", label: "How Passport works", steps: PASSPORT_TUTORIAL, autoOpen: surface === "private" }}
      // The switch is a sticker beside "How this works", in the same row: one unit of header actions, not a row of its own.
      preTitleAction={
        nav && (
          <Button asChild variant="outline" size="sm" className={cn(FEATURE_STICKER_CLASS, "relative z-10")}>
            <Link to={nav.to}>
              {nav.kind === "view-public" ? <Eye className="h-3 w-3" aria-hidden /> : <ArrowLeft className="h-3 w-3" aria-hidden />}
              {nav.label}
            </Link>
          </Button>
        )
      }
    />
  );
}

export default PassportPageHeader;
