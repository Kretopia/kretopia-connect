import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FolderOpen, FolderPlus, Upload, Search, Grid3X3, List, Tag, Image as ImageIcon,
  Film, Music, FileText, File, MoreVertical, ArrowLeft, Download, Trash2, Plus, X
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";
import { EmptyState } from "@/components/ui/empty-state";

interface AssetFolder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
  created_at: string;
}

interface CreativeAsset {
  id: string;
  name: string;
  file_url: string;
  thumbnail_url: string | null;
  file_size: number;
  file_type: string | null;
  media_type: string;
  tags: string[];
  version: number;
  folder_id: string | null;
  uploaded_by: string;
  description: string | null;
  created_at: string;
}

/** file_url is a path in the private `project-files` bucket, not a public
 * URL — every render site needs a fresh signed URL. Resolved once per
 * fetchData() pass and cached by asset id rather than per-render. */
type SignedUrlMap = Record<string, string>;

interface CreativeAssetLibraryProps {
  projectId: string;
  currentUserId: string;
}

export const CreativeAssetLibrary = ({ projectId, currentUserId }: CreativeAssetLibraryProps) => {
  const { toast } = useToast();
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CreativeAsset | null>(null);
  const [newTag, setNewTag] = useState("");
  const [signedUrls, setSignedUrls] = useState<SignedUrlMap>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`assets:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creative_assets', filter: `project_id=eq.${projectId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  const fetchData = async () => {
    const [foldersRes, assetsRes] = await Promise.all([
      supabase.from('asset_folders').select('*').eq('project_id', projectId).order('name'),
      supabase.from('creative_assets').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ]);
    setFolders(foldersRes.data || []);
    const fetchedAssets = (assetsRes.data || []) as CreativeAsset[];
    setAssets(fetchedAssets);
    setLoading(false);

    // file_url is a path in the private `project-files` bucket, not a
    // renderable URL — resolve a signed URL for every asset (thumbnails
    // need it for image/video/audio, "Open file"/Download need it for
    // documents too).
    const resolved = await Promise.all(
      fetchedAssets.map(async (a) => [a.id, await getProjectFileSignedUrl(a.file_url)] as const)
    );
    setSignedUrls(Object.fromEntries(resolved.filter(([, url]) => !!url)) as SignedUrlMap);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const { error } = await supabase.from('asset_folders').insert({
      project_id: projectId,
      name: newFolderName.trim(),
      parent_id: currentFolder,
      created_by: currentUserId,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewFolderName("");
    setShowNewFolder(false);
    fetchData();
  };

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${projectId}/assets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('project-files').upload(path, file);
        if (upErr) throw upErr;

        let mediaType = 'document';
        if (file.type.startsWith('image/')) mediaType = 'image';
        else if (file.type.startsWith('video/')) mediaType = 'video';
        else if (file.type.startsWith('audio/')) mediaType = 'audio';

        const { error } = await supabase.from('creative_assets').insert({
          project_id: projectId,
          folder_id: currentFolder,
          name: file.name,
          file_url: path,
          file_size: file.size,
          file_type: file.type,
          media_type: mediaType,
          uploaded_by: currentUserId,
        });
        if (error) throw error;
      }
      toast({ title: "Uploaded", description: `${files.length} file(s) added` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    const { error } = await supabase.from('creative_assets').delete().eq('id', assetId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { fetchData(); setSelectedAsset(null); }
  };

  const handleAddTag = async (assetId: string) => {
    if (!newTag.trim()) return;
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const updatedTags = [...(asset.tags || []), newTag.trim()];
    const { error } = await supabase.from('creative_assets').update({ tags: updatedTags }).eq('id', assetId);
    if (!error) { setNewTag(""); fetchData(); }
  };

  const handleRemoveTag = async (assetId: string, tag: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const updatedTags = (asset.tags || []).filter(t => t !== tag);
    await supabase.from('creative_assets').update({ tags: updatedTags }).eq('id', assetId);
    fetchData();
  };

  const getMediaIcon = (mediaType: string) => {
    if (mediaType === 'image') return <ImageIcon className="h-8 w-8" />;
    if (mediaType === 'video') return <Film className="h-8 w-8" />;
    if (mediaType === 'audio') return <Music className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Filter
  const currentFolders = folders.filter(f => f.parent_id === currentFolder);
  const currentAssets = assets.filter(a => {
    const inFolder = a.folder_id === currentFolder;
    const matchesSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return searchQuery ? matchesSearch : inFolder;
  });

  const breadcrumb = (() => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: "All Assets" }];
    let fid = currentFolder;
    const path: typeof crumbs = [];
    while (fid) {
      const f = folders.find(ff => ff.id === fid);
      if (f) { path.unshift({ id: f.id, name: f.name }); fid = f.parent_id; }
      else break;
    }
    return [...crumbs, ...path];
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Asset Library
          <span className="text-sm font-normal text-muted-foreground">({assets.length} files)</span>
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewFolder(true)}>
            <FolderPlus className="h-4 w-4 mr-1" /> Folder
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading..." : "Upload"}
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => e.target.files && handleUpload(e.target.files)} />
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files, tags..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')}>
          <Grid3X3 className="h-4 w-4" />
        </Button>
        <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')}>
          <List className="h-4 w-4" />
        </Button>
      </div>

      {/* New folder inline */}
      {showNewFolder && (
        <div className="flex gap-2">
          <Input placeholder="Folder name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} autoFocus />
          <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowNewFolder(false)}>Cancel</Button>
        </div>
      )}

      {/* Breadcrumb */}
      {!searchQuery && (
        <div className="flex items-center gap-1 text-sm">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id ?? 'root'} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button className={`hover:text-primary transition-colors ${i === breadcrumb.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}`} onClick={() => setCurrentFolder(crumb.id)}>
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Folders */}
      {!searchQuery && currentFolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {currentFolders.map(folder => (
            <button key={folder.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left" onClick={() => setCurrentFolder(folder.id)}>
              <FolderOpen className="h-5 w-5 shrink-0" style={{ color: folder.color }} />
              <span className="text-sm font-medium truncate">{folder.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Assets grid/list */}
      {currentAssets.length === 0 && currentFolders.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          eyebrow="Your creative library"
          title="No assets here yet"
          description="Upload references, raw footage, design files, or finals. Versioning, folders, and tags keep everything tidy."
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {currentAssets.map(asset => (
            <div key={asset.id} className="group rounded-lg border bg-card overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setSelectedAsset(asset)}>
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {asset.media_type === 'image' && signedUrls[asset.id] ? (
                  <img src={signedUrls[asset.id]} alt={asset.name} className="h-full w-full object-cover" />
                ) : asset.media_type === 'video' ? (
                  <div className="relative h-full w-full bg-black/80 flex items-center justify-center">
                    <Film className="h-10 w-10 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="text-muted-foreground">{getMediaIcon(asset.media_type)}</div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium truncate">{asset.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(asset.file_size)}</p>
                {asset.tags?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {asset.tags.slice(0, 2).map(t => (
                      <Badge key={t} variant="secondary" className="text-[9px] px-1 py-0">{t}</Badge>
                    ))}
                    {asset.tags.length > 2 && <span className="text-[9px] text-muted-foreground">+{asset.tags.length - 2}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {currentAssets.map(asset => (
            <div key={asset.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedAsset(asset)}>
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {asset.media_type === 'image' && signedUrls[asset.id] ? <img src={signedUrls[asset.id]} alt="" className="h-full w-full object-cover" /> : <span className="text-muted-foreground">{getMediaIcon(asset.media_type)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{asset.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(asset.file_size)} · v{asset.version} · {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}</p>
              </div>
              {asset.tags?.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {asset.tags.slice(0, 3).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Asset detail dialog */}
      <Dialog open={!!selectedAsset} onOpenChange={open => { if (!open) setSelectedAsset(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAsset && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate">{selectedAsset.name}</DialogTitle>
              </DialogHeader>
              {/* Preview */}
              <div className="rounded-lg overflow-hidden bg-muted">
                {selectedAsset.media_type === 'image' ? (
                  signedUrls[selectedAsset.id] ? (
                    <img src={signedUrls[selectedAsset.id]} alt={selectedAsset.name} className="w-full max-h-96 object-contain" />
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">Loading preview…</div>
                  )
                ) : selectedAsset.media_type === 'video' ? (
                  signedUrls[selectedAsset.id] && <video src={signedUrls[selectedAsset.id]} controls className="w-full max-h-96" />
                ) : selectedAsset.media_type === 'audio' ? (
                  <div className="p-6">
                    {signedUrls[selectedAsset.id] && <audio src={signedUrls[selectedAsset.id]} controls className="w-full" />}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
                    {signedUrls[selectedAsset.id] && (
                      <a href={signedUrls[selectedAsset.id]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">Open file</a>
                    )}
                  </div>
                )}
              </div>
              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Size:</span> {formatSize(selectedAsset.file_size)}</div>
                <div><span className="text-muted-foreground">Type:</span> {selectedAsset.file_type || selectedAsset.media_type}</div>
                <div><span className="text-muted-foreground">Version:</span> {selectedAsset.version}</div>
                <div><span className="text-muted-foreground">Added:</span> {formatDistanceToNow(new Date(selectedAsset.created_at), { addSuffix: true })}</div>
              </div>
              {/* Tags */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><Tag className="h-4 w-4" /> Tags</h4>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(selectedAsset.tags || []).map(t => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button onClick={() => handleRemoveTag(selectedAsset.id, t)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add tag..." value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag(selectedAsset.id)} className="h-8 text-sm" />
                  <Button size="sm" variant="outline" onClick={() => handleAddTag(selectedAsset.id)} disabled={!newTag.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-2 border-t pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!signedUrls[selectedAsset.id]}
                  onClick={() => signedUrls[selectedAsset.id] && window.open(signedUrls[selectedAsset.id], '_blank')}
                >
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeleteAsset(selectedAsset.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
