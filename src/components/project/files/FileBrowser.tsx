import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeskIntent } from "@/hooks/useDeskIntent";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  FolderPlus,
  Folder,
  ChevronRight,
  Grid3x3,
  List as ListIcon,
  MoreVertical,
  Download,
  Trash2,
  Pencil,
  Home,
  Loader2,
  Search,
  Link2,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { extractProjectFilePath, getProjectFileSignedUrl } from "@/lib/projectFiles";
import { FileThumbnail } from "./FileThumbnail";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { ImportLinkDialog } from "./ImportLinkDialog";
import { Badge } from "@/components/ui/badge";
import { FileCommentsSheet } from "@/components/project/studio/FileCommentsSheet";
import { ResumableUploadList, type UploadJob } from "./ResumableUploadList";
import { useFileSizeLimit } from "@/hooks/useFileSizeLimit";
import { formatBytes } from "@/lib/fileSizeLimits";
import { QuotaExceededDialog, deriveQuotaReason, type QuotaBlockReason } from "@/components/storage/QuotaExceededDialog";
import { cn } from "@/lib/utils";

interface ProjectFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
  user_id: string;
  folder_id?: string | null;
  is_link?: boolean | null;
  link_provider?: string | null;
  link_thumbnail_url?: string | null;
}

interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  project_id: string;
  created_at: string;
}

