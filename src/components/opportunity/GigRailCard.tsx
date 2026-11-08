import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase, Handshake, ArrowRightLeft,
  DollarSign, Zap, Target, GraduationCap, Sparkles, Radar, Shield, Globe, Lock, Camera, Gift,
} from "lucide-react";
import { BookmarkButton } from "@/components/opportunity/BookmarkButton";
import { EasyApplyButton } from "@/components/opportunity/EasyApplyButton";
import { CardPill, CardShell } from "@/components/cards/CardShell";
import { CARD_BTN, CARD_BTN_PRIMARY, CARD_BTN_PRIMARY_STYLE, CARD_ICON_BTN } from "@/components/cards/cardTokens";
import { cn } from "@/lib/utils";
import { closingLabel } from "@/components/opportunity/closingLabel";
import { formatUsageRights } from "@/components/opportunity/usageRights";
import type { GigCreatorProfile, GigOpportunity } from "@/components/opportunity/GigCard";

// What kind of opportunity it is: the word and the icon on the cover, and the colour of the cover when there is no picture.
const TYPE_CONFIG: Record<string, { label: string; icon: typeof Briefcase; gradient: string }> = {
  job:           { label: "Paid",      icon: Briefcase,     gradient: "from-emerald-500/30 via-emerald-500/10 to-background" },
  paid:          { label: "Paid",      icon: DollarSign,    gradient: "from-emerald-500/30 via-emerald-500/10 to-background" },
  collab:        { label: "Collab",    icon: Handshake,     gradient: "from-primary/40 via-primary/10 to-background" },
  collaboration: { label: "Collab",    icon: Handshake,     gradient: "from-primary/40 via-primary/10 to-background" },
  gig:           { label: "Quick Gig", icon: Zap,           gradient: "from-amber-500/30 via-amber-500/10 to-background" },
  project:       { label: "Project",   icon: Target,        gradient: "from-muted via-card to-background" },
  internship:    { label: "Internship",icon: GraduationCap, gradient: "from-orange-500/30 via-orange-500/10 to-background" },
  barter:        { label: "Barter",    icon: ArrowRightLeft,gradient: "from-muted via-card to-background" },
  casting:       { label: "Casting Call", icon: Camera,     gradient: "from-rose-500/30 via-rose-500/10 to-background" },
};

interface GigRailCardProps {
  opportunity: GigOpportunity;
  /** Real match score (0-100) from computeOpportunityMatch(). Omit or pass
   *  null when there's no real signal — the badge is hidden rather than
   *  showing a fabricated number. */
  matchScore?: number | null;
  /** Who posted it, said on the card when it is given and the listing was not scouted by Kretopia. */
  creator?: GigCreatorProfile | null;
  /**
   * The form a grid of results uses: it also says when the application closes, who posted it and what is offered in a trade. The rail's
   * glance leaves those to the opportunity's page.
   */
  detailed?: boolean;
}

/**
 * An opportunity on a rail (the Studio's casting calls), as the shared card: the kind of opportunity, whether Kretopia scouted it and how well
 * it matches on the cover with the save control, the title, where and when, the budget and any usage terms, and Quick Apply. The whole card
 * opens the opportunity; Save and Quick Apply keep their own behaviour and never open it.
 */
export const GigRailCard = ({ opportunity: opp, matchScore = null, creator = null, detailed = false }: GigRailCardProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const config = TYPE_CONFIG[opp.type] || TYPE_CONFIG.job;
  const TypeIcon = config.icon;
  const isBarter = opp.type === "barter";
  const isPaid = ["job", "paid", "gig", "project"].includes(opp.type);
  const compensationLabel = isBarter ? "Trade" : (opp.compensation || (isPaid ? "Paid" : "—"));
  const posted = opp.created_at ? formatDistanceToNow(new Date(opp.created_at), { addSuffix: true }).replace("about ", "") : null;
  const usage = formatUsageRights(opp);
  const closes = detailed ? closingLabel(opp.application_deadline) : null;
  const trade = detailed && isBarter && (opp.barter_offering || opp.barter_requesting) ? `${opp.barter_offering || "Trade offer"} → ${opp.barter_requesting || "Content needed"}` : null;

  return (
    <CardShell
      testId={`gig-rail-card-${opp.id}`}
      title={opp.title}
      stretch
      open={{ to: `/opportunity/${opp.id}` }}
      cover={
        opp.image_url && !imageFailed ? (
          <img src={opp.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", config.gradient)}>
            <TypeIcon className="h-16 w-16 text-foreground/20" strokeWidth={1.5} aria-hidden />
          </div>
        )
      }
      coverStart={
        <>
          <CardPill tone="type"><TypeIcon className="h-3 w-3" aria-hidden />{config.label}</CardPill>
          {opp.scouted_by ? <CardPill tone="origin"><Radar className="h-3 w-3" aria-hidden />Scouted</CardPill> : null}
          {matchScore != null ? <CardPill tone="type" className="text-energy"><Sparkles className="h-3 w-3" aria-hidden />{matchScore}%<span className="sr-only"> match</span></CardPill> : null}
        </>
      }
      coverControls={<BookmarkButton opportunityId={opp.id} className={CARD_ICON_BTN} />}
      meta={[opp.location, posted, closes].filter(Boolean).join(" · ") || null}
      tags={[
        <CardPill key="budget" className="max-w-full">
          <span className="min-w-0 truncate">{isBarter ? "Exchange" : "Budget"}: {compensationLabel}</span>
          {isPaid ? <Shield className="h-3 w-3 shrink-0 text-primary" aria-hidden /> : null}
        </CardPill>,
        usage ? (
          <CardPill key="usage" className="max-w-full">
            {opp.usage_exclusive ? <Lock className="h-3 w-3 shrink-0 text-amber-400" aria-hidden /> : <Globe className="h-3 w-3 shrink-0 text-primary" aria-hidden />}
            <span className="min-w-0 truncate">{usage}{opp.usage_exclusive ? " · Excl." : ""}</span>
          </CardPill>
        ) : null,
        trade ? (
          <CardPill key="trade" className="max-w-full">
            <Gift className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{trade}</span>
          </CardPill>
        ) : null,
      ]}
      trust={detailed && creator && !opp.scouted_by ? `Posted by ${creator.full_name || "Anonymous"}` : null}
      action={<EasyApplyButton opportunityId={opp.id} opportunityTitle={opp.title} size="default" className={cn(CARD_BTN, CARD_BTN_PRIMARY)} style={CARD_BTN_PRIMARY_STYLE} />}
    />
  );
};

export default GigRailCard;
