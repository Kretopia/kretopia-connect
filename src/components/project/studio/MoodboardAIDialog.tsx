import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onGenerated: () => void;
}

const SUGGESTIONS = [
  "Moody neon-lit street at night, cinematic",
  "Warm golden-hour portrait lighting",
  "Minimal editorial product still life",
  "Retro 90s music video aesthetic",
];

/**
 * Lightweight prompt → AI image dialog for the project Moodboard.
 * Calls `generate-moodboard-image` edge function which uploads to
 * `project-files` so the new image appears on the polaroid strip.
 */
export const MoodboardAIDialog = ({ open, onOpenChange, projectId, onGenerated }: Props) => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    const p = prompt.trim();
    if (!p) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-moodboard-image", {
        body: { project_id: projectId, prompt: p },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Pinned to your moodboard" });
      setPrompt("");
      onGenerated();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Couldn't generate image",
        description: err?.message ?? "Try a different prompt.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate moodboard image
          </DialogTitle>
          <DialogDescription>
            Describe the visual reference you want — we'll pin it to your moodboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Foggy mountain ridge at sunrise, muted teal palette…"
            className="min-h-[100px] text-sm"
            disabled={loading}
            maxLength={600}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => setPrompt(s)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border hover:border-primary/50 hover:bg-accent/40 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="rounded-full gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
