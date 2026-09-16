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
  ArrowLeft, ShieldCheck, MapPin, CalendarDays, Building2,
  ExternalLink, Users, UserPlus, Loader2, Globe, Music, Film,
  CheckCircle2, Sparkles, Database, Link2, Plus, Camera, Palette,
  Megaphone, PartyPopper, ChevronDown, ChevronUp, Play,
} from "lucide-react";
import { getShareUrl } from "@/lib/constants";
import { AuthPrompt, useAuthPrompt } from "@/components/AuthPrompt";
import { parseMediaUrl } from "@/lib/mediaUtils";
import { CreditEndorsementDialog } from "@/components/profile/CreditEndorsementDialog";

interface AIRole {
  role: string;
  name: string | null;
  department?: string;
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
  departments: { name: string; roles: AIRole[] }[];
  total_roles: number;
  source: string;
}

// Platform credit from our DB
interface PlatformRole {
  id: string;
  role: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  verification_status: string | null;
  endorsement_count: number | null;
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

const ProductionPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open: authOpen, setOpen: setAuthOpen, requireAuth } = useAuthPrompt();

  const projectName = searchParams.get("name") || "";
  const [loading, setLoading] = useState(true);
  const [production, setProduction] = useState<ProductionData | null>(null);
  const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>([]);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [addingRole, setAddingRole] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [endorseCredit, setEndorseCredit] = useState<{ id: string; project_name: string; role: string; year?: number } | null>(null);

  const fetchProduction = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);

    try {
      // 1. Fetch platform credits for this project
      const { data: credits } = await supabase
        .from("credits")
        .select("id, role, user_id, verification_status, endorsement_count")
        .ilike("project_name", projectName)
        .order("role");

      // Fetch profiles for credited users
      const userIds = [...new Set((credits || []).map(c => c.user_id))];
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        profiles?.forEach(p => profileMap.set(p.user_id, p));
      }

      const mappedPlatformRoles: PlatformRole[] = (credits || []).map(c => ({
        id: c.id,
        role: c.role,
        user_id: c.user_id,
        full_name: profileMap.get(c.user_id)?.full_name || null,
        avatar_url: profileMap.get(c.user_id)?.avatar_url || null,
        verification_status: c.verification_status,
        endorsement_count: c.endorsement_count,
      }));
      setPlatformRoles(mappedPlatformRoles);

      // 2. Use AI to generate full production details + roles
      const { data, error } = await supabase.functions.invoke("production-detail", {
        body: { 
          project_name: projectName,
          existing_roles: mappedPlatformRoles.map(r => r.role),
        },
      });

      if (error) throw error;
      if (data?.production) {
        setProduction(data.production);
        // Auto-expand first 2 departments
        const first2 = (data.production.departments || []).slice(0, 2).map((d: any) => d.name);
        setExpandedDepts(new Set(first2));
      }
    } catch (err) {
      console.error("Failed to load production:", err);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => { fetchProduction(); }, [fetchProduction]);

  const handleClaim = async (roleName: string) => {
    if (!user) {
      // Store claim intent for auto-attach after signup
      sessionStorage.setItem("thrivein_pending_claim", JSON.stringify({
        project_name: projectName,
        role: roleName,
      }));
      requireAuth("claim this credit");
      return;
    }
    try {
      const extractedThumb = extractThumbnailForStorage(production?.external_url || null);
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

  const toggleDept = (name: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
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
        await (navigator as any).share({ title: `${projectName} on Kretopia`, text: shareText, url: shareUrl });
        return;
      } catch { /* user dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      toast.success("Kretopia share message copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const Icon = production ? (INDUSTRY_ICONS[production.industry] || Database) : Database;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse">Loading production details...</p>
      </div>
    );
  }

  if (!production) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Database className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Production not found</p>
        <Button variant="outline" onClick={() => navigate('/')} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Go Home
        </Button>
      </div>
    );
  }

  const totalClaimed = platformRoles.length;

  return (
    <>
      <Helmet>
        <title>{projectName} — Kretopia Credits | Kretopia</title>
        <meta name="description" content={production.description || `${projectName} — production credits on Kretopia. See the full roll call and claim your credit.`} />
        <meta property="og:title" content={`${projectName} — Kretopia Credits`} />
        <meta property="og:description" content={`${production.total_roles} roles · ${totalClaimed} claimed · See full production credits and claim yours on Kretopia`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={getShareUrl(`/production?name=${encodeURIComponent(projectName)}`)} />
        {production.image_url && <meta property="og:image" content={production.image_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${projectName} — Kretopia Credits`} />
        <meta name="twitter:description" content={`${production.total_roles} roles · ${totalClaimed} claimed on Kretopia`} />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground pb-24">
        {/* Hero Header */}
        <div className="relative border-b border-border">
          {production.image_url && (
            <div className="absolute inset-0 overflow-hidden">
              <img src={production.image_url} alt="" className="w-full h-full object-cover opacity-15 blur-sm" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background" />
            </div>
          )}
          <div className="relative container mx-auto max-w-3xl px-4 py-5">
            <button onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }} className="flex items-center gap-1 text-xs text-white/60 hover:text-[hsl(var(--energy))] mb-4 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{projectName}</h1>
                <div className="flex items-center gap-2 flex-wrap mt-1.5 text-xs text-muted-foreground">
                  <Badge className="text-[10px] bg-primary/10 border-primary/20 text-primary">
                    {production.type}
                  </Badge>
                  {production.year && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {production.year}</span>}
                  {production.industry && <span>{production.industry}</span>}
                  {production.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {production.location}</span>}
                </div>
              </div>
            </div>

            {production.description && (
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{production.description}</p>
            )}

            {/* Meta pills */}
            <div className="flex items-center gap-3 flex-wrap mt-4 text-[11px] text-muted-foreground">
              {production.client_brand && (
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {production.client_brand}</span>
              )}
              {production.platform && (
                <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {production.platform}</span>
              )}
              {production.external_url && (
                <a href={production.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> View Source
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Media Player Section */}
        {(() => {
          const mediaUrl = production.media_url || production.external_url;
          if (!mediaUrl) return null;
          const mediaInfo = parseMediaUrl(mediaUrl);
          if (!mediaInfo) return null;
          
          const isAudio = mediaInfo.platform === 'spotify' || mediaInfo.platform === 'soundcloud';
          
          return (
            <div className="border-b border-border">
              <div className="container mx-auto max-w-3xl px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Play className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    {isAudio ? 'Listen' : 'Watch'}
                  </h2>
                </div>
                <div className={cn(
                  "w-full rounded-xl overflow-hidden bg-foreground/10 border border-border",
                  isAudio ? "aspect-[16/7]" : "aspect-video"
                )}>
                  <iframe
                    src={mediaInfo.embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Stats bar */}
        <div className="border-b border-border">
          <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="font-bold text-lg">{production.total_roles}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total Roles</p>
            </div>
            <Separator orientation="vertical" className="h-8 bg-border" />
            <div className="text-center">
              <p className="font-bold text-lg text-success">{totalClaimed}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Claimed</p>
            </div>
            <Separator orientation="vertical" className="h-8 bg-border" />
            <div className="text-center">
              <p className="font-bold text-lg text-primary">{production.total_roles - totalClaimed}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Unclaimed</p>
            </div>
          </div>
        </div>

        {/* Platform-verified credits */}
        {platformRoles.length > 0 && (
          <div className="container mx-auto max-w-3xl px-4 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-success" />
              <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Verified on Kretopia</h2>
            </div>
            {platformRoles.some(r => user?.id === r.user_id) && (
              <div className="mb-3 rounded-xl border border-primary/25 bg-primary/10 p-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">Verify or strengthen your credit</p>
                    <p className="text-xs text-muted-foreground mt-1">Ask a collaborator, client, guest, producer, or supervisor to confirm your role. Only the credit owner sees these buttons.</p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {platformRoles.map(r => {
                const isOwner = user?.id === r.user_id;
                const isVerified = r.verification_status === "verified";
                const isVouched = (r.endorsement_count || 0) > 0 || r.verification_status === "peer" || r.verification_status === "pending";
                return (
                  <div key={r.id} className="rounded-xl bg-success/5 border border-success/15 overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <Avatar className="h-9 w-9 ring-2 ring-success/30 cursor-pointer" onClick={() => navigate(`/profile/${r.user_id}`)}>
                        <AvatarImage src={r.avatar_url || ""} />
                        <AvatarFallback className="text-xs bg-success/10">{(r.full_name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate cursor-pointer hover:underline" onClick={() => navigate(`/profile/${r.user_id}`)}>{r.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{r.role}</p>
                      </div>
                      {isVerified ? (
                        <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30 shrink-0">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </Badge>
                      ) : isVouched ? (
                        <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30 shrink-0">
                          <ShieldCheck className="h-3 w-3" /> Vouched
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 bg-muted text-muted-foreground border-border shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> Claimed
                        </Badge>
                      )}
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => setEndorseCredit({ id: r.id, project_name: projectName, role: r.role, year: production?.year ?? undefined })}
                        className="btn-glass btn-glass-outline w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {isVerified ? "Add collaborator/client vouch" : "Get this credit verified — ask someone"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI-generated full credits by department */}
        <div className="container mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Full Production Credits</h2>
            </div>
            <Badge className="text-[8px] bg-primary/10 border-primary/20 text-primary">
              <Sparkles className="h-2 w-2 mr-0.5" /> Smart Credits
            </Badge>
          </div>

          <div className="space-y-2">
            {production.departments.map(dept => {
              const isExpanded = expandedDepts.has(dept.name);
              const claimedInDept = dept.roles.filter(r => platformRoles.some(pr => pr.role.toLowerCase() === r.role.toLowerCase())).length;

              return (
                <div key={dept.name} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => toggleDept(dept.name)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{dept.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {dept.roles.length} role{dept.roles.length !== 1 ? "s" : ""}
                        {claimedInDept > 0 && <> · <span className="text-success">{claimedInDept} claimed</span></>}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-2 space-y-1">
                      {dept.roles.map((role, ri) => {
                        const claimed = platformRoles.find(pr => pr.role.toLowerCase() === role.role.toLowerCase());
                        return (
                          <div key={ri} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                            {claimed ? (
                              <Avatar className="h-8 w-8 ring-1 ring-success/30 cursor-pointer shrink-0" onClick={() => navigate(`/profile/${claimed.user_id}`)}>
                                <AvatarImage src={claimed.avatar_url || ""} />
                                <AvatarFallback className="text-[10px] bg-success/10">{(claimed.full_name || "?")[0]}</AvatarFallback>
                              </Avatar>
                            ) : (
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{(role.name || "?")[0]}</AvatarFallback>
                              </Avatar>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {claimed ? claimed.full_name : role.name || "Uncredited"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{role.role}</p>
                            </div>
                            {claimed ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {claimed.verification_status === "verified" ? (
                                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                ) : (claimed.endorsement_count || 0) > 0 || claimed.verification_status === "peer" || claimed.verification_status === "pending" ? (
                                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <button onClick={() => navigate(`/profile/${claimed.user_id}`)} className="text-[10px] text-white hover:text-[hsl(var(--energy))] hover:underline transition-colors">View</button>
                                {user?.id === claimed.user_id && (
                                  <button
                                    onClick={() => setEndorseCredit({ id: claimed.id, project_name: projectName, role: claimed.role, year: production?.year ?? undefined })}
                                    className="text-[10px] font-semibold text-white hover:text-[hsl(var(--energy))] hover:underline transition-colors"
                                  >
                                    Verify
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleClaim(role.role)}
                                className="btn-glass btn-glass-outline flex items-center gap-1 text-[10px] font-semibold shrink-0 px-2 py-1 rounded-md"
                              >
                                <UserPlus className="h-3 w-3" /> Claim
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add your role CTA */}
          <div className="mt-4">
            {addingRole ? (
              <div className="flex gap-2">
                <input
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  placeholder="e.g. Assistant Editor, Stylist..."
                  className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleAddRole()}
                />
                <Button onClick={handleAddRole} size="sm" className="h-10 px-4">
                  Claim
                </Button>
                <Button onClick={() => { setAddingRole(false); setNewRole(""); }} variant="ghost" size="sm" className="h-10 text-muted-foreground">
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setAddingRole(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-white/15 text-xs font-semibold text-white/70 hover:border-[hsl(var(--energy)/0.5)] hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-3.5 w-3.5" /> Worked on this? Add your role
              </button>
            )}
          </div>

          {/* Share */}
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleShareProduction}
            >
              <Link2 className="h-3.5 w-3.5" /> Share Production Page
            </Button>
            <p className="mt-2 text-[10px] text-muted-foreground max-w-sm mx-auto">
              Shares use kretopia.com and invite collaborators to search their name, claim their credit, or verify yours.
            </p>
          </div>
        </div>
      </div>

      <AuthPrompt open={authOpen} onOpenChange={setAuthOpen} action="claim this credit" />
      {endorseCredit && user && (
        <CreditEndorsementDialog
          open={!!endorseCredit}
          onOpenChange={(o) => !o && setEndorseCredit(null)}
          credit={endorseCredit}
          userId={user.id}
        />
      )}
    </>
  );
};

export default ProductionPage;
