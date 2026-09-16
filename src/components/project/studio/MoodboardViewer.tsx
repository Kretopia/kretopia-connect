import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, Download, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";

// Module-level cache shared across mounts to avoid refetching signed URLs
const signedUrlCache = new Map<string, string>();

interface MoodboardFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
}

interface MoodboardViewerProps {
  files: MoodboardFile[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onOpenNotes: (file: MoodboardFile) => void;
}

export const MoodboardViewer = ({
  files,
  index,
  onClose,
  onIndexChange,
  onOpenNotes,
}: MoodboardViewerProps) => {
  const file = index != null ? files[index] : null;
  const storedUrl = file?.file_url ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storedUrl) {
      setUrl(null);
      return;
    }
    // Reuse cached signed URL if available
    const cached = signedUrlCache.get(storedUrl);
    if (cached) {
      setUrl(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setUrl(null);
    getProjectFileSignedUrl(storedUrl, { expiresIn: 3600 })
      .then((signed) => {
        if (cancelled) return;
        if (signed) signedUrlCache.set(storedUrl, signed);
        setUrl(signed);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  // Keyboard navigation
  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && index < files.length - 1) onIndexChange(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, files.length, onIndexChange]);

  const handleDownload = async () => {
    if (!file) return;
    const dl = await getProjectFileSignedUrl(file.file_url, {
      expiresIn: 3600,
      download: file.file_name,
    });
    if (dl) window.location.href = dl;
  };

  const canPrev = index != null && index > 0;
  const canNext = index != null && index < files.length - 1;

  return (
    <Dialog open={index != null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[96vw] h-[92vh] p-0 gap-0 bg-black/95 border-none overflow-hidden flex flex-col [&>button]:hidden">
        <DialogTitle className="sr-only">{file?.file_name || "Moodboard image"}</DialogTitle>
        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
          <p className="text-xs font-medium text-white/90 truncate flex-1 mr-2">
            {file?.file_name}
            {index != null && (
              <span className="ml-2 text-white/50">
                {index + 1} / {files.length}
              </span>
            )}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1 text-white hover:bg-white/10"
              onClick={() => file && onOpenNotes(file)}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Notes
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/10"
              onClick={handleDownload}
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/10"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center min-h-0 h-full">
          {loading || !url ? (
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
          ) : (
            <img
              src={url}
              alt={file?.file_name}
              className="max-w-full max-h-full object-contain select-none"
            />
          )}
        </div>

        {/* Prev / Next */}
        {canPrev && (
          <button
            type="button"
            onClick={() => onIndexChange((index as number) - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canNext && (
          <button
            type="button"
            onClick={() => onIndexChange((index as number) + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};
