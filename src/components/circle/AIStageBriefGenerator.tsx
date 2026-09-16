import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2 } from "lucide-react";
import { FreeTierGate } from "@/components/FreeTierGate";
import { useFeatureGate } from "@/hooks/useFeatureGate";

interface GeneratedStageBrief {
  title: string;
  blurb: string;
  description: string;
}

interface AIStageBriefGeneratorProps {
  type: "scout" | "showcase";
  onGenerated: (data: GeneratedStageBrief) => void;
}

/**
 * "Describe it in a sentence, AI drafts the form" for stage scheduling —
 * the same pattern as Hire Talent's Smart Brief Writer
 * (AIJobDescriptionGenerator.tsx), applied to Scout/Showcase stages.
 * Shares the aiBriefs quota with Studio's AIBriefBuilder rather than
 * introducing a new feature key/tier cap for what's the same class of
 * "rough notes -> polished brief" generation.
 */
export function AIStageBriefGenerator({ type, onGenerated }: AIStageBriefGeneratorProps) {
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const { guard: guardAiBrief } = useFeatureGate("aiBriefs");

  const handleGenerate = async () => {
    if (!brief.trim()) {
      toast({
        title: "Enter a brief",
        description: "Describe the stage in a few sentences.",
        variant: "destructive",
      });
      return;
    }
    if (!guardAiBrief()) return;

    setGenerating(true);
    try {
      const systemPrompt = type === "scout"
        ? `You are a professional writer helping a creative-industry host draft a Scout Stage — a live audition session where they'll evaluate creators one at a time. Given a rough brief, generate a polished title, a short public pitch, and a clear "what you're looking for" note for applicants.

IMPORTANT: Respond ONLY with valid JSON, no markdown, no code fences. Use this exact format:
{
  "title": "Clear, specific stage title, under 80 characters",
  "blurb": "One short, public-facing sentence pitching what this session is about.",
  "description": "2-3 sentences telling applicants exactly what to bring and what you're looking for (e.g. who should apply, what sample/material to prepare)."
}`
        : `You are a professional writer helping a creative-industry host draft a Showcase Stage — a live session where they perform, present, or speak to an audience. Given a rough brief, generate a polished title and a short public pitch.

IMPORTANT: Respond ONLY with valid JSON, no markdown, no code fences. Use this exact format:
{
  "title": "Clear, specific stage title, under 80 characters",
  "blurb": "One short, public-facing sentence pitching what this session is about.",
  "description": ""
}`;

      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          type: "stage_brief",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate a ${type} stage brief from this rough idea:\n\n${brief}` },
          ],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const content = data?.content;
      if (!content) throw new Error("No content returned");

      let parsed: GeneratedStageBrief;
      try {
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error("Failed to parse AI response. Please try again.");
      }

      onGenerated(parsed);
      toast({
        title: "Stage brief generated!",
        description: "Review and edit the fields below before scheduling.",
      });
    } catch (error: any) {
      console.error("AI stage brief generation error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generatorContent = (
    <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Wand2 className="h-4 w-4" />
        Smart Brief Writer
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-stage-brief" className="text-sm text-muted-foreground">
          Describe the stage in a few sentences
        </Label>
        <Textarea
          id="ai-stage-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={type === "scout"
            ? 'e.g., "Looking for R&B vocalists 18-28, comfortable with falsetto, for a live audition next week"'
            : 'e.g., "A behind-the-scenes session on how I produce beats, open to anyone curious about the process"'}
          rows={3}
          maxLength={500}
          disabled={generating}
        />
      </div>
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !brief.trim()}
        variant="default"
        size="sm"
        className="w-full gap-2"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Generate Stage Brief
          </>
        )}
      </Button>
    </div>
  );

  return (
    <FreeTierGate
      feature="aiBriefs"
      featureLabel="Smart Brief Writer"
      description="Upgrade to Pro for unlimited smart brief generation."
    >
      {generatorContent}
    </FreeTierGate>
  );
}
