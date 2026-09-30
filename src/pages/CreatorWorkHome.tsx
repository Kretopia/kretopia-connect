import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useStudioGlobalModals } from "@/components/project/studio/useStudioGlobalModals";
import { StudioProjectsDashboard } from "@/components/project/studio/StudioProjectsDashboard";
import { StudioCreateHero } from "@/components/project/studio/StudioCreateHero";
import type { StudioFolder } from "@/components/project/studio/studioHome.types";
import { StudioPulse } from "@/components/project/studio/StudioPulse";
import { PageTransition } from "@/components/PageTransition";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoTip } from "@/components/agent/KretoTip";
import { STUDIO_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { PROJECT_COLUMNS_EXCLUDING_LOCKED_FINANCIALS } from "@/lib/projectColumns";
import { WorkHomeSkeleton } from "@/pages/WorkHomeSkeleton";
import { TodayStrip } from "@/components/desk/TodayStrip";
import { StudioSectionTabs } from "@/components/studio-reference/StudioSectionTabs";

interface ProjectPersonRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  collaborator_status: string | null;
}

/**
 * Individual creator's Studio-first dashboard — voice-first project
 * creation, folders, and the Projects grid/dashboard below. Split out of
 * the former monolithic WorkHome.tsx (which mixed this with the Brand
 * dashboard and the account-type router in one 700-line file) so each
 * account-type variant is its own navigable, independently testable
 * file, per the Studio-home scalability pass.
 */
