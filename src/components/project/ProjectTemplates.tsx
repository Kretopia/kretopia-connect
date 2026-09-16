import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Film, Music, Palette, Code, Camera, Mic, Plus, Loader2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  tasks: Array<{ title: string; description: string; status: string }>;
  milestones: Array<{ title: string; description: string; amount: number }>;
}

const templates: Template[] = [
  {
    id: "video-production",
    name: "Video Production",
    description: "Complete workflow for video projects from pre-production to delivery",
    icon: Film,
    color: "bg-primary/10 text-primary",
    tasks: [
      { title: "Script Review", description: "Review and approve final script", status: "todo" },
      { title: "Shot List Creation", description: "Create detailed shot list and storyboards", status: "todo" },
      { title: "Location Scouting", description: "Scout and secure filming locations", status: "todo" },
      { title: "Equipment Setup", description: "Prepare camera, lighting, and audio equipment", status: "todo" },
      { title: "Principal Photography", description: "Main filming days", status: "todo" },
      { title: "Rough Cut Edit", description: "Create initial edit for review", status: "todo" },
      { title: "Color Grading", description: "Color correction and grading", status: "todo" },
      { title: "Sound Design", description: "Add music, sound effects, and mix audio", status: "todo" },
      { title: "Final Delivery", description: "Export and deliver final files", status: "todo" },
    ],
    milestones: [
      { title: "Pre-Production Complete", description: "Script, shot list, and locations secured", amount: 25 },
      { title: "Filming Complete", description: "All footage captured", amount: 35 },
      { title: "Rough Cut Approved", description: "Initial edit approved by client", amount: 20 },
      { title: "Final Delivery", description: "Color graded, sound mixed, and delivered", amount: 20 },
    ],
  },
  {
    id: "music-collab",
    name: "Music Collaboration",
    description: "Track production workflow from writing to final mix",
    icon: Music,
    color: "bg-primary/10 text-primary",
    tasks: [
      { title: "Song Concept Discussion", description: "Discuss overall direction and vibe", status: "todo" },
      { title: "Write Lyrics/Melody", description: "Complete songwriting phase", status: "todo" },
      { title: "Record Demo", description: "Create rough demo recording", status: "todo" },
      { title: "Track Instrumentals", description: "Record all instrument parts", status: "todo" },
      { title: "Record Vocals", description: "Track lead and backing vocals", status: "todo" },
      { title: "Editing & Comping", description: "Edit and comp best takes", status: "todo" },
      { title: "Mixing", description: "Mix all tracks together", status: "todo" },
      { title: "Mastering", description: "Final mastering for release", status: "todo" },
    ],
    milestones: [
      { title: "Songwriting Complete", description: "Lyrics and melody finalized", amount: 20 },
      { title: "Recording Done", description: "All instruments and vocals tracked", amount: 40 },
      { title: "Mix Approved", description: "Final mix approved", amount: 25 },
      { title: "Master Delivered", description: "Final mastered track delivered", amount: 15 },
    ],
  },
  {
    id: "design-project",
    name: "Design Project",
    description: "Brand identity or design project from concept to delivery",
    icon: Palette,
    color: "bg-primary/10 text-primary",
    tasks: [
      { title: "Client Brief Review", description: "Understand project requirements", status: "todo" },
      { title: "Market Research", description: "Research competitors and trends", status: "todo" },
      { title: "Mood Board Creation", description: "Create visual direction board", status: "todo" },
      { title: "Concept Development", description: "Develop 3 initial concepts", status: "todo" },
      { title: "Client Presentation", description: "Present concepts to client", status: "todo" },
      { title: "Refinement Round 1", description: "Refine chosen concept", status: "todo" },
      { title: "Refinement Round 2", description: "Final adjustments", status: "todo" },
      { title: "File Preparation", description: "Prepare all deliverable files", status: "todo" },
    ],
    milestones: [
      { title: "Research & Concepts", description: "Initial concepts presented", amount: 30 },
      { title: "Refinements Complete", description: "Final design approved", amount: 40 },
      { title: "Files Delivered", description: "All formats delivered", amount: 30 },
    ],
  },
  {
    id: "web-dev",
    name: "Web Development",
    description: "Full-stack web application development workflow",
    icon: Code,
    color: "bg-green-500/10 text-green-500",
    tasks: [
      { title: "Requirements Gathering", description: "Define project scope and features", status: "todo" },
      { title: "Wireframes", description: "Create UI/UX wireframes", status: "todo" },
      { title: "Design Mockups", description: "Design high-fidelity mockups", status: "todo" },
      { title: "Database Schema", description: "Design database structure", status: "todo" },
      { title: "Frontend Development", description: "Build user interface", status: "todo" },
      { title: "Backend API", description: "Develop backend services", status: "todo" },
      { title: "Integration", description: "Connect frontend to backend", status: "todo" },
      { title: "Testing", description: "QA and bug fixes", status: "todo" },
      { title: "Deployment", description: "Deploy to production", status: "todo" },
    ],
    milestones: [
      { title: "Design Approved", description: "Mockups approved by client", amount: 20 },
      { title: "Frontend Complete", description: "UI fully built", amount: 30 },
      { title: "Backend Complete", description: "API and database ready", amount: 30 },
      { title: "Launch", description: "Site deployed and live", amount: 20 },
    ],
  },
  {
    id: "photography",
    name: "Photography Session",
    description: "Professional photo shoot from planning to delivery",
    icon: Camera,
    color: "bg-orange-500/10 text-orange-500",
    tasks: [
      { title: "Creative Consultation", description: "Discuss vision and style", status: "todo" },
      { title: "Location Selection", description: "Choose and secure location", status: "todo" },
      { title: "Shot List", description: "Plan all required shots", status: "todo" },
      { title: "Equipment Prep", description: "Prepare cameras and lighting", status: "todo" },
      { title: "Photo Session", description: "Conduct photo shoot", status: "todo" },
      { title: "Photo Selection", description: "Select best images", status: "todo" },
      { title: "Retouching", description: "Edit and retouch selected photos", status: "todo" },
      { title: "Final Delivery", description: "Deliver edited photos", status: "todo" },
    ],
    milestones: [
      { title: "Planning Complete", description: "All logistics confirmed", amount: 20 },
      { title: "Shoot Complete", description: "All photos captured", amount: 40 },
      { title: "Retouching Done", description: "All edits complete", amount: 25 },
      { title: "Delivery", description: "Final files delivered", amount: 15 },
    ],
  },
  {
    id: "podcast",
    name: "Podcast Production",
    description: "End-to-end podcast episode creation",
    icon: Mic,
    color: "bg-red-500/10 text-red-500",
    tasks: [
      { title: "Episode Planning", description: "Plan topic and outline", status: "todo" },
      { title: "Guest Research", description: "Research guest background", status: "todo" },
      { title: "Pre-Interview", description: "Brief guest on format", status: "todo" },
      { title: "Recording Setup", description: "Test equipment and audio levels", status: "todo" },
      { title: "Record Episode", description: "Record main podcast episode", status: "todo" },
      { title: "Audio Editing", description: "Edit and clean up audio", status: "todo" },
      { title: "Show Notes", description: "Write episode description and links", status: "todo" },
      { title: "Publish", description: "Upload to hosting platform", status: "todo" },
    ],
    milestones: [
      { title: "Recording Complete", description: "Episode recorded", amount: 40 },
      { title: "Editing Complete", description: "Audio edited and mixed", amount: 40 },
      { title: "Published", description: "Episode live on platforms", amount: 20 },
    ],
  },
];

