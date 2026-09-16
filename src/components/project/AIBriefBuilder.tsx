import { useState } from "react";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Sparkles, 
  Loader2, 
  FileText, 
  Copy, 
  Check, 
  RefreshCw,
  Target,
  Calendar,
  DollarSign,
  Users,
  ListChecks
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIBriefBuilderProps {
  projectId: string;
  projectTitle: string;
  projectDescription?: string;
  onBriefGenerated?: (brief: GeneratedBrief) => void;
}

interface GeneratedBrief {
  overview: string;
  objectives: string[];
  deliverables: string[];
  timeline: {
    phase: string;
    duration: string;
    tasks: string[];
  }[];
  budget_considerations: string[];
  success_metrics: string[];
  communication_plan: string;
}

export const AIBriefBuilder = ({ 
  projectId, 
  projectTitle, 
  projectDescription,
  onBriefGenerated 
}: AIBriefBuilderProps) => {
  const { toast } = useToast();
  const { guard: guardAiBrief } = useFeatureGate("aiBriefs");
  const [generating, setGenerating] = useState(false);
  const [brief, setBrief] = useState<GeneratedBrief | null>(null);
  const [roughIdea, setRoughIdea] = useState(projectDescription || "");
  const [projectType, setProjectType] = useState("");
  const [copied, setCopied] = useState(false);

  const generateBrief = async () => {
    if (!roughIdea.trim()) {
      toast({
        title: "Need some details",
        description: "Tell us a bit about your project idea first",
        variant: "destructive"
      });
      return;
    }
    if (!guardAiBrief()) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are an expert project manager and creative brief writer for the creator economy. 
You help turn rough project ideas into professional, actionable project briefs that teams can execute on.
Always respond with valid JSON only, no markdown or extra text.`
            },
            {
              role: 'user',
              content: `Transform this rough project idea into a professional project brief.

Project Title: ${projectTitle}
Project Type: ${projectType || 'Creative Project'}
Rough Idea: ${roughIdea}

Create a comprehensive brief that a collaborator can use to understand the full scope.
Include realistic timelines and actionable deliverables.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "overview": "A clear 2-3 sentence summary of what this project is about and its purpose.",
  "objectives": [
    "Primary goal of the project",
    "Secondary measurable objective",
    "Tertiary objective if applicable"
  ],
  "deliverables": [
    "Specific tangible output 1",
    "Specific tangible output 2",
    "Specific tangible output 3"
  ],
  "timeline": [
    {
      "phase": "Discovery & Planning",
      "duration": "1 week",
      "tasks": ["Task 1", "Task 2"]
    },
    {
      "phase": "Production",
      "duration": "2 weeks",
      "tasks": ["Task 1", "Task 2", "Task 3"]
    },
    {
      "phase": "Review & Delivery",
      "duration": "1 week",
      "tasks": ["Task 1", "Task 2"]
    }
  ],
  "budget_considerations": [
    "Key cost factor to consider",
    "Another budget consideration"
  ],
  "success_metrics": [
    "How to measure success 1",
    "How to measure success 2"
  ],
  "communication_plan": "Brief description of how the team should communicate and check in during the project."
}`
            }
          ],
          type: 'brief'
        }
      });

      if (error) throw error;

      let raw = typeof data?.content === 'string' ? data.content : '{}';
      // Strip markdown code blocks if present
      raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      let parsed: Partial<GeneratedBrief> = {};
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to parse AI brief JSON:', e, raw);
        throw new Error('Failed to generate brief - please try again');
      }

      const safeBrief: GeneratedBrief = {
        overview: parsed.overview || 'Project overview will be generated here.',
        objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
        deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
        budget_considerations: Array.isArray(parsed.budget_considerations) ? parsed.budget_considerations : [],
        success_metrics: Array.isArray(parsed.success_metrics) ? parsed.success_metrics : [],
        communication_plan: parsed.communication_plan || ''
      };

      setBrief(safeBrief);
      onBriefGenerated?.(safeBrief);

      toast({
        title: "Brief generated!",
        description: "Your professional project brief is ready",
      });
    } catch (error: any) {
      console.error('AI brief generation error:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate brief",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyBriefToClipboard = () => {
    if (!brief) return;

    const textBrief = `
# ${projectTitle} - Project Brief

## Overview
${brief.overview}

## Objectives
${brief.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

## Deliverables
${brief.deliverables.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## Timeline
${brief.timeline.map(phase => `
### ${phase.phase} (${phase.duration})
${phase.tasks.map(t => `- ${t}`).join('\n')}`).join('\n')}

## Budget Considerations
${brief.budget_considerations.map(b => `- ${b}`).join('\n')}

## Success Metrics
${brief.success_metrics.map(s => `- ${s}`).join('\n')}

## Communication Plan
${brief.communication_plan}
`.trim();

    navigator.clipboard.writeText(textBrief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "Copied!",
      description: "Brief copied to clipboard",
    });
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          AI Project Brief Builder
          <Badge variant="secondary" className="ml-auto text-xs gap-1">
            <Sparkles className="h-3 w-3" />
            AI Powered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!brief ? (
          <>
            <p className="text-sm text-muted-foreground">
              Turn your rough idea into a professional project brief that collaborators can act on.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Project Type</label>
                <Input
                  placeholder="e.g., Music Video, Brand Campaign, Podcast Series..."
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Your Rough Idea</label>
                <Textarea
                  placeholder="Describe your project in a few sentences. What do you want to create? Who is it for? Any specific requirements?"
                  value={roughIdea}
                  onChange={(e) => setRoughIdea(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The more details you provide, the better the brief will be
                </p>
              </div>

              <Button 
                onClick={generateBrief} 
                disabled={generating || !roughIdea.trim()}
                className="w-full gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Brief...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Professional Brief
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <ScrollArea className="max-h-[500px] pr-2">
            <div className="space-y-4">
              {/* Overview */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-primary" />
                  Overview
                </div>
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  {brief.overview}
                </p>
              </div>

              <Separator />

              {/* Objectives */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListChecks className="h-4 w-4 text-green-500" />
                  Objectives
                </div>
                <ul className="space-y-1">
                  {brief.objectives.map((obj, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5 h-5 w-5 p-0 justify-center shrink-0">
                        {i + 1}
                      </Badge>
                      <span className="text-muted-foreground">{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              {/* Deliverables */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-primary" />
                  Deliverables
                </div>
                <ul className="space-y-1">
                  {brief.deliverables.map((del, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span className="text-muted-foreground">{del}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              {/* Timeline */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  Timeline
                </div>
                <div className="space-y-3">
                  {brief.timeline.map((phase, i) => (
                    <div key={i} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{phase.phase}</span>
                        <Badge variant="secondary" className="text-xs">{phase.duration}</Badge>
                      </div>
                      <ul className="space-y-1">
                        {phase.tasks.map((task, j) => (
                          <li key={j} className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Budget Considerations */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <DollarSign className="h-4 w-4 text-yellow-500" />
                  Budget Considerations
                </div>
                <ul className="space-y-1">
                  {brief.budget_considerations.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="text-yellow-500">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              {/* Success Metrics */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-primary" />
                  Success Metrics
                </div>
                <ul className="space-y-1">
                  {brief.success_metrics.map((metric, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="text-primary"></span>
                      {metric}
                    </li>
                  ))}
                </ul>
              </div>

              {brief.communication_plan && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4 text-teal-500" />
                      Communication Plan
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                      {brief.communication_plan}
                    </p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyBriefToClipboard}
                  className="flex-1 gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Brief
                    </>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setBrief(null)}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  New Brief
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
