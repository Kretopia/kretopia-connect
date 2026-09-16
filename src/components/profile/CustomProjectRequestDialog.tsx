import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const PROJECT_TYPES = [
  "Music Production",
  "Video Production",
  "Graphic Design",
  "Photography",
  "Content Creation",
  "Consulting",
  "Coaching",
  "Custom Project",
  "Other",
];

const BUDGET_RANGES = [
  "Under $100",
  "$100 - $500",
  "$500 - $1,000",
  "$1,000 - $5,000",
  "$5,000+",
  "Let's discuss",
];

const TIMELINES = [
  "ASAP",
  "Within a week",
  "2-4 weeks",
  "1-3 months",
  "Flexible",
];

interface CustomProjectRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  creatorName: string;
}

export const CustomProjectRequestDialog = ({
  open,
  onOpenChange,
  creatorId,
  creatorName,
}: CustomProjectRequestDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [projectType, setProjectType] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [timeline, setTimeline] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!user) return;
    if (!description.trim()) {
      toast({ title: "Please describe your project", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_project_requests')
        .insert({
          requester_id: user.id,
          creator_id: creatorId,
          project_type: projectType || null,
          budget_range: budgetRange || null,
          timeline: timeline || null,
          description: description.trim(),
        });

      if (error) throw error;

      toast({
        title: "Request sent!",
        description: `${creatorName.split(' ')[0]} will review your project request.`,
      });
      onOpenChange(false);
      setProjectType(""); setBudgetRange(""); setTimeline(""); setDescription("");
    } catch (err) {
      console.error('Error submitting request:', err);
      toast({ title: "Error", description: "Could not submit request. Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Custom Project</DialogTitle>
          <DialogDescription>
            Tell {creatorName.split(' ')[0]} about your project and they'll get back to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Project Type</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger><SelectValue placeholder="What do you need?" /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Budget</Label>
              <Select value={budgetRange} onValueChange={setBudgetRange}>
                <SelectTrigger><SelectValue placeholder="Range" /></SelectTrigger>
                <SelectContent>
                  {BUDGET_RANGES.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timeline</Label>
              <Select value={timeline} onValueChange={setTimeline}>
                <SelectTrigger><SelectValue placeholder="When?" /></SelectTrigger>
                <SelectContent>
                  {TIMELINES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Project Description *</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={`Hi ${creatorName.split(' ')[0]}, I'd like to work with you on...`}
              rows={4}
            />
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
