import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { FileText, Image as ImageIcon, Film, Music, Link2, File as FileIcon, Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StudioEmptyState, StudioErrorState } from "@/components/studio-reference/StudioEmptyState";
import { moodAccent, monogram, type StudioProject } from "./studioCardHelpers";

interface LibraryFile {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  is_link: boolean;
  link_provider: string | null;
  created_at: string | null;
}

const iconFor = (f: LibraryFile) => {
  if (f.is_link) return Link2;
  const t = (f.file_type || "").toLowerCase();
  if (t.startsWith("image/")) return ImageIcon;
  if (t.startsWith("video/")) return Film;
  if (t.startsWith("audio/")) return Music;
  if (t.includes("pdf") || t.includes("doc") || t.includes("text")) return FileText;
  return FileIcon;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface StudioLibraryTabProps {
  /** Already-fetched Studio projects (same list the Work tab renders) —
   *  reused here purely to label/link each file back to its Project and
   *  to give the card the same monogram/mood accent as everywhere else
   *  in Studio, without a second projects query. */
  projects: StudioProject[];
}

/**
 * Library — a read-only, cross-Project view over every file already
 * living in project_files. Not a new entity or a new upload surface:
 * Vault/FileBrowser (per-Project) remain the source of truth and the
 * only place files are added, renamed or deleted. This tab is a
 * "everything I've dropped, across every Project, most recent first"
 * lens on that same data, per the Studio Blueprint's Library concept
 * (R16) scoped to what the schema already tracks — no owner/source/
 * sharing-scope fields exist yet, so those are deliberately not shown.
 */
export const StudioLibraryTab = ({ projects }: StudioLibraryTabProps) => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectById = new Map(projects.map((p) => [p.id, p]));

  const load = () => {
    const ids = projects.map((p) => p.id);
    if (ids.length === 0) {
      setFiles([]);
      return;
    }
    setError(null);
    setFiles(null);
    supabase
      .from("project_files")
      .select("id, project_id, file_name, file_url, file_type, file_size, is_link, link_provider, created_at")
      .in("project_id", ids)
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message || "Couldn't load Library");
          return;
        }
        setFiles((data as LibraryFile[]) || []);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [projects.map((p) => p.id).join(",")]);

  if (error) {
    return <StudioErrorState description={error} onRetry={load} />;
  }

  if (files === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <StudioEmptyState
        icon={<Library className="h-6 w-6" />}
        title="Nothing dropped yet"
        description="Files, links and references you add inside a Project's Vault show up here across every Project, most recent first."
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {files.map((f) => {
        const project = projectById.get(f.project_id);
        const Icon = iconFor(f);
        const size = formatSize(f.file_size);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => navigate(`/desk/${f.project_id}?tab=files`)}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-card/70"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{f.file_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {project && (
                  <span className="inline-flex items-center gap-1 mr-1.5">
                    <span
                      className="inline-grid h-3.5 w-3.5 place-items-center rounded-full text-[7px] font-bold text-white"
                      style={{ backgroundColor: moodAccent(project.mood) }}
                    >
                      {monogram(project.title)}
                    </span>
                    {project.title}
                  </span>
                )}
                {f.created_at && (
                  <span>· {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</span>
                )}
                {size && <span> · {size}</span>}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StudioLibraryTab;
