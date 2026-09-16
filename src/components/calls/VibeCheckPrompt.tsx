import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, X, Loader2, Sparkles } from "lucide-react";
import { useStartDirectCall } from "@/hooks/useStartDirectCall";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";

interface Props {
  conversationId: string;
  recipientId: string;
  recipientName: string;
}

const dismissKey = (cid: string) => `vibe-check-dismissed:${cid}`;

/**
 * Inline prompt that nudges two users to hop on a quick video call once
 * a Match conversation has momentum. Dismissible per-conversation
 * (sessionStorage). Reuses the shared 1:1 calling infrastructure.
 */
export const VibeCheckPrompt = ({ conversationId, recipientId, recipientName }: Props) => {
  const initialDismissed = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(dismissKey(conversationId)) === "1";
    } catch {
      return false;
    }
  }, [conversationId]);
  const [dismissed, setDismissed] = useState(initialDismissed);
  const { starting, session, open, setOpen, start, myName } = useStartDirectCall();

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissKey(conversationId), "1");
    } catch {
      /* ignore */
    }
  };

  const handleStart = () => {
    void start(recipientId, recipientName, { context: "vibe-check" });
  };

  return (
    <>
      <div className="px-3 sm:px-4 pt-3">
        <Card className="relative p-3 sm:p-4 border-primary/30 bg-primary/5">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 rounded-md"
            aria-label="Dismiss vibe check prompt"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Feeling the vibe?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A 5-minute face-to-face moves things forward faster than a week of DMs.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  onClick={handleStart}
                  disabled={starting}
                >
                  {starting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Video className="h-3.5 w-3.5" />
                  )}
                  Hop on a quick call
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                >
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
      <VideoCallSheet
        open={open}
        onOpenChange={setOpen}
        projectName={`Call with ${recipientName}`}
        roomUrl={session?.roomUrl ?? null}
        token={session?.token ?? null}
        callId={session?.callId ?? null}
        userName={myName}
        directCallId={session?.callId ?? null}
        roomName={session?.roomName ?? null}
      />
    </>
  );
};
