import { useEffect, useState } from "react";
import { FileIcon, Loader2 } from "lucide-react";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";

interface ChatAttachmentProps {
  url: string;
  name: string;
  type?: string;
}

/**
 * Renders a chat attachment as either an inline image preview or a file chip.
 * Resolves both legacy public URLs and new private storage paths to a signed
 * URL so previews work regardless of bucket visibility.
 */
export const ChatAttachment = ({ url, name, type }: ChatAttachmentProps) => {
  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImg = type?.startsWith("image/");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const signed = await getProjectFileSignedUrl(url, { expiresIn: 3600 });
      if (!cancelled) {
        setResolved(signed ?? url);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 max-w-[240px]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs truncate">{name}</span>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/5 max-w-[240px]">
        <FileIcon className="h-3.5 w-3.5 text-destructive shrink-0" />
        <span className="text-xs truncate text-destructive">{name} (unavailable)</span>
      </div>
    );
  }

  if (isImg) {
    return (
      <a
        href={resolved}
        target="_blank"
        rel="noreferrer"
        className="block rounded-lg overflow-hidden border border-border max-w-[240px] hover:border-primary transition-colors"
      >
        <img src={resolved} alt={name} className="max-h-48 object-cover" loading="lazy" />
      </a>
    );
  }

  return (
    <a
      href={resolved}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-accent transition-colors max-w-[240px]"
    >
      <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs truncate">{name}</span>
    </a>
  );
};
