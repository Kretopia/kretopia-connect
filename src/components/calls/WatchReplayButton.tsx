import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RecordingReplayDialog } from "./RecordingReplayDialog";

/**
 * Fetches a fresh Daily access-link for a recording and opens it in
 * Kretopia's own replay modal, instead of a bare new tab.
 */
export const WatchReplayButton = ({
  transcriptId,
  variant = "outline",
  size = "sm",
  label = "Replay",
  title,
  subtitle,
}: {
  transcriptId: string;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "icon";
  label?: string;
  /** Derived from call_kind (e.g. "Studio call") -- never a fabricated title. */
  title?: string;
  /** e.g. "2 hours ago · 5m 30s" */
  subtitle?: string;
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setUrl(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "get-recording-link",
        { body: { transcript_id: transcriptId } },
      );
      if (fnError) throw fnError;
      const link = (data as any)?.download_link;
      if (!link) throw new Error("No recording URL returned");
      setUrl(link);
    } catch (e: any) {
      setError(e?.message ?? "The recording may still be processing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        size={size}
        onClick={handleOpen}
        disabled={loading}
        className="gap-1.5 shrink-0"
        aria-label="Watch call replay"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{label}</span>
      </Button>
      <RecordingReplayDialog
        open={open}
        onOpenChange={setOpen}
        title={title ?? "Call replay"}
        subtitle={subtitle}
        url={url}
        loading={loading}
        error={error}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          triggerRef.current?.focus();
        }}
      />
    </>
  );
};
