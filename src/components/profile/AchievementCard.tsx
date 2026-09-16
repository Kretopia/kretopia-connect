import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Shield, Star, Trash2, Award, Trophy, UserPlus, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CreditCoverPlaceholder } from "./CreditCoverPlaceholder";
import { HoloCard } from "@/components/passport/HoloCard";
import { classifyCreditEvidence } from "@/lib/passport/creditEvidence";

export interface AchievementCardProps {
  variant: "credit" | "press" | "award" | "stat";
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
  onCardClick?: () => void;
  icon?: React.ReactNode;
  metadata?: Record<string, string | number>;
  category?: string | null;
}

export const AchievementCard = ({
  variant,
  title,
  subtitle,
  description,
  year,
  imageUrl,
  url,
  verificationStatus = "unverified",
  endorsementCount = 0,
  source,
  verifiedByName,
  isFeatured = false,
  isOwnProfile = false,
  onDelete,
  onRequestEndorsement,
  onCardClick,
  icon,
  metadata,
  category,
}: AchievementCardProps) => {
  // One sober neutral treatment for every variant — the colored per-variant
  // borders (blue/purple/amber/gray) didn't carry real meaning users read,
  // just noise. Verification state below is the one place color is earned.
  const getVariantStyles = () => "border-border/60 hover:border-white/20";

  // 3-tier verification, collapsed to two colors: pink = trusted (verified
  // or peer-vouched), neutral = not yet (pending or self-claimed). Fewer
  // hues than the old amber/primary/muted split, same real distinction.
  const VerificationBadge = () => {
    const isPending = verificationStatus === "pending" || verificationStatus === "pending_review";
    const hasPeers = endorsementCount > 0;
    const evidence = classifyCreditEvidence({ verification_status: verificationStatus, endorsement_count: endorsementCount });

    let label = "Self-claimed";
    let why = "Added by the creator. Not yet verified by collaborators or an authoritative source.";
    let Icon: any = Shield;
    let cls = "bg-muted text-muted-foreground border-border";

    if (evidence === "verified") {
      // Never assert a specific provenance we can't back with real data —
      // "verified" alone doesn't tell us which of several paths produced
      // it. Only cite a platform/confirmer name when the credit actually
      // carries one.
      label = "Verified";
      const parts: string[] = [];
      if (source) parts.push(`Sourced from ${source}`);
      else if (verifiedByName) parts.push(`Confirmed by ${verifiedByName}`);
      if (hasPeers) parts.push(`vouched by ${endorsementCount} collaborator${endorsementCount === 1 ? "" : "s"}`);
      why = parts.length > 0
        ? `${parts.join(" and ")}.`
        : "Confirmed through Kretopia's verification process.";
      Icon = ShieldCheck;
      cls = "bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40";
    } else if (evidence === "publicly_sourced") {
      label = "Publicly Sourced";
      why = "Kreto found this from public information and you confirmed it's yours. Not yet independently verified.";
      Icon = Shield;
      cls = "bg-muted text-muted-foreground border-border";
    } else if (hasPeers) {
      label = `Vouched · ${endorsementCount}`;
      why = `Vouched by ${endorsementCount} collaborator${endorsementCount === 1 ? "" : "s"} who worked on this project.`;
      Icon = ShieldCheck;
      cls = "bg-[hsl(var(--signal-teal))]/10 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/30";
    } else if (isPending) {
      label = "Pending";
      why = "Verification request sent. Waiting on collaborators to confirm.";
      Icon = Clock;
      cls = "bg-muted text-muted-foreground border-border";
    }

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("gap-1 cursor-help", cls)}>
              <Icon className="h-3 w-3" />
              {label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-xs">
            {why}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Compact layout for awards without images
  const isCompact = variant === "award" && !imageUrl;

  // Check if title contains "winner" or "won" for trophy icon
  const isWinner = title.toLowerCase().includes('winner') || 
                   title.toLowerCase().includes('won') ||
                   description?.toLowerCase().includes('winner') ||
                   description?.toLowerCase().includes('won');

  if (isCompact) {
    return (
      <HoloCard maxTilt={4} className="animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none">
        <Card
          className={cn(
            "group relative overflow-hidden transition-all duration-300",
            getVariantStyles(),
            isFeatured && "ring-2 ring-[hsl(var(--signal-teal))]/20"
          )}
        >
          <CardContent className="p-4" style={{ transform: "translateZ(12px)" }}>
            <div className="flex items-start gap-3">
              {/* Compact Icon */}
              <div className={cn(
                "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                isWinner
                  ? "bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))]"
                  : "bg-muted text-muted-foreground"
              )}>
                {isWinner ? (
                  <Trophy className="h-5 w-5" />
                ) : (
                  <Award className="h-5 w-5" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-foreground transition-colors">
                    {title}
                  </h3>
                  {year && (
                    <span className="text-xs text-muted-foreground shrink-0">{year}</span>
                  )}
                </div>

                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}

                {description && (
                  <p className="text-xs text-muted-foreground/80 line-clamp-1">{description}</p>
                )}

                {/* Metadata & Actions Row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {metadata && Object.entries(metadata).map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {value}
                      </Badge>
                    ))}
                    {isFeatured && (
                      <Badge variant="default" className="gap-0.5 text-[10px] px-1.5 py-0">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Featured
                      </Badge>
                    )}
                    <VerificationBadge />
                  </div>
                  <div className="relative z-10 flex items-center gap-1">
                    {isOwnProfile && onRequestEndorsement && verificationStatus !== 'verified' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRequestEndorsement}
                        className="h-6 px-1.5 text-[10px] gap-1 text-foreground hover:bg-accent"
                      >
                        <UserPlus className="h-3 w-3" />
                        Verify
                      </Button>
                    )}
                    {url && (
                      <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {isOwnProfile && onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </HoloCard>
    );
  }

  // Original layout for cards with images
  return (
    <HoloCard maxTilt={5} className="animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none">
      <Card
        onClick={onCardClick}
        className={cn(
          "group relative overflow-hidden transition-all duration-300",
          getVariantStyles(),
          isFeatured && "ring-2 ring-[hsl(var(--signal-teal))]/20",
          onCardClick && "cursor-pointer"
        )}
      >
        <CardContent className="p-0" style={{ transform: "translateZ(14px)" }}>
          {/* Thumbnail/Icon Section */}
          {imageUrl ? (
            <div className="relative h-48 bg-muted overflow-hidden">
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {isFeatured && (
                <div className="absolute top-3 left-3" style={{ transform: "translateZ(10px)" }}>
                  <Badge variant="default" className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Featured
                  </Badge>
                </div>
              )}
            </div>
          ) : variant === "credit" ? (
            <CreditCoverPlaceholder
              category={category}
              title={title}
              role={subtitle || undefined}
              height="h-48"
            />
          ) : null}

          {/* Content Section */}
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base line-clamp-2 group-hover:text-foreground transition-colors">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                )}
              </div>
              {year && (
                <span className="text-xs text-muted-foreground shrink-0">{year}</span>
              )}
            </div>

            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            )}

            {/* Metadata */}
            {metadata && Object.keys(metadata).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(metadata).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {value}
                  </Badge>
                ))}
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2" style={{ transform: "translateZ(8px)" }}>
              <div className="flex items-center gap-2">
                <VerificationBadge />
              </div>
              <div className="relative z-10 flex items-center gap-2">
                {isOwnProfile && onRequestEndorsement && verificationStatus !== 'verified' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onRequestEndorsement(); }}
                    className="h-8 gap-1 text-xs text-foreground hover:bg-accent"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Request verify
                  </Button>
                )}
                {url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8"
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {isOwnProfile && onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </HoloCard>
  );
};