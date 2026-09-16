import { useEffect, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";
import { cn } from "@/lib/utils";

interface MoodboardThumbProps {
  storedUrl: string;
  alt?: string;
  className?: string;
}

/**
 * Thumbnail that resolves the project-files private bucket path → fresh signed URL.
 * Cached in module-level Map for the session to avoid refetching.
 */
const cache = new Map<string, string>();

export const MoodboardThumb = ({ storedUrl, alt, className }: MoodboardThumbProps) => {
  const [url, setUrl] = useState<string | null>(() => cache.get(storedUrl) ?? null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!storedUrl || cache.has(storedUrl)) return;
    // Legacy public URL — use as-is
    if (storedUrl.startsWith("http") && storedUrl.includes("/object/public/")) {
      cache.set(storedUrl, storedUrl);
      setUrl(storedUrl);
      return;
    }
    getProjectFileSignedUrl(storedUrl, { expiresIn: 3600 })
      .then((signed) => {
        if (cancelled) return;
        if (signed) {
          cache.set(storedUrl, signed);
          setUrl(signed);
        } else {
          setErrored(true);
        }
      })
      .catch(() => !cancelled && setErrored(true));
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  if (errored) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageIcon className="h-5 w-5 opacity-40" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt ?? ""}
      loading="lazy"
      className={className}
      onError={() => setErrored(true)}
    />
  );
};
