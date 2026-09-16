import { useEffect, useState, useCallback } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { extractThumbnailForStorage } from "@/lib/thumbnailExtractor";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ShieldCheck, MapPin, CalendarDays, Building2,
  ExternalLink, Users, UserPlus, Film, Loader2, Globe,
  CheckCircle2, Sparkles, Database, Link2,
} from "lucide-react";
import { getShareUrl } from "@/lib/constants";

interface ProjectRole {
  id: string;
  role_title: string;
  person_name: string | null;
  is_claimed: boolean;
  claimed_by: string | null;
  profile?: { full_name: string; avatar_url: string | null; role: string | null } | null;
}

interface ProjectData {
  id: string;
  title: string;
  type: string;
  category: string | null;
  year: number | null;
  description: string | null;
  platform: string | null;
  location: string | null;
  client_brand: string | null;
  external_url: string | null;
  metadata: any;
  is_verified: boolean;
  created_at: string;
}

const ICDBProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id || null));
  }, []);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data: proj, error } = await supabase
        .from("icdb_projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error || !proj) {
        navigate("/credits");
        return;
      }
      setProject(proj as ProjectData);

      // Fetch roles
      const { data: rolesData } = await supabase
        .from("icdb_project_roles")
        .select("id, role_title, person_name, is_claimed, claimed_by")
        .eq("project_id", projectId)
        .order("role_title");

      // Batch fetch profiles for claimed roles
      const claimedIds = (rolesData || []).filter(r => r.claimed_by).map(r => r.claimed_by!);
      let profileMap = new Map<string, any>();
      if (claimedIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role")
          .in("user_id", claimedIds);
        profiles?.forEach(p => profileMap.set(p.user_id, p));
      }

      setRoles((rolesData || []).map(r => ({
        ...r,
        profile: r.claimed_by ? profileMap.get(r.claimed_by) || null : null,
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleClaim = async (role: ProjectRole) => {
    if (!currentUserId) {
      navigate("/auth");
      return;
    }
    setClaiming(role.id);
    try {
      const extractedThumb = extractThumbnailForStorage(project!.external_url || null);
      const { error } = await supabase.rpc("claim_icdb_role", { p_role_id: role.id, p_thumbnail_url: extractedThumb });
      if (error) throw error;
      toast.success("Credit claimed! It's pending review before it shows as verified.");
      fetchProject();
    } catch {
      toast.error("Failed to claim");
    } finally {
      setClaiming(null);
    }
  };

  const formatType = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  // Group roles by role_title prefix (e.g. "Director" roles together)
  const allRoles = roles;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!project) return null;

  const claimedCount = roles.filter(r => r.is_claimed).length;

  return (
    <>
      <Helmet>
        <title>{project.title}{project.year ? ` (${project.year})` : ""} — Verified Credits | Kretopia</title>
        <meta name="description" content={project.description || `${project.title} — ${formatType(project.type)}${project.year ? `, ${project.year}` : ""}. Full verified credits on Kretopia.`} />
        <link rel="canonical" href={`https://www.kretopia.com/credits/project/${project.id}`} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://www.kretopia.com/credits/project/${project.id}`} />
        <meta property="og:title" content={`${project.title} — Verified Credits`} />
        <meta property="og:description" content={project.description || `${formatType(project.type)}${project.year ? ` · ${project.year}` : ""}${project.client_brand ? ` · ${project.client_brand}` : ""}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: project.title,
          datePublished: project.year ? String(project.year) : undefined,
          genre: formatType(project.type),
          contentLocation: project.location || undefined,
          publisher: project.client_brand || project.platform || undefined,
          url: `https://www.kretopia.com/credits/project/${project.id}`,
          description: project.description || undefined,
          contributor: roles.map(r => ({
            "@type": "Person",
            name: r.is_claimed && r.profile ? r.profile.full_name : (r.person_name || "Unknown"),
            jobTitle: r.role_title,
            url: r.is_claimed && r.claimed_by ? `https://www.kretopia.com/profile/${r.claimed_by}` : undefined,
          })),
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/8 to-background border-b">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" size="sm" className="mb-3 -ml-2 gap-1 text-muted-foreground" onClick={() => navigate("/credits")}>
              <ArrowLeft className="h-4 w-4" /> Kretopia Credits
            </Button>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
                    {project.is_verified && (
                      <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] gap-0.5">
                        <ShieldCheck className="h-2.5 w-2.5" /> Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[11px]">{formatType(project.type)}</Badge>
                {project.year && (
                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {project.year}</span>
                )}
                {project.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {project.location}</span>
                )}
                {project.client_brand && (
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {project.client_brand}</span>
                )}
                {project.platform && (
                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {project.platform}</span>
                )}
              </div>

              {project.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
              )}

              {project.external_url && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                  <a href={project.external_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> View on {project.platform || "Web"}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="border-b">
          <div className="container mx-auto px-4 py-3 flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="font-bold text-lg">{roles.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Credits</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="text-center">
              <p className="font-bold text-lg text-green-600">{claimedCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Claimed</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="text-center">
              <p className="font-bold text-lg">{roles.length - claimedCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unclaimed</p>
            </div>
          </div>
        </div>

        {/* Credits / Roles */}
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Full Credits</h2>
          </div>

          <div className="space-y-1.5">
              {allRoles.map(role => (
                    <div
                      key={role.id}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3 rounded-lg transition-colors",
                        role.is_claimed ? "bg-green-500/5 border border-green-500/15" : "bg-muted/40 hover:bg-muted/60"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {role.is_claimed && role.profile ? (
                          <Avatar
                            className="h-9 w-9 shrink-0 cursor-pointer ring-2 ring-green-500/30"
                            onClick={() => navigate(`/profile/${role.claimed_by}`)}
                          >
                            <AvatarImage src={role.profile.avatar_url || ""} />
                            <AvatarFallback className="text-xs bg-green-500/10">{role.profile.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-xs bg-muted">{role.person_name?.[0] || "?"}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={cn("text-sm font-medium truncate", role.is_claimed && "cursor-pointer hover:underline")}
                              onClick={() => role.claimed_by && navigate(`/profile/${role.claimed_by}`)}>
                              {role.is_claimed && role.profile ? role.profile.full_name : role.person_name || "Unknown"}
                            </p>
                            {role.is_claimed && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{role.role_title}</p>
                        </div>
                      </div>

                      {!role.is_claimed && currentUserId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] gap-1 shrink-0"
                          disabled={claiming === role.id}
                          onClick={() => handleClaim(role)}
                        >
                          {claiming === role.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                          Claim
                        </Button>
                      )}
                      {!role.is_claimed && !currentUserId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] gap-1 shrink-0"
                          onClick={() => navigate(`/auth?redirect=/credits/project/${projectId}`)}
                        >
                          <UserPlus className="h-3 w-3" /> Claim
                        </Button>
                      )}
                    </div>
                  ))}
          </div>

          {!currentUserId && roles.some(r => !r.is_claimed) && (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
              <p className="text-sm font-semibold mb-1">Is your name on this project?</p>
              <p className="text-xs text-muted-foreground mb-3">Sign up free, claim your role, and add it to your Creative Passport in 30 seconds.</p>
              <Button size="sm" onClick={() => navigate(`/auth?redirect=/credits/project/${projectId}`)}>
                Create your Passport
              </Button>
            </div>
          )}

          {/* Share / Copy link */}
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied!");
              }}
            >
              <Link2 className="h-3.5 w-3.5" /> Share Project Page
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ICDBProjectPage;
