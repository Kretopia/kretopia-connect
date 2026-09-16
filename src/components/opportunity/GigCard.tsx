import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EasyApplyButton } from "@/components/opportunity/EasyApplyButton";
import { BookmarkButton } from "@/components/opportunity/BookmarkButton";
import {
  Briefcase, Handshake, ArrowRightLeft, MapPin, Clock,
  DollarSign, Zap, Target, GraduationCap, AlertTriangle,
  Gift, ArrowRight, Shield, User, Verified, Radar, Sparkles,
  Globe, Lock, Camera,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, differenceInDays, parseISO } from "date-fns";

export interface GigOpportunity {
  id: string;
  title: string;
  description: string;
  type: string;
  compensation: string | null;
  location: string | null;
  skills: string[] | null;
  tags?: string[] | null;
  created_at: string | null;
  created_by: string | null;
  duration?: string | null;
  image_url?: string | null;
  status: string | null;
  barter_offering?: string | null;
  barter_requesting?: string | null;
  platform_requirements?: string[] | null;
  min_followers?: number | null;
  is_priority?: boolean;
  priority_expires_at?: string | null;
  scouted_by?: string | null;
  usage_type?: string | null;
  usage_territory?: string | null;
  usage_duration?: string | null;
  usage_exclusive?: boolean | null;
}