interface FileBrowserProps {
  projectId: string;
  files: ProjectFile[];
  onFileUploaded: () => void;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const FileBrowser = ({ projectId, files, onFileUploaded }: FileBrowserProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sizeLimit = useFileSizeLimit();
  const [view, setView] = useState<"grid" | "list">(() =>
    (localStorage.getItem("td_files_view") as "grid" | "list") || "grid"
  );
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [commentFile, setCommentFile] = useState<ProjectFile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [quotaBlock, setQuotaBlock] = useState<QuotaBlockReason | null>(null);
  const [importLinkOpen, setImportLinkOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    }).catch(() => {});
  }, []);

  // Route file clicks: links → open in new tab; media + images → comments sheet
  // (timestamps + notes); everything else → standard preview dialog.
  const openFile = useCallback((file: ProjectFile) => {
    if (file.is_link) {
      window.open(file.file_url, "_blank", "noopener,noreferrer");
      return;
    }
    const t = file.file_type || "";
    if (t.startsWith("video/") || t.startsWith("audio/") || t.startsWith("image/")) {
      setCommentFile(file);
    } else {
      setPreviewFile(file);
    }
  }, []);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    localStorage.setItem("td_files_view", view);
  }, [view]);

  // Intent listener: NextStepBar / AI / chat → trigger upload or new folder
  useDeskIntent("files", useCallback((intent) => {
    if (intent === "upload-file") fileInputRef.current?.click();
    if (intent === "new-folder") setNewFolderOpen(true);
  }, []));

  const fetchFolders = async () => {
    const { data } = await supabase
      .from("project_file_folders")
      .select("*")
      .eq("project_id", projectId)
      .order("name");
    setFolders((data as FolderRow[]) || []);
  };

  useEffect(() => {
    fetchFolders();
    const channel = supabase
      .channel(`folders:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_file_folders", filter: `project_id=eq.${projectId}` },
        fetchFolders
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Build breadcrumb trail
  const breadcrumb = useMemo(() => {
    const trail: FolderRow[] = [];
    let cur = currentFolder;
    while (cur) {
      const f = folders.find((x) => x.id === cur);
      if (!f) break;
      trail.unshift(f);
      cur = f.parent_id;
    }
    return trail;
  }, [currentFolder, folders]);

  const visibleFolders = folders.filter((f) => f.parent_id === currentFolder);
  const visibleFiles = files.filter((f) => (f.folder_id ?? null) === currentFolder);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return { folders: visibleFolders, files: visibleFiles };
    return {
      folders: visibleFolders.filter((f) => f.name.toLowerCase().includes(s)),
      files: visibleFiles.filter((f) => f.file_name.toLowerCase().includes(s)),
    };
  }, [search, visibleFolders, visibleFiles]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list?.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }

    const accepted: UploadJob[] = [];
    let runningRemaining = sizeLimit.quota?.remaining;
    for (const file of Array.from(list)) {
      const reason = deriveQuotaReason({ name: file.name, size: file.size }, sizeLimit.limit, runningRemaining);
      if (reason) {
        setQuotaBlock(reason);
        continue;
      }
      if (runningRemaining !== undefined) runningRemaining -= file.size;
      const nameParts = file.name.split(".");
      const rawExt = nameParts.length > 1 ? nameParts.pop() : "bin";
      const ext = (rawExt || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
      const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const folderAtEnqueue = currentFolder;
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        bucket: "project-files",
        path,
        onComplete: async () => {
          const { data: inserted, error: dbErr } = await supabase
            .from("project_files")
            .insert({
              project_id: projectId,
              user_id: user.id,
              file_name: file.name,
              file_url: path,
              file_size: file.size,
              file_type: file.type,
              folder_id: folderAtEnqueue,
            })
            .select("id")
            .single();
          if (dbErr) throw new Error(dbErr.message);
          // If the user dropped the file at the Vault root (no folder), let AI sort it.
          if (!folderAtEnqueue && inserted?.id) {
            supabase.functions
              .invoke("route-vault-file", {
                body: { project_id: projectId, file_id: inserted.id },
              })
              .catch((e) => console.warn("route-vault-file failed (non-fatal)", e));
          }
          onFileUploaded();
        },
      });
    }
    if (accepted.length > 0) {
      setUploadJobs((prev) => [...prev, ...accepted]);
      setUploading(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleJobFinished = useCallback((_id: string) => {
    // Keep finished cards visible briefly so users see "Done"; auto-clear after 4s.
    setTimeout(() => {
      setUploadJobs((prev) => {
        const next = prev.filter((j) => j.id !== _id);
        if (next.length === 0) setUploading(false);
        return next;
      });
    }, 4000);
  }, []);

  const handleJobRemoved = useCallback((id: string) => {
    setUploadJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      if (next.length === 0) setUploading(false);
      return next;
    });
  }, []);


  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("project_file_folders").insert({
      project_id: projectId,
      parent_id: currentFolder,
      name,
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    setNewFolderName("");
    setNewFolderOpen(false);
    fetchFolders();
  };

  const deleteFolder = async (folder: FolderRow) => {
    if (!confirm(`Delete folder "${folder.name}"? Files inside will move to the parent folder.`)) return;
    // Move files out
    await supabase.from("project_files").update({ folder_id: folder.parent_id }).eq("folder_id", folder.id);
    // Move subfolders out
    await supabase.from("project_file_folders").update({ parent_id: folder.parent_id }).eq("parent_id", folder.id);
    const { error } = await supabase.from("project_file_folders").delete().eq("id", folder.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { fetchFolders(); onFileUploaded(); }
  };

  const renameFolder = async (id: string, name: string) => {
    const { error } = await supabase.from("project_file_folders").update({ name }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    fetchFolders();
  };

  const renameFile = async (id: string, name: string) => {
    const { error } = await supabase.from("project_files").update({ file_name: name }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    onFileUploaded();
  };

  const moveFile = async (fileId: string, folderId: string | null) => {
    const { error } = await supabase.from("project_files").update({ folder_id: folderId }).eq("id", fileId);
    if (error) toast({ title: "Move failed", description: error.message, variant: "destructive" });
    else onFileUploaded();
  };

  const deleteFile = async (file: ProjectFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return;
    try {
      if (!file.is_link) {
        const path = extractProjectFilePath(file.file_url);
        await supabase.storage.from("project-files").remove([path]);
      }
      const { error } = await supabase.from("project_files").delete().eq("id", file.id);
      if (error) throw error;
      onFileUploaded();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const downloadFile = async (file: ProjectFile) => {
    const url = await getProjectFileSignedUrl(file.file_url, { expiresIn: 3600, download: file.file_name });
    if (url) window.location.href = url;
    else toast({ title: "Download failed", variant: "destructive" });
  };

  // Drag and drop
  const [dragOverFolder, setDragOverFolder] = useState<string | null | "ROOT">(null);
  const onDragStartFile = (e: React.DragEvent, fileId: string) => {
    e.dataTransfer.setData("application/x-file-id", fileId);
  };
  const onDropFolder = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolder(null);
    const fileId = e.dataTransfer.getData("application/x-file-id");
    if (fileId) moveFile(fileId, folderId);
  };

  const startRename = (type: "folder" | "file", id: string, name: string) => {
    setRenameTarget({ type, id, name });
    setRenameValue(name);
  };
  const submitRename = async () => {
    if (!renameTarget) return;
    const v = renameValue.trim();
    if (!v) return;
    if (renameTarget.type === "folder") await renameFolder(renameTarget.id, v);
    else await renameFile(renameTarget.id, v);
    setRenameTarget(null);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-x-auto">
          <button
            onClick={() => setCurrentFolder(null)}
            onDragOver={(e) => { e.preventDefault(); setDragOverFolder("ROOT"); }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={(e) => onDropFolder(e, null)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded hover:bg-muted shrink-0",
              dragOverFolder === "ROOT" && "bg-primary/10 ring-1 ring-primary"
            )}
          >
            <Home className="h-3.5 w-3.5" /> Files
          </button>
          {breadcrumb.map((f) => (
            <div key={f.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button onClick={() => setCurrentFolder(f.id)} className="px-2 py-1 rounded hover:bg-muted truncate max-w-[140px]">
                {f.name}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 h-9 w-[140px] sm:w-[180px]"
            />
          </div>
          <div className="flex items-center bg-muted rounded-md p-0.5">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New folder</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportLinkOpen(true)}>
            <Link2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Import link</span>
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Tier hint + active uploads */}
      {uploadJobs.length > 0 ? (
        <ResumableUploadList
          jobs={uploadJobs}
          onJobFinished={handleJobFinished}
          onJobRemoved={handleJobRemoved}
        />
      ) : (
        <p className="text-[11px] text-muted-foreground px-1">
          Up to <strong className="text-foreground">{formatBytes(sizeLimit.limit)}</strong> per file on {sizeLimit.tierLabel}. Big uploads pause &amp; resume automatically.
        </p>
      )}

      <QuotaExceededDialog
        open={!!quotaBlock}
        onOpenChange={(o) => { if (!o) setQuotaBlock(null); }}
        reason={quotaBlock}
      />

      {filtered.folders.length === 0 && filtered.files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-xl">
          <Folder className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">This folder is empty</p>
          <p className="text-sm text-muted-foreground mb-4">Upload files, paste a link, or create a folder to organize your work.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-2" /> New folder
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportLinkOpen(true)}>
              <Link2 className="h-4 w-4 mr-2" /> Import link
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Upload
            </Button>
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.folders.map((f) => (
            <button
              key={f.id}
              onDoubleClick={() => setCurrentFolder(f.id)}
              onClick={() => setCurrentFolder(f.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverFolder(f.id); }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => onDropFolder(e, f.id)}
              className={cn(
                "group relative aspect-square flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors p-3 text-center",
                dragOverFolder === f.id && "bg-primary/10 ring-2 ring-primary"
              )}
            >
              <Folder className="h-10 w-10 text-primary fill-primary/20" />
              <span className="text-xs font-medium truncate w-full">{f.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => startRename("folder", f.id, f.name)}>
                    <Pencil className="h-4 w-4 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => deleteFolder(f)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </button>
          ))}
          {filtered.files.map((file) => (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => onDragStartFile(e, file.id)}
              onClick={() => openFile(file)}
              className="group relative aspect-square rounded-xl border border-border bg-card overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
            >
              {file.is_link && file.link_thumbnail_url ? (
                <img src={file.link_thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover" />
              ) : file.is_link ? (
                <div className="w-full h-full flex items-center justify-center bg-muted/40">
                  <Link2 className="h-8 w-8 text-muted-foreground" />
                </div>
              ) : (
                <FileThumbnail fileUrl={file.file_url} fileType={file.file_type} className="w-full h-full" />
              )}
              {file.is_link && (
                <Badge variant="secondary" className="absolute top-1 left-1 text-[9px] gap-0.5 px-1.5 py-0 h-5 rounded-full">
                  <ExternalLink className="h-2.5 w-2.5" />
                  {file.link_provider || "Link"}
                </Badge>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                <p className="text-[11px] font-medium text-white truncate">{file.file_name}</p>
                <p className="text-[10px] text-white/70">{file.is_link ? (file.link_provider || "Link") : formatSize(file.file_size)}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-1 right-1 p-1 rounded bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {file.is_link ? (
                    <DropdownMenuItem onClick={() => window.open(file.file_url, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Open link
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => downloadFile(file)}>
                      <Download className="h-4 w-4 mr-2" /> Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => startRename("file", file.id, file.file_name)}>
                    <Pencil className="h-4 w-4 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => deleteFile(file)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
          {filtered.folders.map((f) => (
            <div
              key={f.id}
              onClick={() => setCurrentFolder(f.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverFolder(f.id); }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => onDropFolder(e, f.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer",
                dragOverFolder === f.id && "bg-primary/10"
              )}
            >
              <Folder className="h-5 w-5 text-primary fill-primary/20 shrink-0" />
              <span className="font-medium text-sm flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">Folder</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => startRename("folder", f.id, f.name)}>
                    <Pencil className="h-4 w-4 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => deleteFolder(f)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {filtered.files.map((file) => (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => onDragStartFile(e, file.id)}
              onClick={() => openFile(file)}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer"
            >
              <div className="w-10 h-10 rounded overflow-hidden shrink-0 relative">
                {file.is_link && file.link_thumbnail_url ? (
                  <img src={file.link_thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : file.is_link ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted/40">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <FileThumbnail fileUrl={file.file_url} fileType={file.file_type} className="w-full h-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {file.file_name}
                  {file.is_link && (
                    <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 py-0 h-4 rounded-full shrink-0">
                      <ExternalLink className="h-2.5 w-2.5" />
                      {file.link_provider || "Link"}
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {file.is_link
                    ? `${file.link_provider || "Link"} • ${formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}`
                    : `${formatSize(file.file_size)} • ${formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}`}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {file.is_link ? (
                    <DropdownMenuItem onClick={() => window.open(file.file_url, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Open link
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => downloadFile(file)}>
                      <Download className="h-4 w-4 mr-2" /> Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => startRename("file", file.id, file.file_name)}>
                    <Pencil className="h-4 w-4 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => deleteFile(file)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />

      <ImportLinkDialog
        open={importLinkOpen}
        onOpenChange={setImportLinkOpen}
        projectId={projectId}
        folderId={currentFolder}
        onImported={onFileUploaded}
      />

      <FileCommentsSheet
        open={!!commentFile}
        onOpenChange={(v) => !v && setCommentFile(null)}
        file={commentFile}
        currentUserId={currentUserId}
      />

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
            placeholder="Folder name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={createFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.type}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={submitRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