export const ProjectTemplates = ({ onSelect }: { onSelect?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !projectTitle.trim()) return;

    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();

    try {
      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: projectTitle,
          description: selectedTemplate.description,
          created_by: user?.id,
          status: 'active',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create tasks
      const tasksToInsert = selectedTemplate.tasks.map(task => ({
        project_id: project.id,
        created_by: user?.id,
        title: task.title,
        description: task.description,
        status: task.status,
      }));

      const { error: tasksError } = await supabase
        .from('project_tasks')
        .insert(tasksToInsert);

      if (tasksError) throw tasksError;

      // Create milestones
      const milestonesToInsert = selectedTemplate.milestones.map((milestone, index) => ({
        project_id: project.id,
        created_by: user?.id,
        title: milestone.title,
        description: milestone.description,
        amount: milestone.amount,
        status: 'pending',
      }));

      const { error: milestonesError } = await supabase
        .from('milestones')
        .insert(milestonesToInsert);

      if (milestonesError) throw milestonesError;

      toast({
        title: "Project created!",
        description: `${projectTitle} created with ${tasksToInsert.length} tasks and ${milestonesToInsert.length} milestones`,
      });

      setOpen(false);
      onSelect?.();
      navigate(`/thrive-desk/${project.id}`);
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-12 rounded-xl font-semibold" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Create from Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Choose a Project Template</DialogTitle>
          <DialogDescription>Start your project with pre-built tasks and milestones</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          {!selectedTemplate ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-all"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader>
                    <div className={`h-12 w-12 rounded-lg ${template.color} flex items-center justify-center mb-2`}>
                      <template.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary">{template.tasks.length} tasks</Badge>
                      <Badge variant="secondary">{template.milestones.length} milestones</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4 p-1">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
                ← Back to templates
              </Button>
              
              <div className={`h-16 w-16 rounded-lg ${selectedTemplate.color} flex items-center justify-center`}>
                <selectedTemplate.icon className="h-8 w-8" />
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">{selectedTemplate.name}</h3>
                <p className="text-muted-foreground">{selectedTemplate.description}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  placeholder={`e.g., "Summer Campaign Video" or "${selectedTemplate.name}"`}
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                />
              </div>

              <div>
                <h4 className="font-semibold mb-2">Included Tasks ({selectedTemplate.tasks.length})</h4>
                <div className="space-y-1 text-sm">
                  {selectedTemplate.tasks.slice(0, 5).map((task, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{task.title}</span>
                    </div>
                  ))}
                  {selectedTemplate.tasks.length > 5 && (
                    <p className="text-muted-foreground">+ {selectedTemplate.tasks.length - 5} more tasks</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Payment Milestones ({selectedTemplate.milestones.length})</h4>
                <div className="space-y-1 text-sm">
                  {selectedTemplate.milestones.map((milestone, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span>{milestone.title}</span>
                      <Badge variant="secondary">{milestone.amount}%</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleCreateFromTemplate}
                disabled={!projectTitle.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
