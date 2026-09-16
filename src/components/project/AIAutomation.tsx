import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Zap, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIAutomationProps {
  projectId: string;
  projectTitle: string;
  projectDescription?: string;
  onUpdate: () => void;
}

export const AIAutomation = ({ projectId, projectTitle, projectDescription, onUpdate }: AIAutomationProps) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const generateTaskSuggestions = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const systemPrompt = `You are an AI project assistant. Analyze the project and suggest 3-5 actionable tasks that would help complete it successfully. Return tasks as a structured response.`;
      
      const userPrompt = `Project: ${projectTitle}\nDescription: ${projectDescription || "No description provided"}\n\nSuggest practical tasks to complete this project.`;

      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          type: "suggest"
        }
      });

      if (error) throw error;

      // Parse AI response for task suggestions
      const taskMatches = data.content.match(/\d+\.\s*(.+?)(?=\n\d+\.|\n*$)/g);
      if (taskMatches) {
        const parsedTasks = taskMatches.map((match: string) => {
          const title = match.replace(/^\d+\.\s*/, '').trim();
          return {
            title,
            priority: title.toLowerCase().includes('urgent') || title.toLowerCase().includes('asap') ? 'high' : 'medium',
            category: title.toLowerCase().includes('design') ? 'design' : 
                     title.toLowerCase().includes('dev') || title.toLowerCase().includes('code') ? 'development' : 'general'
          };
        });
        setSuggestions(parsedTasks);
      }
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({
        title: "AI generation failed",
        description: error.message || "Could not generate task suggestions",
        variant: "destructive"
      });
    }
    setGenerating(false);
  };

  const addTask = async (task: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('project_tasks')
        .insert({
          project_id: projectId,
          created_by: user?.id,
          title: task.title,
          status: 'todo',
        });

      if (error) throw error;

      toast({
        title: "Task added!",
        description: "AI-suggested task has been added to your project",
      });
      
      setSuggestions(suggestions.filter(s => s !== task));
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Failed to add task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="p-4 bg-secondary/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Task Suggestions</h3>
        </div>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={generateTaskSuggestions}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {suggestions.length === 0 && !generating && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Click the button to get smart task suggestions</p>
        </div>
      )}

      {generating && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">AI is analyzing your project...</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <ScrollArea className="max-h-60">
          <div className="space-y-2">
            {suggestions.map((task, idx) => (
              <div key={idx} className="p-3 bg-background rounded-lg border">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1">{task.title}</p>
                    <div className="flex gap-1">
                      <Badge variant="secondary" className="text-xs">{task.priority}</Badge>
                      <Badge variant="outline" className="text-xs">{task.category}</Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => addTask(task)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};
