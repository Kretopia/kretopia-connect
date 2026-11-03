import type { ReactNode } from "react";
import { Award, Clock, ExternalLink, Shield, ShieldCheck, Star, Trash2, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CardPill, CardShell } from "@/components/cards/CardShell";
import { cn } from "@/lib/utils";
import { classifyCreditEvidence, creditEvidenceLabel, creditEvidenceMeaning } from "@/lib/passport/creditEvidence";
import { CreditCoverPlaceholder } from "./CreditCoverPlaceholder";

export interface AchievementCardProps {
  variant: "credit" | "award";
  title: string;
  subtitle?: string;
  description?: string;
  year?: number | string;
  imageUrl?: string;
  url?: string;
  verificationStatus?: "unverified" | "pending" | "pending_review" | "verified" | "auto_discovered" | "rejected" | "disputed";
  endorsementCount?: number;
  /** Real provenance, when known — e.g. "IMDb", "Spotify". Only shown when actually present; never assumed. */
  source?: string | null;
  /** Name of the person/org who confirmed this credit, when known. */
  verifiedByName?: string | null;
  isFeatured?: boolean;
  isOwnProfile?: boolean;
  onDelete?: () => void;
  onRequestEndorsement?: () => void;
  /** Opens the credit's media in place. Without it the title goes to `url`. */
  onCardClick?: () => void;
  /** The cover of an award with no picture. */
  icon?: ReactNode;
  metadata?: Record<string, string | number>;
  category?: string | null;
}

/**
 * Proof status, one vocabulary shared with Credits (lib/passport/creditEvidence.ts): teal = trusted (verified, or co-signed by
 * collaborators), neutral = not yet (pending, publicly sourced, or self-declared). Never asserts a provenance the credit does not carry.
 */
function ProofBadge({ verificationStatus, endorsementCount, source, verifiedByName }: Pick<AchievementCardProps, "verificationStatus" | "endorsementCount" | "source" | "verifiedByName">) {
  const count = endorsementCount ?? 0;
  const evidence = classifyCreditEvidence({ verification_status: verificationStatus ?? "unverified", endorsement_count: count });

  let label = creditEvidenceLabel("self_claimed");
  let why = creditEvidenceMeaning("self_claimed");
  let Icon = Shield;
  let cls = "bg-muted text-muted-foreground border-border";

  if (evidence === "verified") {
    // "Verified" alone does not say which of several paths produced it: cite a platform or a confirmer only when the credit carries one.
    label = "Verified";
    const parts: string[] = [];
    if (source) parts.push(`Sourced from ${source}`);
    else if (verifiedByName) parts.push(`Confirmed by ${verifiedByName}`);
    if (count > 0) parts.push(`vouched by ${count} collaborator${count === 1 ? "" : "s"}`);
    why = parts.length > 0 ? `${parts.join(" and ")}.` : "Confirmed through Kretopia's verification process.";
    Icon = ShieldCheck;
    cls = "bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40";
  } else if (evidence === "publicly_sourced") {
    label = creditEvidenceLabel("publicly_sourced");
    why = "Kreto found this from public information and you confirmed it's yours. Not yet independently verified.";
  } else if (evidence === "co_signed") {
    label = `${creditEvidenceLabel("co_signed")} · ${count}`;
    why = `Co-signed by ${count} collaborator${count === 1 ? "" : "s"} who worked on this project. Not yet verified by an authoritative source.`;
    Icon = ShieldCheck;
    cls = "bg-[hsl(var(--signal-teal))]/10 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/30";
  } else if (evidence === "pending") {
    label = creditEvidenceLabel("pending");
    why = "Verification request sent. Waiting on a reply or review: it does not count as proof yet.";
    Icon = Clock;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("cursor-help gap-1", cls)}>
            <Icon className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">{why}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * A credit or an award on a Passport: the credit variant of CardShell. The cover is its picture, or a category cover for a credit without one,
 * or the award's icon. How far it can be trusted (the proof badge) is always on the front. The one primary action is asking for verification
 * (your own, unverified); the one secondary is Delete on your own card, or the project's link when the title opens the media instead.
 */
export const AchievementCard = ({
  variant, title, subtitle, description, year, imageUrl, url, verificationStatus = "unverified", endorsementCount = 0, source, verifiedByName,
  isFeatured = false, isOwnProfile = false, onDelete, onRequestEndorsement, onCardClick, icon, metadata, category,
}: AchievementCardProps) => {
  const lower = `${title} ${description ?? ""}`.toLowerCase();
  const isWinner = lower.includes("winner") || lower.includes("won");
  const canRequest = isOwnProfile && !!onRequestEndorsement && verificationStatus !== "verified";

  const cover = imageUrl ? (
    <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
  ) : variant === "credit" ? (
    <CreditCoverPlaceholder category={category} title={title} role={subtitle || undefined} height="h-full" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground [&>svg]:h-16 [&>svg]:w-16">
      {icon ?? (isWinner ? <Trophy aria-hidden /> : <Award aria-hidden />)}
    </div>
  );

  const secondary =
    isOwnProfile && onDelete
      ? { icon: <Trash2 className="h-4 w-4" aria-hidden />, label: `Delete ${title}`, onClick: onDelete }
      : url && onCardClick
        ? { icon: <ExternalLink className="h-4 w-4" aria-hidden />, label: `Open ${title} in a new tab`, href: url }
        : undefined;

  return (
    <CardShell
      title={title}
      stretch={!!(onCardClick || url)}
      open={onCardClick ? { onClick: onCardClick } : url ? { href: url } : undefined}
      cover={cover}
      coverStart={isFeatured ? <CardPill tone="origin"><Star className="h-3 w-3 fill-current" aria-hidden />Featured</CardPill> : null}
      meta={[subtitle, year].filter(Boolean).join(" · ")}
      description={description}
      tags={Object.values(metadata ?? {}).map((value) => <CardPill key={String(value)}>{value}</CardPill>)}
      trust={<ProofBadge verificationStatus={verificationStatus} endorsementCount={endorsementCount} source={source} verifiedByName={verifiedByName} />}
      primary={canRequest ? { label: "Request verify", onClick: onRequestEndorsement } : undefined}
      secondary={secondary}
    />
  );
};
