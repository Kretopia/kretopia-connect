import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Download, FileText, Image as ImageIcon, Film, Music, File, Trash2, MoreVertical, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { extractProjectFilePath, getProjectFileSignedUrl } from "@/lib/projectFiles";
import { EmptyState } from "@/components/ui/empty-state";
import { useFileSizeLimit } from "@/hooks/useFileSizeLimit";
import { QuotaExceededDialog, deriveQuotaReason, type QuotaBlockReason } from "@/components/storage/QuotaExceededDialog";

interface ProjectFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
  user_id: string;
}

interface SimpleFileSharingProps {
  projectId: string;
  files: ProjectFile[];
  onFileUploaded: () => void;
}

export const SimpleFileSharing = ({ projectId, files, onFileUploaded }: SimpleFileSharingProps) => {
  const { toast } = useToast();
  const sizeLimit = useFileSizeLimit();
  const [uploading, setUploading] = useState(false);
  const [replacingFileId, setReplacingFileId] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<QuotaBlockReason | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-5 w-5" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="h-5 w-5" />;
    if (fileType.startsWith('video/')) return <Film className="h-5 w-5" />;
    if (fileType.startsWith('audio/')) return <Music className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reason = deriveQuotaReason({ name: file.name, size: file.size }, sizeLimit.limit, sizeLimit.quota?.remaining);
    if (reason) {
      setQuotaBlock(reason);
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('project-files').upload(fileName, file);
      if (uploadError) throw uploadError;

      // Store the storage path (not a public URL); signed URLs are generated on access
      const { error: dbError } = await supabase.from('project_files').insert({
        project_id: projectId,
        user_id: user.id,
        file_name: file.name,
        file_url: fileName,
        file_size: file.size,
        file_type: file.type,
      });
      if (dbError) throw dbError;

      toast({ title: "File uploaded", description: `${file.name} uploaded successfully` });
      onFileUploaded();
    } catch (error: any) {
      console.error('File upload error:', error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (file: ProjectFile) => {
    try {
      // Delete from storage
      const filePath = extractProjectFilePath(file.file_url);
      await supabase.storage.from('project-files').remove([filePath]);

      // Delete from DB
      const { error } = await supabase.from('project_files').delete().eq('id', file.id);
      if (error) throw error;

      toast({ title: "File deleted" });
      onFileUploaded();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  const handleReplaceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !replacingFileId) return;

    const existingFile = files.find(f => f.id === replacingFileId);
    if (!existingFile) return;

    const reason = deriveQuotaReason({ name: file.name, size: file.size }, sizeLimit.limit, sizeLimit.quota?.remaining);
    if (reason) {
      setQuotaBlock(reason);
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('project-files').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('project_files').update({
        file_name: file.name,
        file_url: fileName,
        file_size: file.size,
        file_type: file.type,
      }).eq('id', replacingFileId);
      if (dbError) throw dbError;

      toast({ title: "File replaced", description: `Updated to ${file.name}` });
      onFileUploaded();
    } catch (error: any) {
      toast({ title: "Replace failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setReplacingFileId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const handleFileClick = async (file: ProjectFile, forceDownload = false) => {
    try {
      const signedUrl = await getProjectFileSignedUrl(file.file_url, {
        expiresIn: 3600,
        download: forceDownload ? file.file_name : undefined,
      });
      if (!signedUrl) throw new Error("Could not generate file URL");

      if (file.file_type?.startsWith('image/') && !forceDownload) {
        window.open(signedUrl, '_blank');
        return;
      }
      window.location.href = signedUrl;
    } catch (error) {
      console.error('Error accessing file:', error);
      toast({ title: "Error", description: "Failed to access file. Please try again.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Files ({files.length})
          </CardTitle>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <input ref={replaceInputRef} type="file" className="hidden" onChange={handleReplaceFile} />
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No files shared yet"
            description="Drop briefs, references, or deliverables here so your collaborator always has the latest version."
            action={{ label: "Upload a file", icon: Upload, onClick: () => fileInputRef.current?.click() }}
            className="py-8"
          />
        ) : (
          <ScrollArea className="h-[50vh] md:h-[300px]">
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleFileClick(file, false)}
                >
                  <div className="text-muted-foreground">
                    {getFileIcon(file.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.file_size)} • {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => handleFileClick(file, true)}>
                        <Download className="h-4 w-4 mr-2" /> Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setReplacingFileId(file.id); replaceInputRef.current?.click(); }}>
                        <RefreshCw className="h-4 w-4 mr-2" /> Replace
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFile(file)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      <QuotaExceededDialog
        open={!!quotaBlock}
        onOpenChange={(o) => { if (!o) setQuotaBlock(null); }}
        reason={quotaBlock}
      />
    </Card>
  );
};
