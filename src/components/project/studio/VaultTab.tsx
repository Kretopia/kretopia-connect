import { useEffect, useState } from "react";
import { FolderLock, ShieldCheck, Lightbulb, ChevronDown, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FileBrowser } from "@/components/project/files/FileBrowser";
import { WorkflowShell } from "@/components/project/studio/WorkflowShell";
import { SmartBriefBuilder } from "@/components/project/SmartBriefBuilder";
import { ShareReviewLinkDialog } from "@/components/project/studio/ShareReviewLinkDialog";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const STANDARD_FOLDERS = [
  "Brief & References",
  "Work-in-Progress",
  "Final Deliverables",
  "Client-Shared",
];

interface VaultTabProps {
  projectId: string;
  projectTitle?: string;
  files: any[];
  currentUserId: string;
  onFileUploaded: () => void;
  onJumpToBrief?: () => void;
}

/**
 * The Vault — Studio-styled wrapper.
 * - Houses Smart Brief at the top (collapsible) so client/collab scope lives
 *   alongside the reference files it spawns.
 * - Auto-bootstraps the four standard folders.
 * - Inline-Drop approvals still live on each Drop card in the Studio feed.
 */
export function VaultTab({
  projectId,
  projectTitle = "this project",
  files,
  currentUserId,
  onFileUploaded,
}: VaultTabProps) {
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [briefOpen, setBriefOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Bootstrap standard folders once
  useEffect(() => {
    let cancelled = false;
    const ensureFolders = async () => {
      const { data: existing } = await supabase
        .from("project_file_folders")
        .select("name")
        .eq("project_id", projectId)
        .is("parent_id", null);

      if (cancelled) return;
      const have = new Set((existing || []).map((f: any) => f.name));
      const missing = STANDARD_FOLDERS.filter((n) => !have.has(n));
      if (missing.length === 0) return;

      await supabase.from("project_file_folders").insert(
        missing.map((name) => ({
          project_id: projectId,
          name,
          parent_id: null,
          created_by: currentUserId,
        })),
      );
    };
    ensureFolders().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, currentUserId]);

  // Pending approval count
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("project_deliverables")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "submitted");
      if (!cancelled) setPendingApprovals(count ?? 0);
    };
    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, files.length]);

  return (
    <WorkflowShell
      eyebrow="The Vault"
      title="Files, Brief & Approvals"
      subtitle="Scope from the client, references, work-in-progress, finals — all in one place."
      icon={FolderLock}
    >
      {/* Smart Brief — collapsible. Pull-down to draft a brief from voice/text;
          outputs land in this Vault as the source of truth. */}
      <Collapsible open={briefOpen} onOpenChange={setBriefOpen} className="mb-4">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-[hsl(var(--energy)/0.06)] via-card to-card overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-[hsl(var(--energy)/0.15)] ring-1 ring-[hsl(var(--energy)/0.35)] flex items-center justify-center shrink-0">
                <Lightbulb className="h-4 w-4 text-[hsl(var(--energy))]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--energy))]">
                  Smart Brief
                </p>
                <p className="text-sm font-semibold truncate">
                  {briefOpen ? "Hide brief composer" : "Capture scope from the client or team"}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${briefOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border p-3">
              <SmartBriefBuilder
                projectId={projectId}
                projectTitle={projectTitle}
                onSent={() => {
                  setBriefOpen(false);
                  onFileUploaded();
                }}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Quick stat strip */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full font-semibold">
          {files.length} file{files.length === 1 ? "" : "s"}
        </Badge>
        {pendingApprovals > 0 && (
          <Badge variant="outline" className="rounded-full gap-1 font-medium">
            <ShieldCheck className="h-3 w-3" />
            {pendingApprovals} awaiting review
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-8 gap-1.5"
          onClick={() => setShareOpen(true)}
        >
          <Link2 className="h-3.5 w-3.5" />
          Share for review
        </Button>
      </div>

      <ShareReviewLinkDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={projectId}
        projectTitle={projectTitle}
      />

      <div className="px-1 mb-3">
        <StorageMeter variant="compact" />
      </div>

      <FileBrowser
        projectId={projectId}
        files={files}
        onFileUploaded={onFileUploaded}
      />
    </WorkflowShell>
  );
}
