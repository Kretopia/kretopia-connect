import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, X } from "lucide-react";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";

interface ProjectFileLite {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
}

interface FilePreviewDialogProps {
  file: ProjectFileLite | null;
  onClose: () => void;
}

export const FilePreviewDialog = ({ file, onClose }: FilePreviewDialogProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProjectFileSignedUrl(file.file_url, { expiresIn: 3600 }).then((signed) => {
      if (cancelled) return;
      setUrl(signed);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleDownload = async () => {
    if (!file) return;
    const dl = await getProjectFileSignedUrl(file.file_url, { expiresIn: 3600, download: file.file_name });
    if (dl) window.location.href = dl;
  };

  const isImage = file?.file_type?.startsWith("image/");
  const isVideo = file?.file_type?.startsWith("video/");
  const isAudio = file?.file_type?.startsWith("audio/");
  const isPdf = file?.file_type === "application/pdf";

  return (
    <Dialog open={!!file} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card">
          <p className="text-sm font-medium truncate flex-1 mr-4">{file?.file_name}</p>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-auto min-h-0">
          {loading || !url ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : isImage ? (
            <img src={url} alt={file?.file_name} className="max-w-full max-h-full object-contain" />
          ) : isVideo ? (
            <video src={url} controls className="max-w-full max-h-full" />
          ) : isAudio ? (
            <audio src={url} controls className="w-full max-w-md" />
          ) : isPdf ? (
            <iframe src={url} title={file?.file_name} className="w-full h-full border-0" />
          ) : (
            <div className="text-center p-8">
              <p className="text-sm text-muted-foreground mb-4">Preview not available for this file type.</p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
