import { useState, useEffect } from "react";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, Wand2, ImagePlus, Sparkles } from "lucide-react";

interface EditOpportunityDialogProps {
  opportunityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditOpportunityDialog = ({ 
  opportunityId, 
  open, 
  onOpenChange,
  onSuccess
}: EditOpportunityDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [enhancingText, setEnhancingText] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    type: "job",
    description: "",
    compensation: "",
    location: "",
    requirements: "",
    skills: "",
    deliverables: "",
    duration: "",
    status: "active",
    barter_offering: "",
    barter_requesting: "",
    platform_requirements: [] as string[],
    min_followers: "",
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [existingImageUrl, setExistingImageUrl] = useState<string>("");

  useEffect(() => {
    if (open && opportunityId) {
      loadOpportunity();
    }
  }, [open, opportunityId]);

  const loadOpportunity = async () => {
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(OPPORTUNITY_PUBLIC_COLUMNS)
        .eq('id', opportunityId)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title || "",
        type: data.type || "job",
        description: data.description || "",
        compensation: data.compensation || "",
        location: data.location || "",
        requirements: data.requirements || "",
        skills: data.skills?.join(', ') || "",
        deliverables: data.deliverables || "",
        duration: data.duration || "",
        status: data.status || "active",
        barter_offering: (data as any).barter_offering || "",
        barter_requesting: (data as any).barter_requesting || "",
        platform_requirements: (data as any).platform_requirements || [],
        min_followers: (data as any).min_followers?.toString() || "",
      });
      
      if (data.image_url) {
        setExistingImageUrl(data.image_url);
        setImagePreview(data.image_url);
      }
    } catch (error) {
      console.error('Error loading opportunity:', error);
      toast({ title: "Error", description: "Failed to load opportunity details", variant: "destructive" });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAIEnhance = async () => {
    setEnhancingText(true);
    try {
      // Save current data first
      await handleSave();
      
      const { data, error } = await supabase.functions.invoke('enhance-gig', {
        body: { opportunity_id: opportunityId, mode: "enhance_text" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Reload with enhanced data
      await loadOpportunity();
      toast({ title: "Enhanced!", description: "Polished your gig listing" });
    } catch (error: any) {
      console.error('AI enhance error:', error);
      toast({ title: "Enhancement failed", description: error.message || "Try again shortly", variant: "destructive" });
    } finally {
      setEnhancingText(false);
    }
  };

  const handleAIGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      // Save current data first so AI has latest context
      await handleSave();

      const { data, error } = await supabase.functions.invoke('enhance-gig', {
        body: { opportunity_id: opportunityId, mode: "generate_image" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Reload to show new image
      await loadOpportunity();
      toast({ title: "Cover generated!", description: "Generated a cover image for your gig" });
    } catch (error: any) {
      console.error('AI image error:', error);
      toast({ title: "Image generation failed", description: error.message || "Try again shortly", variant: "destructive" });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("You must be logged in");

    let imageUrl = existingImageUrl;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(filePath);

      imageUrl = publicUrl;
    }

    const { error } = await supabase
      .from('opportunities')
      .update({
        title: formData.title,
        type: formData.type,
        description: formData.description,
        compensation: formData.compensation,
        location: formData.location,
        requirements: formData.requirements,
        skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        deliverables: formData.deliverables,
        duration: formData.duration,
        status: formData.status,
        image_url: imageUrl,
        barter_offering: formData.barter_offering || null,
        barter_requesting: formData.barter_requesting || null,
        platform_requirements: formData.platform_requirements.length > 0 ? formData.platform_requirements : null,
        min_followers: formData.min_followers ? parseInt(formData.min_followers) : null,
      } as any)
      .eq('id', opportunityId);

    if (error) throw error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleSave();
      toast({ title: "Success", description: "Opportunity updated successfully" });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error updating opportunity:', error);
      toast({ title: "Error", description: "Failed to update opportunity", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Opportunity</DialogTitle>
          <DialogDescription>Update your opportunity details</DialogDescription>
        </DialogHeader>
        
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* AI Actions Bar */}
            <div className="flex gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAIEnhance}
                disabled={enhancingText || generatingImage}
                className="flex-1 gap-2 text-xs"
              >
                {enhancingText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Smart Enhance
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAIGenerateImage}
                disabled={enhancingText || generatingImage}
                className="flex-1 gap-2 text-xs"
              >
                {generatingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Smart Cover
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required maxLength={100} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="job">Paid Job</SelectItem>
                  <SelectItem value="collab">Collaboration</SelectItem>
                  <SelectItem value="gig">Quick Gig</SelectItem>
                  <SelectItem value="project">Project-Based</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                  <SelectItem value="barter">Barter/Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'barter' && (
              <div className="space-y-3 p-3 rounded-xl border-2 border-dashed border-primary bg-primary/5">
                <p className="text-xs font-semibold text-primary dark:text-primary">Barter Details</p>
                <div className="space-y-2">
                  <Label htmlFor="edit-barter-offering">What You're Offering</Label>
                  <Input id="edit-barter-offering" value={formData.barter_offering} onChange={(e) => setFormData({ ...formData, barter_offering: e.target.value })} placeholder="e.g., Free dinner for 2" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-barter-requesting">What You Need in Return</Label>
                  <Input id="edit-barter-requesting" value={formData.barter_requesting} onChange={(e) => setFormData({ ...formData, barter_requesting: e.target.value })} placeholder="e.g., 1 Reel + 3 Stories" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-min-followers">Min. Followers (optional)</Label>
                  <Input id="edit-min-followers" type="number" value={formData.min_followers} onChange={(e) => setFormData({ ...formData, min_followers: e.target.value })} placeholder="e.g., 5000" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required rows={5} maxLength={1000} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compensation">Budget/Compensation</Label>
              <Input id="compensation" value={formData.compensation} onChange={(e) => setFormData({ ...formData, compensation: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea id="requirements" value={formData.requirements} onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input id="skills" value={formData.skills} onChange={(e) => setFormData({ ...formData, skills: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliverables">Deliverables</Label>
              <Textarea id="deliverables" value={formData.deliverables} onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })} rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration/Timeline</Label>
              <Input id="duration" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input id="image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => document.getElementById('image')?.click()} className="flex-1">
                    <Upload className="mr-2 h-4 w-4" />
                    {imageFile ? "Change Image" : existingImageUrl ? "Replace Image" : "Upload Image"}
                  </Button>
                  {(imageFile || existingImageUrl) && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setImageFile(null); setImagePreview(""); setExistingImageUrl(""); }} aria-label="Remove cover image">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {imagePreview && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                    <img src={imagePreview} alt="Opportunity cover image preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading || enhancingText || generatingImage}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>) : "Update Opportunity"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