export const CreatorWorkHome = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [invoicesByProject, setInvoicesByProject] = useState<
    Record<string, "paid" | "invoiced" | "unsent">
  >({});
  // Per-project role check for the dashboard's money signals (pay dot,
  // "needs an invoice" tile, etc). This list mixes Projects the viewer
  // owns with ones they're only a collaborator/client/guest on, so a
  // single global flag can't gate it correctly -- see
  // STUDIO_ROLE_VISIBILITY_REPORT.md.
  const [moneyVisibleByProject, setMoneyVisibleByProject] = useState<Record<string, boolean>>({});
  const [folders, setFolders] = useState<StudioFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [recentCollaborators, setRecentCollaborators] = useState<
    { id: string; full_name: string; avatar_url: string | null; role: string | null }[]
  >([]);
  // Per-project accepted-collaborator count for the Holo Cards' "N people"
  // line. A single tally query over every visible project id -- same shape
  // as invoicesByProject just above -- rather than one RPC call per card.
  const [participantsByProject, setParticipantsByProject] = useState<Record<string, number>>({});

  const fetchFolders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("studio_folders")
      .select("id, name, color, sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setFolders((data as StudioFolder[]) || []);
  };

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Unbounded select on the Studio dashboard's own primary list --
      // every project on every load. Capped generously (a payload-size
      // backstop, not real-world pagination) rather than left unbounded.
      // Explicit column list, not "*": client_price/creative_payout/
      // margin_type/margin_value are permanently locked down and a
      // wildcard select fails the whole query with 42501 for every
      // caller -- see src/lib/projectColumns.ts.
      const { data: projectsData } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS_EXCLUDING_LOCKED_FINANCIALS)
        .order("updated_at", { ascending: false })
        .limit(200);
      const list = projectsData || [];
      setProjects(list);

      if (list.length) {
        const ids = list.map((p) => p.id);
        const { data: invs } = await (supabase as any)
          .from("invoices")
          .select("project_id, status")
          .in("project_id", ids);
        const map: Record<string, "paid" | "invoiced" | "unsent"> = {};
        for (const id of ids) map[id] = "unsent";
        for (const row of invs || []) {
          const cur = map[row.project_id];
          if (row.status === "paid") map[row.project_id] = "paid";
          else if (cur !== "paid") map[row.project_id] = "invoiced";
        }
        setInvoicesByProject(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const { modals, openCreateProject, openVoiceCommand, openPalette, openWrapWeek } =
    useStudioGlobalModals({ onProjectCreated: fetchProjects });

  useEffect(() => {
    fetchProjects().catch(() => setLoading(false));
    fetchFolders().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Recent collaborators across the user's most recently active projects.
  // Reuses the existing get_project_people RPC (same one useProjectData
  // calls for a single project) rather than adding a new aggregate query
  // or RPC -- just runs it over a few projects and dedupes client-side.
  useEffect(() => {
    if (!user || projects.length === 0) return;
    let cancelled = false;
    (async () => {
      const topProjects = projects.slice(0, 5);
      const results = await Promise.all(
        topProjects.map((p) =>
          supabase
            .rpc("get_project_people" as any, { _project_id: p.id })
            .then(
              ({ data }) => (data ?? []) as ProjectPersonRow[],
              () => [] as ProjectPersonRow[]
            )
        )
      );
      if (cancelled) return;
      const seen = new Set<string>();
      const people: { id: string; full_name: string; avatar_url: string | null; role: string | null }[] = [];
      for (const rows of results) {
        for (const p of rows) {
          if (p.collaborator_status !== "accepted") continue;
          if (p.user_id === user.id) continue;
          if (seen.has(p.user_id)) continue;
          seen.add(p.user_id);
          people.push({ id: p.user_id, full_name: p.full_name || "Member", avatar_url: p.avatar_url, role: p.role });
        }
      }
      setRecentCollaborators(people.slice(0, 10));
    })();
    return () => { cancelled = true; };
  }, [user, projects]);

  // Per-project money visibility. Owner rows are known locally (no RPC
  // needed); everything else goes through can_see_milestone_money, the
  // same role check the single-Project page (useProjectData) already
  // relies on -- owner/creative/collaborator see money, client/guest don't.
  useEffect(() => {
    if (!user || projects.length === 0) return;
    let cancelled = false;
    (async () => {
      const owned: Record<string, boolean> = {};
      const toCheck = projects.filter((p) => {
        if (p.created_by === user.id) { owned[p.id] = true; return false; }
        return true;
      }).slice(0, 100);
      const results = await Promise.all(
        toCheck.map((p) =>
          supabase
            .rpc("can_see_milestone_money" as any, { _project_id: p.id, _user_id: user.id })
            .then(({ data }) => [p.id, !!data] as const, () => [p.id, false] as const)
        )
      );
      if (cancelled) return;
      const checked = Object.fromEntries(results);
      setMoneyVisibleByProject({ ...owned, ...checked });
    })();
    return () => { cancelled = true; };
  }, [user, projects]);

  useEffect(() => {
    if (!user || projects.length === 0) return;
    let cancelled = false;
    (async () => {
      const ids = projects.map((p) => p.id);
      const { data } = await supabase
        .from("project_collaborators")
        .select("project_id")
        .in("project_id", ids)
        .eq("status", "accepted");
      if (cancelled) return;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.project_id] = (counts[row.project_id] ?? 0) + 1;
      }
      setParticipantsByProject(counts);
    })();
    return () => { cancelled = true; };
  }, [user, projects]);

  if (loading) {
    return <WorkHomeSkeleton variant="studio" />;
  }

  const activeProjects = projects.filter(p => p.status === "active");

  const visibleProjects = projects.filter((p) => {
    if (folderFilter === "all") return true;
    if (folderFilter === "unfiled") return !(p as any).studio_folder_id;
    return (p as any).studio_folder_id === folderFilter;
  });

  const moveProject = async (projectId: string, folderId: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("projects")
      .update({ studio_folder_id: folderId })
      .eq("id", projectId)
      .eq("created_by", user.id);
    if (error) {
      toast.error(error.message || "Couldn't move project");
      return;
    }
    const folderName = folderId
      ? (folders.find(f => f.id === folderId)?.name ?? "folder")
      : "Unfiled";
    toast.success(`Moved to ${folderName}`);
    fetchProjects();
  };


  return (
    <PageTransition>
      <Helmet>
        <title>Studio | Kretopia</title>
        <meta name="description" content="Studio — start a Project by voice or text, keep the work in one place, and wrap with credits and an invoice." />
      </Helmet>

      <FeaturePageHeader
        eyebrow="Studio"
        title="Start with what"
        accentTitle="you're making."
        subtitle="Kreto turns it into a working Project. The work happens in one place, and your credits and invoice are ready when it wraps."
        tutorial={{ featureKey: "studio", label: "How Studio works", steps: STUDIO_TUTORIAL }}
      />

      {/* Wider on desktop, capped for readability */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-8 md:pb-10 space-y-5">
        <KretoTip compact />

        {/* Creation-first hero — the promise, then one dominant CTA using
            the canonical Landing Page CTA implementation. */}
        <StudioCreateHero
          onCreate={openCreateProject}
          onVoice={openCreateProject}
          projectCount={projects.length}
          activeCount={activeProjects.length}
        />

        {/* What's happening now, who's involved, what needs attention --
            immediately below the header/create hero, above Folders and
            Projects, per the Studio home overhaul. Replaces the previous
            separately-stacked "Session & Activity" and "Casting &
            Collaborators" SectionCards. */}
        <StudioPulse
          recentCollaborators={recentCollaborators}
          folderCount={folders.length}
          projectCount={projects.length}
          folderControls={folders.length > 0 ? (
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger aria-label="Filter projects by folder" className="h-8 w-36 shrink-0 text-xs sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value="unfiled">Unfiled</SelectItem>
                {folders.map((folder) => <SelectItem value={folder.id} key={folder.id}>{folder.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : undefined}
          onVoice={openVoiceCommand}
          onCommandPalette={openPalette}
          onWrapWeek={openWrapWeek}
        />

        <StudioProjectsDashboard
              projects={visibleProjects as any}
              invoicesByProject={invoicesByProject}
              moneyVisibleByProject={moneyVisibleByProject}
              participantsByProject={participantsByProject}
              onCreate={openCreateProject}
              folders={folders}
              onMoveToFolder={moveProject}
            />
      </div>

      {modals}
    </PageTransition>
  );
};

export default CreatorWorkHome;
