import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface ApplyToStageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  stageTitle: string;
  applicationPrompt?: string | null;
  onApplied?: () => void;
}

/**
 * Sheet for creators to apply to a Scout Stage.
 * Pitch + optional voice/video link. Auto-attaches Passport (their profile is queryable by host).
 */
export function ApplyToStageSheet({
  open, onOpenChange, stageId, stageTitle, applicationPrompt, onApplied,
}: ApplyToStageSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pitch, setPitch] = useState("");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) { toast({ title: "Sign in to apply", variant: "destructive" }); return; }
    if (!pitch.trim()) { toast({ title: "Add a short pitch", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-to-stage", {
        body: { stage_id: stageId, pitch: pitch.trim(), voice_url: voiceUrl.trim() || null },
      });
      if (error) {
        const msg = (error as any)?.context?.body || (error as any)?.message || "Couldn't submit";
        if (String(msg).includes("STAGE_APPLY_LIMIT")) {
          toast({
            title: "Monthly application limit reached",
            description: "Upgrade to apply to more stages this month.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      if (data?.error === "STAGE_APPLY_LIMIT") {
        toast({
          title: "Monthly application limit reached",
          description: "Upgrade to apply to more stages this month.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Application sent — the host will be in touch." });
      onApplied?.();
      onOpenChange(false);
      setPitch(""); setVoiceUrl("");
    } catch (e: any) {
      toast({ title: "Couldn't submit", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Apply to {stageTitle}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4 pb-8">
          <p className="text-sm text-muted-foreground">
            {applicationPrompt ||
              "Tell the host why you're a fit and what you'd bring on the stage. Keep it tight — they'll see your Passport too."}
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Your pitch</Label>
            <Textarea
              value={pitch} onChange={(e) => setPitch(e.target.value)}
              rows={5} maxLength={1000}
              placeholder="I'm a vocalist based in NYC, just wrapped a session with…"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Sample link (optional)</Label>
            <Input
              value={voiceUrl} onChange={(e) => setVoiceUrl(e.target.value)}
              placeholder="https://… (SoundCloud, YouTube, IG reel, etc.)"
            />
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : "Send application"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
