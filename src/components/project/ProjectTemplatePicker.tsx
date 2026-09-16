import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LayoutTemplate, CheckSquare, FolderOpen, Milestone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  color: string | null;
  is_public: boolean | null;
  structure: any;
  tasks: any;
  milestones: any;
  usage_count: number | null;
}

interface ProjectTemplatePickerProps {
  projectId: string;
  currentUserId: string;
  onApplied: () => void;
}

const categoryColors: Record<string, string> = {
  music: 'bg-red-500/10 text-red-500',
  marketing: 'bg-primary/10 text-primary',
  audio: 'bg-amber-500/10 text-amber-500',
  photography: 'bg-emerald-500/10 text-emerald-500',
  design: 'bg-primary/10 text-primary',
  general: 'bg-muted text-muted-foreground',
};

export const ProjectTemplatePicker = ({ projectId, currentUserId, onApplied }: ProjectTemplatePickerProps) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('project_templates')
      .select('*')
      .order('usage_count', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  };

  const applyTemplate = async (template: Template) => {
    setApplying(true);
    try {
      const tasks = template.tasks || [];
      const milestones = template.milestones || [];
      const structure = template.structure || {};
      const folders = structure.folders || [];

      if (tasks.length > 0) {
        const taskInserts = tasks.map((task: any) => ({
          project_id: projectId,
          title: typeof task === 'string' ? task : task.title,
          status: 'todo',
          created_by: currentUserId,
        }));
        await supabase.from('project_tasks').insert(taskInserts);
      }

      if (milestones.length > 0) {
        const msInserts = milestones.map((ms: any) => ({
          project_id: projectId,
          title: typeof ms === 'string' ? ms : ms.title,
          amount: 0,
          status: 'pending',
          created_by: currentUserId,
        }));
        await supabase.from('milestones').insert(msInserts);
      }

      if (folders.length > 0) {
        const folderInserts = folders.map((name: string) => ({
          project_id: projectId,
          name,
          created_by: currentUserId,
        }));
        await supabase.from('asset_folders').insert(folderInserts);
      }

      // Non-critical: increment usage count (ignore errors)
      await supabase.from('project_templates').update({ usage_count: (template.usage_count || 0) + 1 }).eq('id', template.id).then(() => {});

      setSelectedTemplate(null);
      onApplied();
      toast({ title: "Template applied!", description: `${template.name} workflow has been set up` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5 text-primary" />
          Project Templates
        </h2>
        <p className="text-sm text-muted-foreground">
          Kickstart your project with a pre-built workflow
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map(template => (
          <Card
            key={template.id}
            className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            onClick={() => setSelectedTemplate(template)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{template.icon || ''}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{template.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{template.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className={`text-[10px] ${categoryColors[template.category] || categoryColors.general}`}>
                      {template.category}
                    </Badge>
                    {template.usage_count ? (
                      <span className="text-[10px] text-muted-foreground">{template.usage_count} uses</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <LayoutTemplate className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No templates available</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedTemplate} onOpenChange={open => { if (!open) setSelectedTemplate(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-xl">{selectedTemplate.icon || ''}</span>
                  {selectedTemplate.name}
                </DialogTitle>
                <DialogDescription>{selectedTemplate.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {(selectedTemplate.tasks?.length > 0) && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <CheckSquare className="h-4 w-4" /> Tasks ({selectedTemplate.tasks.length})
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {selectedTemplate.tasks.map((task: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                          {typeof task === 'string' ? task : task.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedTemplate.milestones?.length > 0) && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Milestone className="h-4 w-4" /> Milestones ({selectedTemplate.milestones.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.milestones.map((ms: any, i: number) => (
                        <Badge key={i} variant="outline">{typeof ms === 'string' ? ms : ms.title}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedTemplate.structure?.folders?.length > 0) && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <FolderOpen className="h-4 w-4" /> Folders ({selectedTemplate.structure.folders.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.structure.folders.map((f: string, i: number) => (
                        <Badge key={i} variant="secondary">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={() => applyTemplate(selectedTemplate)} disabled={applying}>
                {applying ? "Applying..." : "Apply Template to Project"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
