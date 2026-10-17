/**
 * ProductionPage — v5 “Cinematic + Studio, no Full credits panel, perfect spacing”
 *
 * - About this production:
 *   - toujours rempli
 *   - grille de Holo Cards pour TOUS les créatifs du projet
 *   - vrais Passports si l’artiste est sur Kretopia
 *   - faux Passports “Guest Creator” sinon, mais ergonomiques et cliquables
 *   - média player compact et expandable
 *
 * - Get involved:
 *   - CTA renforcés (claim, propose project, share)
 *
 * - Verified on Kretopia:
 *   - grille de Holo Cards pour les crédits vérifiés
 *
 * - Plus de panneau “Full credits”
 * - Margins / paddings parfaits
 * - Textes tronqués, plus de débordements
 * - Branding Kretopia poussé
 */

import { useEffect, useState, useCallback } from "react";
import { extractThumbnailForStorage } from "@/lib/thumbnailExtractor";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ShieldCheck,
  MapPin,
  CalendarDays,
  Building2,
  ExternalLink,
  Users,
  UserPlus,
  Globe,
  Music,
  Film,
  CheckCircle2,
  Sparkles,
  Database,
  Link2,
  Plus,
  Camera,
  Palette,
  Megaphone,
  PartyPopper,
  Play,
  Handshake,
  Mail,
  MessageSquare,
  X,
  Maximize2,
  Share2,
  Zap,
} from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { getShareUrl } from "@/lib/constants";
import { AuthPrompt, useAuthPrompt } from "@/components/AuthPrompt";
import { parseMediaUrl } from "@/lib/mediaUtils";
import { CreditEndorsementDialog } from "@/components/profile/CreditEndorsementDialog";
import { PageTransition } from "@/components/PageTransition";
import { EditorialPageHero } from "@/components/kretopia/EditorialPageHero";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";

interface PlatformRole {
  id: string;
  role: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  verification_status: string | null;
  endorsement_count: number | null;
  has_kretopia_profile: boolean;
  is_guest?: boolean;
}

interface ProductionData {
  name: string;
  type: string;
  year: number | null;
  industry: string;
  description: string;
  platform: string | null;
  location: string | null;
  client_brand: string | null;
  external_url: string | null;
  image_url: string | null;
  media_url: string | null;
  total_roles: number;
  source: string;
}

const INDUSTRY_ICONS: Record<string, any> = {
  Music: Music,
  Film: Film,
  "Film & TV": Film,
  Fashion: Palette,
  Events: PartyPopper,
  Advertising: Megaphone,
  Photography: Camera,
};

/**
 * Truncate text with ellipsis if too long.
 */
function TruncatedText({
  text,
  maxLength = 24,
  className,
}: {
  text: string | null | undefined;
  maxLength?: number;
  className?: string;
}) {
  if (!text) return null;
  const display = text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  return <span className={cn("truncate", className)} title={text}>{display}</span>;
}

/**
 * HoloCard — passport‑style card for any credited creative.
 */
