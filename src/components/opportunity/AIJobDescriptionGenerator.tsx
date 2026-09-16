import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { FreeTierGate } from "@/components/FreeTierGate";
import { useFeatureGate } from "@/hooks/useFeatureGate";

interface GeneratedJobDescription {
  title: string;
  description: string;
  requirements: string;
  deliverables: string;
  skills: string[];
  compensation: string;
}

interface AIJobDescriptionGeneratorProps {
  onGenerated: (data: GeneratedJobDescription) => void;
  isPro: boolean;
}

export function AIJobDescriptionGenerator({ onGenerated, isPro }: AIJobDescriptionGeneratorProps) {
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const { guard: guardJobDesc } = useFeatureGate("aiJobDescriptions");

  const handleGenerate = async () => {
    if (!brief.trim()) {
      toast({
        title: "Enter a brief",
        description: "Describe what you're looking for in a few sentences.",
        variant: "destructive",
      });
      return;
    }
    if (!guardJobDesc()) return;

    setGenerating(true);
    try {
      const systemPrompt = `You are a professional opportunity posting writer for a creative industry platform called Kretopia. 
Given a rough brief from a company, generate a polished, compelling opportunity posting.

IMPORTANT: Respond ONLY with valid JSON, no markdown, no code fences. Use this exact format:
{
  "title": "Clear, specific opportunity title",
  "description": "2-3 paragraph compelling description of the role/project. Include context about the company/project, what the creative will be doing, and why this is exciting.",
  "requirements": "Bullet-pointed requirements and qualifications, each on a new line starting with •",
  "deliverables": "Bullet-pointed list of expected deliverables, each on a new line starting with •",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "compensation": "Suggested compensation based on the brief"
}

Make it professional but approachable. Use language that appeals to creative professionals. Keep the title under 80 characters.`;

      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          type: "job_description",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate an opportunity posting from this brief:\n\n${brief}` },
          ],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const content = data?.content;
      if (!content) throw new Error("No content returned");

      // Parse JSON from response (handle potential markdown wrapping)
      let parsed: GeneratedJobDescription;
      try {
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error("Failed to parse AI response. Please try again.");
      }

      onGenerated(parsed);
      toast({
        title: "Job description generated!",
        description: "Review and edit the fields below before posting.",
      });
    } catch (error: any) {
      console.error("AI generation error:", error);
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
    <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Wand2 className="h-4 w-4" />
        Smart Brief Writer
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-brief" className="text-sm text-muted-foreground">
          Describe what you need in a few sentences
        </Label>
        <Textarea
          id="ai-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder='e.g., "Need a video editor for a hip-hop music video, $500 budget, remote work, 2 week turnaround, looking for someone with experience in color grading"'
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
            Generate Job Description
          </>
        )}
      </Button>
    </div>
  );

  return (
    <FreeTierGate
      feature="aiJobDescriptions"
      featureLabel="Smart Brief Writer"
      description="Upgrade to Pro for unlimited smart brief generation."
    >
      {generatorContent}
    </FreeTierGate>
  );
}
