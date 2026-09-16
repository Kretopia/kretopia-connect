import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Film, Music, File as FileIcon } from "lucide-react";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";

interface FileThumbnailProps {
  fileUrl: string;
  fileType: string | null;
  className?: string;
}

const cache = new Map<string, string>();

export const FileThumbnail = ({ fileUrl, fileType, className = "" }: FileThumbnailProps) => {
  const [thumb, setThumb] = useState<string | null>(() => cache.get(fileUrl) ?? null);
  const isImage = fileType?.startsWith("image/");

  useEffect(() => {
    if (!isImage || cache.has(fileUrl)) return;
    let cancelled = false;
    getProjectFileSignedUrl(fileUrl, { expiresIn: 3600 }).then((url) => {
      if (cancelled || !url) return;
      cache.set(fileUrl, url);
      setThumb(url);
    });
    return () => { cancelled = true; };
  }, [fileUrl, isImage]);

  if (isImage && thumb) {
    return <img src={thumb} alt="" loading="lazy" className={`object-cover ${className}`} />;
  }

  const Icon = !fileType ? FileIcon
    : fileType.startsWith("image/") ? ImageIcon
    : fileType.startsWith("video/") ? Film
    : fileType.startsWith("audio/") ? Music
    : FileText;

  return (
    <div className={`flex items-center justify-center bg-muted/40 ${className}`}>
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
  );
};
