import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2, Camera, PencilLine, MapPin, ShieldCheck, Share2, QrCode, CreditCard,
  ArrowRight, Star, Gauge, Fingerprint, Briefcase, Users,
} from "lucide-react";
import { HoloCard } from "@/components/passport/HoloCard";
import { TrustSignals } from "@/components/profile/TrustSignals";
import { ProfileQRDialog } from "@/components/profile/ProfileQRDialog";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { badgeLabel } from "@/lib/badgeLabel";

interface CompanyStats {
  oppsPosted: number;
  activeJobs: number;
  talentsHired: number;
  completedHires: number;
  avgResponseDays: number;
}

interface OpportunityLite {
  id: string;
  title: string;
  category?: string | null;
  budget?: string | null;
}

interface TeamMemberLite {
  user_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface BrandPassportHeroProps {
  profile: any;
  stats: CompanyStats;
  opportunities: OpportunityLite[];
  teamMembers: TeamMemberLite[];
  reviewCount: number;
  onEdit: () => void;
  onShare: () => void;
}

// Same tier ladder shape as the creator Standing (level + title driving a
// badge), computed from what a brand account actually accrues: hiring
// activity and rating, not credits/co-signs. Deliberately simple — this
// is a badge, not a scoring engine to maintain in parallel with
// lib/passport/standing.ts.
function brandTier(stats: CompanyStats, avgRating: number | undefined, verified: boolean) {
  if (verified && stats.talentsHired >= 3 && (avgRating ?? 0) >= 4) return { level: 3, title: "Trusted Partner" };
  if (stats.talentsHired >= 1 || stats.activeJobs >= 1) return { level: 2, title: "Active Hirer" };
  return { level: 1, title: "New Brand" };
}

/**
 * BrandPassportHero — the Brand-account equivalent of PassportHero: the
 * same HoloCard shell (3D tilt, ambient glow, scan-line, foil sheen) and
 * the same section grammar (cover → identity → bio → trust → highlights →
 * stamps line → strength meter → actions → next action), reusing the
 * exact same components (HoloCard, TrustSignals) rather than a visual
 * reimplementation — so a brand's Passport reads as unmistakably the same
 * product as a creator's, not a different app bolted on. Every field maps
 * to something a brand account actually accrues instead of the creator
 * fields it has no equivalent for (no credits/co-signs/skills — hires,
 * postings and reviews instead).
 */
export function BrandPassportHero({
  profile,
  stats,
  opportunities,
  teamMembers,
  reviewCount,
  onEdit,
  onShare,
}: BrandPassportHeroProps) {
  const navigate = useNavigate();
  const [qrOpen, setQrOpen] = useState(false);

  const displayName = profile.company_name || profile.full_name;
  const displayLogo = profile.company_logo_url || profile.avatar_url;
  const isVerified = profile.verification_status === "verified";
  const avgRating: number | undefined = profile.average_rating;

  const tier = useMemo(() => brandTier(stats, avgRating, isVerified), [stats, avgRating, isVerified]);
  const isEstablished = tier.level >= 3;

  const brandId = useMemo(
    () => (profile.user_id ? `BRD-${profile.user_id.replace(/-/g, "").slice(0, 5).toUpperCase()}` : "BRD-—"),
    [profile.user_id],
  );

  // Same idea as PassportHero's Passport Strength — a weighted sum of the
  // fields that actually make a Brand Passport useful to a creator
  // deciding whether to apply, not a vanity number.
  const strength = Math.round(
    (profile.company_about ? 20 : 0) +
    (displayLogo ? 15 : 0) +
    ((profile.cover_image_url || profile.company_images?.length) ? 10 : 0) +
    (profile.company_industry ? 10 : 0) +
    (profile.company_address ? 10 : 0) +
    Math.min(stats.oppsPosted, 5) * 5 +
    Math.min(stats.talentsHired, 3) * 5,
  );

  const hasTrust = profile.email_verified || profile.phone_verified || profile.id_verified || profile.payment_verified;

  const nextAction = stats.oppsPosted === 0
    ? { label: "Post your first opportunity", to: "/opportunities" }
    : !profile.company_about
    ? { label: "Add your company story", to: "#edit" }
    : !displayLogo || !profile.cover_image_url
    ? { label: "Complete your Brand Passport", to: "#edit" }
    : null;

  const highlightOpps = opportunities.slice(0, 2);

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
            <img src={profile.cover_image_url} alt={`${displayName || "Brand"} cover`} className="h-full w-full object-cover" loading="lazy" />
          ) : profile.company_images?.[0] ? (
            <img src={profile.company_images[0]} alt={`${displayName || "Brand"} cover`} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Add a cover image to make your Brand Passport pop
            </div>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 h-7 text-xs gap-1 shadow-md opacity-90 hover:opacity-100"
            onClick={onEdit}
            aria-label="Edit Brand Passport"
          >
            <PencilLine className="h-3 w-3" />
            Edit Passport
          </Button>
          <div className="absolute top-2 left-2 px-2.5 py-1 bg-[hsl(var(--signal-teal))] text-black text-[10px] font-bold uppercase tracking-[0.15em] rounded-full">
            Brand Passport
          </div>
        </div>

        <div className="relative px-5 pb-5 -mt-8 space-y-4">
          {/* Identity row */}
          <div className="flex items-end justify-between gap-3">
            <div className="relative shrink-0">
              {isEstablished && (
                <div
                  aria-hidden
                  className="ai-orbit-ring pointer-events-none absolute -inset-1.5 rounded-full"
                  style={{ background: "conic-gradient(from 0deg, transparent, hsl(var(--signal-teal)/0.85), transparent 30%)" }}
                />
              )}
              <Avatar className="h-20 w-20 rounded-2xl border-2 border-card shadow-lg bg-card">
                <AvatarImage src={displayLogo} alt={displayName} className="object-cover rounded-2xl" />
                <AvatarFallback className="rounded-2xl text-2xl bg-primary/10">
                  <Building2 className="h-8 w-8 text-primary" />
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full shadow-md"
                onClick={onEdit}
                aria-label="Change logo"
              >
                <Camera className="h-3 w-3" />
              </Button>
            </div>
            <Badge
              variant="outline"
              className={
                isEstablished
                  ? "bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40 shrink-0"
                  : "bg-muted text-muted-foreground border-border shrink-0"
              }
            >
              <ShieldCheck className="h-3 w-3 mr-1" />
              {isEstablished ? tier.title : `L${tier.level}`}
            </Badge>
          </div>

          {/* Name + industry + location */}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xl font-black tracking-tight leading-tight break-words">{displayName}</h2>
              {isVerified && (
                <div className="flex items-center justify-center h-4 w-4 rounded-full bg-primary shrink-0" title="Verified">
                  <ShieldCheck className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              {profile.badge && (
                <Badge
                  variant="default"
                  className={cn("h-5 text-[10px]", profile.badge === "odos" && "bg-green-500 hover:bg-green-600")}
                >
                  {badgeLabel(profile.badge)}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-muted-foreground/70">
              <Fingerprint className="h-3 w-3 shrink-0 text-[hsl(var(--signal-teal))]" />
              <span title="Your unique Brand Passport ID">{brandId}</span>
            </div>
            <div className="mt-1 flex items-center gap-x-2 gap-y-1 text-xs text-muted-foreground flex-wrap">
              {(profile.company_industry || profile.company_size) && (
                <span className="flex items-center gap-1.5">
                  {profile.company_industry && <span>{profile.company_industry}</span>}
                  {profile.company_industry && profile.company_size && <span aria-hidden className="opacity-40">·</span>}
                  {profile.company_size && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{profile.company_size}</span>}
                </span>
              )}
              {profile.company_address && (
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{profile.company_address}</span>
                </span>
              )}
              {stats.activeJobs > 0 && (
                <span className="flex items-center gap-1 text-[hsl(var(--signal-teal))] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--signal-teal))] ai-ambient-breathe" />
                  Actively hiring
                </span>
              )}
            </div>
          </div>

          {/* Tagline / about — now inside the one dominant surface */}
          {(profile.company_tagline || profile.company_about) && (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {profile.company_tagline && <span className="italic">"{profile.company_tagline}"</span>}
              {profile.company_tagline && profile.company_about && " "}
              {profile.company_about}
            </p>
          )}

          {/* Trust / evidence status */}
          {(hasTrust || stats.activeJobs > 0) && (
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
              {stats.activeJobs > 0 && (
                <span className="text-[11px] text-[hsl(var(--signal-teal))] font-medium">
                  {stats.activeJobs} active opening{stats.activeJobs === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}

          {/* Recent opportunities — same "strongest evidence" grid slot as
              PassportHero's strongest-credits grid */}
          {highlightOpps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Recent opportunities
              </p>
              <div className="grid grid-cols-2 gap-2">
                {highlightOpps.map((o) => (
                  <Link
                    key={o.id}
                    to={`/opportunity/${o.id}`}
                    className="rounded-lg border border-border/60 bg-muted/30 p-2.5 hover:border-[hsl(var(--signal-teal))]/40 transition-colors"
                  >
                    <p className="text-xs font-semibold truncate">{o.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {o.category || "Open role"}{o.budget && <span> · {o.budget}</span>}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Hires + reviews, single trust line — same slot as PassportHero's stamps line */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Star className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
            <span>
              {stats.talentsHired} creator{stats.talentsHired === 1 ? "" : "s"} hired ({stats.completedHires} completed)
              {" · "}{reviewCount} review{reviewCount === 1 ? "" : "s"}
            </span>
          </div>

          {teamMembers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {teamMembers.slice(0, 4).map((m) => (
                  <Avatar key={m.user_id} className="h-6 w-6 border-2 border-card">
                    <AvatarImage src={m.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{m.full_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {teamMembers.length} team member{teamMembers.length === 1 ? "" : "s"}
              </span>
            </div>
          )}

          {/* Brand Passport Strength — same slot as PassportHero's meter */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="h-3.5 w-3.5 text-[hsl(var(--signal-teal))]" />
              <p className="text-xs font-medium">Brand Passport Strength — {Math.min(strength, 100)}%</p>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--signal-teal))] transition-all"
                style={{ width: `${Math.min(strength, 100)}%` }}
              />
            </div>
          </div>

          {/* Same action-row treatment as PassportHero: neutral outline,
              pink only on hover/focus/active. Payments replaces Download
              EPK — a brand's real second action, not a creator PDF export. */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onShare}
              variant="outline"
              className="glass-surface flex-1 h-10 gap-1.5 border-white/10 text-foreground transition-colors hover:border-[#FF2DA1]/50 hover:text-[#FF2DA1] focus-visible:ring-[#FF2DA1] active:text-[#FF2DA1]"
            >
              <Share2 className="h-4 w-4" />
              Share Brand Passport
            </Button>
            <Button onClick={() => setQrOpen(true)} variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Show QR code">
              <QrCode className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate("/thrivepay")} variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Payments">
              <CreditCard className="h-4 w-4" />
            </Button>
          </div>

          {nextAction && (
            nextAction.to === "#edit" ? (
              <button
                type="button"
                onClick={onEdit}
                className="btn-glass btn-glass-outline w-full flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left"
              >
                <Briefcase className="h-4 w-4 text-[hsl(var(--signal-teal))] shrink-0" />
                <span className="text-xs font-medium flex-1 min-w-0 truncate">{nextAction.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ) : (
              <Link
                to={nextAction.to}
                className="btn-glass btn-glass-outline w-full flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left"
              >
                <Briefcase className="h-4 w-4 text-[hsl(var(--signal-teal))] shrink-0" />
                <span className="text-xs font-medium flex-1 min-w-0 truncate">{nextAction.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            )
          )}
        </div>
      </div>

      <ProfileQRDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        userId={profile.user_id}
        userName={displayName}
        userAvatar={displayLogo}
      />
    </HoloCard>
  );
}

export default BrandPassportHero;
