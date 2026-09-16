import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FramedAvatar } from "@/components/ui/framed-avatar";
import {
  Camera, PencilLine, MapPin, ShieldCheck, Share2, QrCode, FileDown, ArrowRight, Star, Gauge, Fingerprint,
} from "lucide-react";
import { HoloCard } from "./HoloCard";
import { AvailabilityIndicator } from "@/components/profile/AvailabilityIndicator";
import { TrustSignals } from "@/components/profile/TrustSignals";
import { SocialStatsInline } from "@/components/profile/SocialStatsInline";
import type { Standing } from "@/lib/passport/standing";
import { cn } from "@/lib/utils";

/** Shared gray -> Kretopia pink treatment for the Passport's one banner and
 *  one progress bar (see RoleStamp/PassportHero redesign) -- everywhere
 *  else on the card keeps the single accent token unchanged. */
const GRAY_PINK_GRADIENT = "linear-gradient(90deg, #6B7280 0%, #FF2DA1 100%)";

interface HeroCredit {
  project_name: string;
  role: string;
  verification_status?: string | null;
  is_featured?: boolean | null;
  thumbnail_url?: string | null;
  primary_media_url?: string | null;
  year?: number | null;
}

interface PassportHeroProps {
  profile: any;
  standing: Standing;
  credits: HeroCredit[];
  verifiedCredits: number;
  totalCredits: number;
  cosigns: number;
  taggedCount?: number;
  onShare: () => void;
  onEdit: () => void;
  onAvatarClick: () => void;
  isUploadingAvatar?: boolean;
  onShowQR: () => void;
  onDownloadEPK: () => void;
  onRefresh?: () => void;
}

/**
 * PassportHero — the ONE dominant Passport surface.
 *
 * Replaces the old ProfileHero + PassportClaimHero pair (two separate hero
 * blocks, duplicated bio/stats/Share). Owns identity (image, name, roles,
 * location, bio), trust/evidence status, strongest credits, stamps, skills,
 * Passport Strength, one primary action (Share) and one intelligent next
 * action (Standing's own next-best-move, already computed elsewhere —
 * reused here, not reinvented).
 */