function CreativeHoloCard({
  role,
  projectName,
  onCollaborate,
  onClaim,
  onInvite,
  isOwner,
  onVerify,
}: {
  role: PlatformRole;
  projectName: string;
  onCollaborate: (role: PlatformRole) => void;
  onClaim: (roleName: string) => void;
  onInvite: (role: PlatformRole) => void;
  isOwner: boolean;
  onVerify: (role: PlatformRole) => void;
}) {
  const isVerified = role.verification_status === "verified";
  const isVouched =
    (role.endorsement_count || 0) > 0 ||
    role.verification_status === "peer" ||
    role.verification_status === "pending";

  const statusBadge = isVerified ? (
    <Badge className="gap-1 bg-primary/10 text-primary border-primary/30 text-[10px]">
      <ShieldCheck className="h-3 w-3" /> Verified
    </Badge>
  ) : isVouched ? (
    <Badge className="gap-1 bg-primary/10 text-primary border-primary/30 text-[10px]">
      <ShieldCheck className="h-3 w-3" /> Vouched
    </Badge>
  ) : (
    <Badge className="gap-1 bg-muted text-muted-foreground border-border text-[10px]">
      <CheckCircle2 className="h-3 w-3" /> Claimed
    </Badge>
  );

  const canViewProfile = role.has_kretopia_profile && role.user_id;

  const handleAvatarClick = () => {
    if (canViewProfile) {
      window.location.href = `/profile/${role.user_id}`;
    }
  };

  if (!role.has_kretopia_profile || role.is_guest) {
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        <div className="flex items-center gap-3">
          <Avatar
            className={cn(
              "h-10 w-10 border border-border",
              canViewProfile && "cursor-pointer",
            )}
            onClick={handleAvatarClick}
          >
            <AvatarImage src={role.avatar_url || ""} />
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              {(role.full_name || "?")[0]}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={cn(
                  "text-sm font-semibold text-foreground truncate",
                  canViewProfile && "cursor-pointer hover:underline",
                )}
                onClick={handleAvatarClick}
              >
                <TruncatedText text={role.full_name || "Unknown"} maxLength={20} />
              </p>
              {statusBadge}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              <TruncatedText text={role.role} maxLength={22} />
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Guest creator — not on Kretopia yet
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onInvite(role)}
          >
            <Mail className="h-3.5 w-3.5" />
            Invite to Kretopia
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onClaim(role.role)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Claim role
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onCollaborate(role)}
          >
            <Handshake className="h-3.5 w-3.5" />
            Collaborate
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-success/20 bg-success/5 p-4 transition-colors hover:border-success/35 hover:bg-success/10">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-success/70 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="flex items-center gap-3">
        <Avatar
          className={cn(
            "h-10 w-10 ring-2 ring-success/30",
            canViewProfile && "cursor-pointer",
          )}
          onClick={handleAvatarClick}
        >
          <AvatarImage src={role.avatar_url || ""} />
          <AvatarFallback className="text-xs bg-success/10">
            {(role.full_name || "?")[0]}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm font-semibold text-foreground truncate",
                canViewProfile && "cursor-pointer hover:underline",
              )}
              onClick={handleAvatarClick}
            >
              <TruncatedText text={role.full_name || "Unknown"} maxLength={20} />
            </p>
            {statusBadge}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            <TruncatedText text={role.role} maxLength={22} />
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => onCollaborate(role)}
        >
          <Users className="h-3.5 w-3.5" />
          View Passport
        </Button>

        {isOwner ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onVerify(role)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            {isVerified ? "Add vouch" : "Get verified"}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => onCollaborate(role)}
            >
              <Mail className="h-3.5 w-3.5" />
              Collaborate
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => onInvite(role)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Propose project
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Compact media player with expandable “grand écran” mode.
 */
function CompactMediaPlayer({
  mediaUrl,
}: {
  mediaUrl: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!mediaUrl) return null;
  const mediaInfo = parseMediaUrl(mediaUrl);
  if (!mediaInfo) return null;

  const isAudio =
    mediaInfo.platform === "spotify" ||
    mediaInfo.platform === "soundcloud";

  const PlayerContent = () => (
    <div
      className={cn(
        "w-full rounded-xl overflow-hidden bg-foreground/10 border border-border",
        isAudio ? "aspect-[16/7]" : "aspect-video",
      )}
    >
      <iframe
        src={mediaInfo.embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );

  return (
    <>
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              {isAudio ? "Listen" : "Watch"}
            </h3>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setExpanded(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Full screen
          </Button>
        </div>

        <PlayerContent />
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setExpanded(false)}
              className="absolute -top-10 right-0 flex items-center gap-2 text-xs text-white/80 hover:text-white"
            >
              <X className="h-4 w-4" />
              Close
            </button>

            <PlayerContent />
          </div>
        </div>
      )}
    </>
  );
}

const ProductionPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open: authOpen, setOpen: setAuthOpen, requireAuth } = useAuthPrompt();

  const projectName = searchParams.get("name") || "";
  const [loading, setLoading] = useState(true);
  const [production, setProduction] = useState<ProductionData | null>(null);
  const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>([]);
  const [addingRole, setAddingRole] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [endorseCredit, setEndorseCredit] = useState<{
    id: string;
    project_name: string;
    role: string;
    year?: number;
  } | null>(null);

  const fetchProduction = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);

    try {
      const { data: credits } = await supabase
        .from("credits")
        .select("id, role, user_id, verification_status, endorsement_count")
        .ilike("project_name", projectName)
        .order("role");

      const userIds = [...new Set((credits || []).map((c) => c.user_id))];
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        profiles?.forEach((p) => profileMap.set(p.user_id, p));
      }

      const mappedPlatformRoles: PlatformRole[] = (credits || []).map((c) => {
        const profile = profileMap.get(c.user_id);
        const hasProfile = Boolean(profile?.full_name);

        return {
          id: c.id,
          role: c.role,
          user_id: c.user_id,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          verification_status: c.verification_status,
          endorsement_count: c.endorsement_count,
          has_kretopia_profile: hasProfile,
          is_guest: !hasProfile,
        };
      });
      setPlatformRoles(mappedPlatformRoles);

      const { data, error } = await supabase.functions.invoke("production-detail", {
        body: {
          project_name: projectName,
          existing_roles: mappedPlatformRoles.map((r) => r.role),
        },
      });

      if (error) throw error;
      if (data?.production) {
        setProduction(data.production);
      }
    } catch (err) {
      console.error("Failed to load production:", err);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    fetchProduction();
  }, [fetchProduction]);

  const handleClaim = async (roleName: string) => {
    if (!user) {
      sessionStorage.setItem(
        "thrivein_pending_claim",
        JSON.stringify({
          project_name: projectName,
          role: roleName,
        }),
      );
      requireAuth("claim this credit");
      return;
    }
    try {
      const extractedThumb = extractThumbnailForStorage(
        production?.external_url || null,
      );
      await supabase.from("credits").insert({
        user_id: user.id,
        project_name: projectName,
        role: roleName,
        year: production?.year,
        platform: production?.platform,
        location: production?.location,
        client_brand: production?.client_brand,
        project_type: production?.type,
        verification_status: "manual",
        thumbnail_url: extractedThumb,
      });
      toast.success(`Claimed "${roleName}" on ${projectName}!`);
      fetchProduction();
    } catch {
      toast.error("Failed to claim credit");
    }
  };

  const handleAddRole = async () => {
    if (!newRole.trim()) return;
    if (!user) {
      requireAuth("add a role");
      return;
    }
    await handleClaim(newRole.trim());
    setNewRole("");
    setAddingRole(false);
  };

  const buildProductionShare = () => {
    const sharePath = `/production?name=${encodeURIComponent(projectName)}`;
    const shareUrl = getShareUrl(sharePath);
    const shareText = `${projectName} on Kretopia — the verified credits platform for creatives. See the roll call, search your name, and claim or verify the credit if you worked on it.`;
    return { shareUrl, shareText };
  };

  const handleShareProduction = async () => {
    const { shareUrl, shareText } = buildProductionShare();
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: `${projectName} on Kretopia`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        /* user dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      toast.success("Kretopia share message copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleCollaborate = (role: PlatformRole) => {
    if (!role.has_kretopia_profile) {
      toast.info(`Invite sent to ${role.full_name || "this creator"} (demo).`);
      return;
    }
    navigate(`/profile/${role.user_id}`);
  };

  const handleInvite = (role: PlatformRole) => {
    if (!role.has_kretopia_profile) {
      toast.info(
        `Invite to Kretopia sent to ${role.full_name || "this creator"} (demo).`,
      );
      return;
    }
    toast.info("Propose new project (demo flow).");
  };

  const handleVerify = (role: PlatformRole) => {
    setEndorseCredit({
      id: role.id,
      project_name: projectName,
      role: role.role,
      year: production?.year ?? undefined,
    });
  };

  const Icon = production
    ? INDUSTRY_ICONS[production.industry] || Database
    : Database;

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
          <KretopiaSpinner className="h-8 w-8 text-primary" />
          <p className="text-xs text-muted-foreground animate-pulse">
            Loading production details...
          </p>
        </div>
      </PageTransition>
    );
  }

  if (!production) {
    return (
      <PageTransition>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <Database className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">Production not found</p>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Go Home
          </Button>
        </div>
      </PageTransition>
    );
  }

  const totalClaimed = platformRoles.length;
  const totalUnclaimed = Math.max(production.total_roles - totalClaimed, 0);

  const allCreatives: PlatformRole[] = platformRoles;

  return (
    <PageTransition>
      <Helmet>
        <title>{projectName} — Kretopia Credits | Kretopia</title>
        <meta
          name="description"
          content={
            production.description ||
            `${projectName} — production credits on Kretopia. See the full roll call and claim your credit.`
          }
        />
        <meta property="og:title" content={`${projectName} — Kretopia Credits`} />
        <meta
          property="og:description"
          content={`${production.total_roles} roles · ${totalClaimed} claimed · See full production credits and claim yours on Kretopia`}
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content={getShareUrl(
            `/production?name=${encodeURIComponent(projectName)}`,
          )}
        />
        {production.image_url && (
          <meta property="og:image" content={production.image_url} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${projectName} — Kretopia Credits`} />
        <meta
          name="twitter:description"
          content={`${production.total_roles} roles · ${totalClaimed} claimed on Kretopia`}
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <EditorialPageHero
          kicker="The Production"
          oneLine
          title={<TruncatedText text={`${production.name}.`} maxLength={32} />}
          accentTitle="Full credits."
          subtitle={
            production.description ||
            `${production.total_roles} roles · ${totalClaimed} claimed · See the roll call and claim your credit on Kretopia.`
          }
        />

        <StudioFeatureShell>
          <WrappedShell
            titleId="production-wrapped"
            eyebrow="Kretopia · Production"
            title={
              <>
                Everything in <span className="k-gradient-text">{production.name}</span>
              </>
            }
            status={
              <>
                <span>{production.total_roles} roles</span>
                <span aria-hidden>·</span>
                <span>{totalClaimed} claimed</span>
                <span aria-hidden>·</span>
                <span>{platformRoles.filter((r) => r.verification_status === "verified").length} verified</span>
              </>
            }
            aside={
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShareProduction}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            }
          >
            {/* Facts + Get involved, one compact row */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid grid-cols-3 gap-2 lg:col-span-2">
                {[
                  { icon: Icon, label: production.industry || "Production" },
                  { icon: CalendarDays, label: production.year ? String(production.year) : "Year TBD" },
                  { icon: MapPin, label: production.location || "Location TBD" },
                  { icon: Building2, label: production.client_brand || "Independent" },
                  { icon: Globe, label: production.platform || "Kretopia" },
                  { icon: Users, label: `${totalClaimed}/${production.total_roles} claimed` },
                ].map(({ icon: FactIcon, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <FactIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="truncate text-xs font-medium text-foreground" title={label}>{label}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-primary" aria-hidden />
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Join the roll call</p>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {totalUnclaimed > 0
                    ? `${totalUnclaimed} of ${production.total_roles} roles are still unclaimed. Worked on ${production.name}? Claim your credit.`
                    : `Every listed role on ${production.name} has been claimed.`}
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setAddingRole(true);
                      document.getElementById("production-add-role")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Claim your role
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (!user) {
                        requireAuth("propose a new project");
                        return;
                      }
                      toast.info("Propose a new project (demo flow).");
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Propose a new project
                  </Button>
                </div>
              </div>
            </div>

            {/* Media */}
            {(production.media_url || production.external_url) && (
              <CompactMediaPlayer mediaUrl={production.media_url || production.external_url} />
            )}

            {/* Roll call — the single creatives grid */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">The roll call</h3>
                <span className="text-xs text-muted-foreground">{allCreatives.length} creative{allCreatives.length === 1 ? "" : "s"}</span>
              </div>

              {platformRoles.some((r) => user?.id === r.user_id) && (
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">Verify or strengthen your credit</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ask a collaborator, client, producer, or supervisor to confirm your role. Only the credit owner sees these buttons.
                    </p>
                  </div>
                </div>
              )}

              {allCreatives.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-6 text-center">
                  <Database className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No creatives listed yet for this production.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Be the first to claim your role below.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allCreatives.map((r) => (
                    <CreativeHoloCard
                      key={r.id}
                      role={r}
                      projectName={projectName}
                      onCollaborate={handleCollaborate}
                      onClaim={handleClaim}
                      onInvite={handleInvite}
                      isOwner={user?.id === r.user_id}
                      onVerify={handleVerify}
                    />
                  ))}
                </div>
              )}

              {/* Add your role */}
              <div id="production-add-role" className="mt-4">
                {addingRole ? (
                  <div className="flex gap-2">
                    <input
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      placeholder="e.g. Assistant Editor, Stylist..."
                      className="h-10 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleAddRole()}
                    />
                    <Button onClick={handleAddRole} size="sm" className="h-10 px-4">Claim</Button>
                    <Button
                      onClick={() => { setAddingRole(false); setNewRole(""); }}
                      variant="ghost"
                      size="sm"
                      className="h-10 text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingRole(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Worked on this? Add your role
                  </button>
                )}
              </div>
            </div>
          </WrappedShell>
        </StudioFeatureShell>
        </StudioFeatureShell>
      </div>

      <AuthPrompt
        open={authOpen}
        onOpenChange={setAuthOpen}
        action="claim this credit"
      />
      {endorseCredit && user && (
        <CreditEndorsementDialog
          open={!!endorseCredit}
          onOpenChange={(o) => !o && setEndorseCredit(null)}
          credit={endorseCredit}
          userId={user.id}
        />
      )}
    </PageTransition>
  );
};

export default ProductionPage;