export interface GigCreatorProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; chip: string; icon: typeof Briefcase }> = {
  job:            { label: "Paid",          chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", icon: Briefcase },
  paid:           { label: "Paid",          chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", icon: DollarSign },
  collab:         { label: "Collab",        chip: "bg-primary/20 text-primary border-primary/30",             icon: Handshake },
  collaboration:  { label: "Collab",        chip: "bg-primary/20 text-primary border-primary/30",             icon: Handshake },
  gig:            { label: "Quick Gig",     chip: "bg-amber-500/15 text-amber-400 border-amber-500/25",       icon: Zap },
  project:        { label: "Project",       chip: "bg-violet-500/15 text-violet-400 border-violet-500/25",             icon: Target },
  internship:     { label: "Internship",    chip: "bg-orange-500/15 text-orange-400 border-orange-500/25",    icon: GraduationCap },
  barter:         { label: "Barter",        chip: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25", icon: ArrowRightLeft },
  casting:        { label: "Casting Call",  chip: "bg-rose-500/15 text-rose-400 border-rose-500/25",          icon: Camera },
};

const USAGE_LABELS: Record<string, string> = {
  organic_social: "Organic Social",
  paid_ads: "Paid Ads",
  full_buyout: "Full Buyout",
  broadcast: "Broadcast",
  ooh: "OOH",
  web_only: "Web Only",
};

const formatUsageRights = (opp: GigOpportunity): string | null => {
  if (!opp.usage_type && !opp.usage_territory && !opp.usage_duration) return null;
  const parts: string[] = [];
  if (opp.usage_type) parts.push(USAGE_LABELS[opp.usage_type] || opp.usage_type);
  if (opp.usage_territory) parts.push(opp.usage_territory);
  if (opp.usage_duration) parts.push(opp.usage_duration);
  return parts.join(" · ");
};

const UsageRightsChip = ({ opp, variant = "dark" }: { opp: GigOpportunity; variant?: "dark" | "muted" }) => {
  const summary = formatUsageRights(opp);
  if (!summary) return null;
  const base = variant === "dark"
    ? "bg-background/80 backdrop-blur-sm border-border text-foreground"
    : "bg-muted/40 border-border/60 text-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${base}`}
      title="Usage rights"
    >
      {opp.usage_exclusive ? <Lock className="h-2.5 w-2.5 text-amber-400" /> : <Globe className="h-2.5 w-2.5 text-primary" />}
      <span className="truncate max-w-[180px]">{summary}</span>
      {opp.usage_exclusive && <span className="text-amber-400">· Excl.</span>}
    </span>
  );
};

interface GigCardProps {
  opportunity: GigOpportunity;
  creator?: GigCreatorProfile | null;
  compact?: boolean;
  /** Real match score (0-100) computed from the viewer's profile — see
   *  computeOpportunityMatch(). Omit or pass null when there's no real
   *  signal; the badge is hidden rather than showing a fabricated number. */
  matchScore?: number | null;
}

const GigCard = ({ opportunity: opp, creator, compact = false, matchScore = null }: GigCardProps) => {
  const navigate = useNavigate();
  const config = TYPE_CONFIG[opp.type] || TYPE_CONFIG.job;
  const TypeIcon = config.icon;
  const isClosingSoon = opp.created_at && differenceInDays(new Date(), parseISO(opp.created_at)) >= 14;
  const isBarter = opp.type === "barter";
  const isPaid = ["job", "paid", "gig", "project"].includes(opp.type);
  const hasImage = !!opp.image_url;

  const goToDetail = () => navigate(`/opportunity/${opp.id}`);

  // Compensation display: short + bold
  const compensationLabel = isBarter
    ? "Trade"
    : (opp.compensation || (isPaid ? "Paid" : "—"));

  // ============= POSTER VARIANT (with image) =============
  if (hasImage) {
    return (
      <div
        className="relative rounded-2xl overflow-hidden border border-border bg-card cursor-pointer group transition-all hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10"
        onClick={goToDetail}
      >
        {/* Aspect-controlled hero */}
        <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
          <img
            src={opp.image_url!}
            alt={opp.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Cinematic gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-background/40" />

          {/* Top row: type chip + match + bookmark */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${config.chip}`}>
                <TypeIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              {isClosingSoon && (
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border-amber-500/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Closing
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {matchScore != null && (
                <span className="px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm border border-border text-[10px] font-bold text-energy flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  {matchScore}%
                </span>
              )}
              <BookmarkButton opportunityId={opp.id} size="sm" />
            </div>
          </div>

          {/* Bottom: company + title */}
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5">
            {creator && !opp.scouted_by && (
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/90 font-semibold mb-1.5 flex items-center gap-1.5">
                {creator.avatar_url ? (
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={creator.avatar_url} />
                    <AvatarFallback className="text-[8px]">{creator.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                ) : null}
                <span className="truncate">{creator.full_name || "Anonymous"}</span>
                <Verified className="h-3 w-3 text-primary" />
              </div>
            )}
            {opp.scouted_by && (
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary/90 font-semibold mb-1.5 flex items-center gap-1.5">
                <Radar className="h-3 w-3" />
                Scouted
              </div>
            )}
            <h3 className="text-lg sm:text-xl font-black tracking-tight leading-[1.1] text-foreground line-clamp-2">
              {opp.title}
            </h3>
            {formatUsageRights(opp) && (
              <div className="mt-2">
                <UsageRightsChip opp={opp} variant="dark" />
              </div>
            )}
          </div>
        </div>

        {/* Footer: comp + meta + apply */}
        <div className="p-3 sm:p-4 flex items-center justify-between gap-3 border-t border-border/60">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {isBarter ? "Exchange" : "Budget"}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-black text-foreground truncate">{compensationLabel}</span>
              {isPaid && (
                <Shield className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Escrow Protected" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              {opp.location && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{opp.location}</span>
                </span>
              )}
              {opp.created_at && (
                <span className="flex items-center gap-0.5 shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(opp.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <EasyApplyButton opportunityId={opp.id} opportunityTitle={opp.title} />
          </div>
        </div>

        {/* Barter exchange strip */}
        {isBarter && (opp.barter_offering || opp.barter_requesting) && (
          <div className="px-4 py-2 bg-fuchsia-500/[0.06] border-t border-fuchsia-500/15 flex items-center gap-2 text-[11px]">
            <Gift className="h-3 w-3 text-fuchsia-300 shrink-0" />
            <span className="truncate text-fuchsia-200">{opp.barter_offering || "Trade offer"}</span>
            <ArrowRight className="h-3 w-3 text-fuchsia-400 shrink-0" />
            <span className="truncate text-fuchsia-300/80">{opp.barter_requesting || "Content needed"}</span>
          </div>
        )}
      </div>
    );
  }

  // ============= EDITORIAL VARIANT (no image) =============
  return (
    <div
      className="rounded-2xl border border-border bg-card overflow-hidden cursor-pointer group transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
      onClick={goToDetail}
    >
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${config.chip}`}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {isClosingSoon && (
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border-amber-500/25">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Closing
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {matchScore != null && (
              <span className="text-[10px] font-bold text-energy flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                {matchScore}% match
              </span>
            )}
            <BookmarkButton opportunityId={opp.id} size="sm" />
          </div>
        </div>

        {/* Title — editorial sculptural */}
        <h3 className="text-xl sm:text-2xl font-black tracking-[-0.02em] leading-[1.1] text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {opp.title}
        </h3>

        {/* Description */}
        {!compact && opp.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
            {opp.description}
          </p>
        )}

        {formatUsageRights(opp) && (
          <div className="mt-3">
            <UsageRightsChip opp={opp} variant="muted" />
          </div>
        )}

        {/* Poster row */}
        {opp.scouted_by ? (
          <div className="flex items-center gap-2 mt-4 text-[11px] text-primary/90">
            <Radar className="h-3.5 w-3.5" />
            <span className="italic">Scouted opportunity</span>
          </div>
        ) : creator && (
          <div className="flex items-center gap-2 mt-4">
            <Avatar className="h-7 w-7 border border-border">
              {creator.avatar_url ? (
                <AvatarImage src={creator.avatar_url} />
              ) : null}
              <AvatarFallback className="text-[10px] bg-muted">
                {creator.full_name?.[0] || <User className="h-3 w-3" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1">
                {creator.full_name || "Anonymous"}
                <Verified className="h-3 w-3 text-primary shrink-0" />
              </div>
              {creator.role && (
                <div className="text-[10px] text-muted-foreground truncate">{creator.role}</div>
              )}
            </div>
          </div>
        )}

        {/* Barter exchange */}
        {isBarter && (opp.barter_offering || opp.barter_requesting) && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-fuchsia-500/[0.06] border border-fuchsia-500/15 flex items-center gap-2 text-[11px]">
            <Gift className="h-3 w-3 text-fuchsia-300 shrink-0" />
            <span className="truncate text-fuchsia-200">{opp.barter_offering || "Trade"}</span>
            <ArrowRight className="h-3 w-3 text-fuchsia-400 shrink-0" />
            <span className="truncate text-fuchsia-300/80">{opp.barter_requesting || "For"}</span>
          </div>
        )}

        {/* Skills */}
        {!compact && opp.skills && opp.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {opp.skills.slice(0, 4).map(skill => (
              <span key={skill} className="text-[10px] px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground border border-border/60">
                {skill}
              </span>
            ))}
            {opp.skills.length > 4 && (
              <span className="text-[10px] text-muted-foreground self-center">+{opp.skills.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {isBarter ? "Exchange" : "Budget"}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-base font-black text-foreground truncate">{compensationLabel}</span>
            {isPaid && (
              <Shield className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Escrow Protected" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            {opp.location && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{opp.location}</span>
              </span>
            )}
            {opp.created_at && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(opp.created_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <EasyApplyButton opportunityId={opp.id} opportunityTitle={opp.title} />
        </div>
      </div>
    </div>
  );
};

export default GigCard;