export function PassportHero({
  profile,
  standing,
  credits,
  verifiedCredits,
  totalCredits,
  cosigns,
  taggedCount = 0,
  onShare,
  onEdit,
  onAvatarClick,
  isUploadingAvatar,
  onShowQR,
  onDownloadEPK,
  onRefresh,
}: PassportHeroProps) {
  const displayName = profile.full_name;
  const passportId = useMemo(
    () => (profile.user_id ? `THR-${profile.user_id.replace(/-/g, "").slice(0, 5).toUpperCase()}` : "THR-—"),
    [profile.user_id],
  );

  // Passport Strength — the one progress meter on this card. Same inputs
  // PassportCommandCenter used to compute independently; now computed once,
  // here, and no longer duplicated downstream.
  const strength = Math.round(
    (profile.bio ? 20 : 0) +
    (profile.avatar_url ? 15 : 0) +
    Math.min(totalCredits, 5) * 6 +
    Math.min(verifiedCredits, 3) * 10 +
    Math.min(cosigns, 1) * 5,
  );

  const strongestCredits = useMemo(() => {
    const score = (c: HeroCredit) => (c.is_featured ? 2 : 0) + (c.verification_status === "verified" ? 1 : 0);
    return [...credits].sort((a, b) => score(b) - score(a)).slice(0, 2);
  }, [credits]);

  const topSkills: string[] = Array.isArray(profile.professional_skills)
    ? (profile.professional_skills as any[])
        .map((s) => (typeof s === "string" ? s : s?.skill))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const nextAction = standing.nextActions?.[0];
  const hasTrust = profile.email_verified || profile.phone_verified || profile.id_verified || profile.payment_verified;
  const isVerifiedPro = standing.level >= 3;

  return (
    <HoloCard>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        {/* Cover */}
        <div
          className={cn(
            "relative aspect-[3/1] sm:aspect-[4/1] overflow-hidden",
            !profile.cover_image_url && "bg-muted/60",
          )}
        >
          {profile.cover_image_url ? (
            <img
              src={profile.cover_image_url}
              alt={`${displayName || "Profile"} cover`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Add a cover image to make your Passport pop
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 h-9 w-9 rounded-full shadow-md opacity-90 hover:opacity-100 focus-visible:opacity-100"
                onClick={onEdit}
                aria-label="Edit profile"
              >
                <PencilLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-sm">Edit profile</p>
            </TooltipContent>
          </Tooltip>
          <div
            className="absolute top-2 left-2 px-2.5 py-1 text-white text-[10px] font-bold uppercase tracking-[0.15em] rounded-full"
            style={{ background: GRAY_PINK_GRADIENT }}
          >
            Creative Passport
          </div>
        </div>

        <div className="relative px-5 pb-5 -mt-8 space-y-4">
          {/* Identity row */}
          <div className="flex items-end justify-between gap-3">
            <div className="relative shrink-0">
              {isVerifiedPro && (
                <div
                  aria-hidden
                  className="ai-orbit-ring pointer-events-none absolute -inset-1.5 rounded-full"
                  style={{ background: "conic-gradient(from 0deg, transparent, hsl(var(--signal-teal)/0.85), transparent 30%)" }}
                />
              )}
              <FramedAvatar
                src={profile.avatar_url || "/avatar-silhouette.svg"}
                fallback={displayName?.split(" ").map((n: string) => n[0]).join("") || "?"}
                alt={displayName || undefined}
                className="h-20 w-20 rounded-full border-2 border-card shadow-lg bg-card"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full shadow-md"
                onClick={onAvatarClick}
                disabled={isUploadingAvatar}
                aria-label="Change avatar"
              >
                {isUploadingAvatar ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-background border-t-foreground" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Name + roles + location */}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xl font-black tracking-tight leading-tight break-words">{displayName}</h2>
              {profile.verification_status === "verified" && (
                <div className="flex items-center justify-center h-4 w-4 rounded-full bg-primary shrink-0" title="Verified">
                  <ShieldCheck className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-muted-foreground/70">
              <Fingerprint className="h-3 w-3 shrink-0 text-[hsl(var(--signal-teal))]" />
              <span title="Your unique Passport ID">{passportId}</span>
            </div>
            <div className="mt-1 flex items-center gap-x-2 gap-y-1 text-xs text-muted-foreground flex-wrap">
              {(profile.username || profile.role) && (
                <span className="flex items-center gap-1.5">
                  {profile.username && <span className="font-mono text-foreground/80">@{profile.username}</span>}
                  {profile.username && profile.role && <span aria-hidden className="opacity-40">·</span>}
                  {profile.role && <span>{profile.role}</span>}
                </span>
              )}
              {profile.location && (
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{profile.location}</span>
                </span>
              )}
              <AvailabilityIndicator
                status={profile.availability_status || profile.availability}
                note={profile.availability_note}
                isOwnProfile
                onRefresh={onRefresh}
              />
            </div>
            {Array.isArray(profile.sub_roles) && profile.sub_roles.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                {profile.sub_roles.slice(0, 3).map((r: string) => (
                  <Badge key={r} variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Bio — now inside the one dominant surface */}
          {profile.bio && (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{profile.bio}</p>
          )}

          {/* Trust / evidence status */}
          {(hasTrust || taggedCount > 0) && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {hasTrust && (
                <TrustSignals
                  emailVerified={profile.email_verified}
                  phoneVerified={profile.phone_verified}
                  idVerified={profile.id_verified}
                  paymentVerified={profile.payment_verified}
                  compact
                />
              )}
              {taggedCount > 0 && (
                <span className="text-[11px] text-[hsl(var(--signal-teal))] font-medium">
                  {taggedCount} unclaimed credit{taggedCount === 1 ? "" : "s"} tagged to you
                </span>
              )}
            </div>
          )}

          {/* Strongest verified credits */}
          {strongestCredits.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Strongest credits
              </p>
              <div className="grid grid-cols-2 gap-2">
                {strongestCredits.map((c, i) => (
                  <div key={`${c.project_name}-${i}`} className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <p className="text-xs font-semibold truncate">{c.project_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.role}{c.verification_status === "verified" && (
                        <span className="text-[hsl(var(--signal-teal))]"> · Verified</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stamps + skills, single trust line */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Star className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
            <span>
              {totalCredits} stamp{totalCredits === 1 ? "" : "s"} ({verifiedCredits} verified)
              {" · "}{cosigns} co-sign{cosigns === 1 ? "" : "s"}
            </span>
          </div>

          {topSkills.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {topSkills.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          {/* Passport Strength — the one progress meter */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="h-3.5 w-3.5 text-[hsl(var(--signal-teal))]" />
              <p className="text-xs font-medium">Passport Strength — {strength}%</p>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(strength, 100)}%`, background: GRAY_PINK_GRADIENT }}
              />
            </div>
          </div>

          {/* One primary action + secondary icon row — neutral Liquid Glass,
              not a loud pink fill. #FF2DA1 shows only on hover/focus/active. */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onShare}
              variant="outline"
              className="glass-surface flex-1 h-10 gap-1.5 border-white/10 text-foreground transition-colors hover:border-[#FF2DA1]/50 hover:text-[#FF2DA1] focus-visible:ring-[#FF2DA1] active:text-[#FF2DA1]"
            >
              <Share2 className="h-4 w-4" />
              Share Passport
            </Button>
            <Button onClick={onShowQR} variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Show QR code">
              <QrCode className="h-4 w-4" />
            </Button>
            <Button onClick={onDownloadEPK} variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Download press kit PDF">
              <FileDown className="h-4 w-4" />
            </Button>
          </div>

          {/* One intelligent next action — goes to the action's real deeplink,
              not a generic scroll, since different actions lead different places. */}
          {nextAction && (
            <Link
              to={nextAction.deeplink}
              className="w-full flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-left hover:border-[hsl(var(--signal-teal))]/40 transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--signal-teal))] shrink-0" />
              <span className="text-xs font-medium flex-1 min-w-0 truncate">{nextAction.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          )}

          <SocialStatsInline
            youtubeSubscribers={profile.youtube_subscribers}
            instagramFollowers={profile.instagram_followers}
            tiktokFollowers={profile.tiktok_followers}
            spotifyListeners={profile.spotify_listeners}
            twitterFollowers={profile.twitter_followers}
            linkedinConnections={profile.linkedin_connections}
            verifiedMetrics={profile.verified_metrics}
          />
        </div>
      </div>
    </HoloCard>
  );
}

export default PassportHero;
