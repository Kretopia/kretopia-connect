import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Loader2, X } from "lucide-react";
import { AIJobDescriptionGenerator } from "@/components/opportunity/AIJobDescriptionGenerator";
import { useAuth } from "@/hooks/useAuth";
import { hasProAccess } from "@/lib/subscriptionConfig";

interface PostAsOpportunityDialogProps {
  projectId: string;
  projectTitle: string;
  projectDescription?: string;
}

export function PostAsOpportunityDialog({ 
  projectId, 
  projectTitle, 
  projectDescription 
}: PostAsOpportunityDialogProps) {
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [formData, setFormData] = useState({
    title: projectTitle,
    description: projectDescription || "",
    type: "collaboration",
    compensation: "",
    skills: [] as string[],
    requirements: "",
    deliverables: "",
  });
  const [skillInput, setSkillInput] = useState("");
  const { toast } = useToast();
  const { subscriptionInfo } = useAuth();
  const isPro = hasProAccess(subscriptionInfo.tier as any);

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      });
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skill),
    });
  };

  const handlePost = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in title and description",
        variant: "destructive",
      });
      return;
    }

    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create opportunity linked to project
      const { error } = await supabase
        .from("opportunities")
        .insert({
          created_by: user.id,
          title: formData.title,
          description: formData.description,
          type: formData.type,
          compensation: formData.compensation || null,
          skills: formData.skills,
          requirements: formData.requirements || null,
          deliverables: formData.deliverables || null,
          status: "active",
          tags: [`project:${projectId}`], // Link back to project
        });

      if (error) throw error;

      toast({
        title: "Posted successfully!",
        description: "Your project is now visible in the Discover section",
      });
      setOpen(false);
    } catch (error: any) {
      console.error("Error posting opportunity:", error);
      toast({
        title: "Failed to post",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Briefcase className="h-4 w-4" />
          Find Collaborators
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post Project as Opportunity</DialogTitle>
          <DialogDescription>
            Share your project on the Discover page to find collaborators from your circle and beyond
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <AIJobDescriptionGenerator
            isPro={isPro}
            onGenerated={(data) => {
              setFormData((prev) => ({
                ...prev,
                title: data.title || prev.title,
                description: data.description || prev.description,
                requirements: data.requirements || prev.requirements,
                deliverables: data.deliverables || prev.deliverables,
                skills: data.skills?.length ? data.skills : prev.skills,
                compensation: data.compensation || prev.compensation,
              }));
            }}
          />

          <div className="space-y-2">
            <Label htmlFor="title">Opportunity Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Looking for Video Editor for Music Video"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what you're looking for..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Opportunity Type</Label>
            <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="job">Paid Job</SelectItem>
                <SelectItem value="collaboration">Collaboration</SelectItem>
                <SelectItem value="barter">Barter/Trade</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="compensation">Compensation</Label>
            <Input
              id="compensation"
              value={formData.compensation}
              onChange={(e) => setFormData({ ...formData, compensation: e.target.value })}
              placeholder="e.g., $500-1000, Revenue share, Credit only"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills">Required Skills</Label>
            <div className="flex gap-2">
              <Input
                id="skills"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                placeholder="Add a skill and press Enter"
              />
              <Button type="button" onClick={handleAddSkill} variant="outline">
                Add
              </Button>
            </div>
            {formData.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveSkill(skill)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              placeholder="Any specific requirements or qualifications..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverables">Deliverables</Label>
            <Textarea
              id="deliverables"
              value={formData.deliverables}
              onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
              placeholder="What will the collaborator deliver..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1" disabled={posting}>
              Cancel
            </Button>
            <Button onClick={handlePost} className="flex-1" disabled={posting}>
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Post Opportunity
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
