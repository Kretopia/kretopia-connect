import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, CheckCircle2, ArrowRight, Globe, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";

const TEMPLATE_NAMES: Record<string, string> = {
  "bold-electric": "Bold Electric",
  "minimal-editorial": "Minimal Editorial",
  "portfolio-mosaic": "Portfolio Mosaic",
  "creative-director": "Creative Director",
  "artist-showcase": "Artist Showcase",
  "producer": "Producer",
  "agency": "Agency",
  "minimal-clean": "Minimal Clean",
  "photographer": "Photographer",
};

interface AIGeneratedSite {
  headline: string;
  bio: string;
  template: string;
  template_reason: string;
  sections: Array<{ id: string; label: string; visible: boolean }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export const AIWebsiteGenerator = ({ open, onOpenChange, onComplete }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'idle' | 'generating' | 'review' | 'publishing'>('idle');
  const [generated, setGenerated] = useState<AIGeneratedSite | null>(null);
  const [editedHeadline, setEditedHeadline] = useState("");
  const [editedBio, setEditedBio] = useState("");
  const [editedTemplate, setEditedTemplate] = useState("");
  const [publishing, setPublishing] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    setStep('generating');

    try {
      // Fetch all profile data in parallel
      const [profileRes, creditsRes, servicesRes, endorsementsRes, reviewsRes] = await Promise.all([
        supabase.from('profiles').select(PROFILE_SELECT).eq('user_id', user.id).maybeSingle(),
        supabase.from('credits').select('*').eq('user_id', user.id).order('year', { ascending: false }).limit(20),
        supabase.from('creator_services').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('credit_endorsements').select('*').eq('requested_by', user.id).eq('status', 'endorsed').limit(10),
        supabase.from('company_reviews').select('*').eq('company_id', user.id).eq('status', 'published').limit(10),
      ]);

      const { data, error } = await supabase.functions.invoke('generate-site', {
        body: {
          profile: profileRes.data || {},
          credits: creditsRes.data || [],
          services: servicesRes.data || [],
          endorsements: endorsementsRes.data || [],
          reviews: reviewsRes.data || [],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGenerated(data);
      setEditedHeadline(data.headline);
      setEditedBio(data.bio);
      setEditedTemplate(data.template);
      setStep('review');
    } catch (err: any) {
      console.error('AI generation error:', err);
      toast({
        title: "Generation failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
      setStep('idle');
    }
  };

  const handlePublish = async () => {
    if (!user || !generated) return;
    setPublishing(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        site_enabled: true,
        site_template: editedTemplate,
        site_headline: editedHeadline || null,
        site_bio: editedBio || null,
        site_sections: generated.sections as any,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: "Failed to publish", variant: "destructive" });
    } else {
      toast({ title: "Your site is live! 🎉" });
      onComplete();
      onOpenChange(false);
      setStep('idle');
      setGenerated(null);
    }
    setPublishing(false);
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      setStep('idle');
      setGenerated(null);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] max-w-[95vw] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Create My Website</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {step === 'idle' && "We'll analyze your profile, credits, and services to generate a professional website."}
            {step === 'generating' && "Analyzing your profile data and crafting your website..."}
            {step === 'review' && "Review your generated website content, then publish."}
          </p>
        </div>

        <div className="px-6 pb-4 max-h-[65vh] overflow-y-auto">
          {/* Idle — Start button */}
          {step === 'idle' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
                <p className="text-sm font-medium">What the AI will use:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Your profile & bio
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Verified credits
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Services & pricing
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Endorsements & reviews
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    The more data on your profile, the better your website will be. Add credits, services, and endorsements first for the best results.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Generating — loading state */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <Wand2 className="h-4 w-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Crafting your website...</p>
                <p className="text-xs text-muted-foreground mt-1">Analyzing credits, services, and professional history</p>
              </div>
            </div>
          )}

          {/* Review — editable preview */}
          {step === 'review' && generated && (
            <div className="space-y-5">
              {/* Template recommendation */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-primary uppercase tracking-wider">Recommended Template</p>
                </div>
                <p className="text-base font-semibold">{TEMPLATE_NAMES[generated.template] || generated.template}</p>
                <p className="text-xs text-muted-foreground mt-1">{generated.template_reason}</p>

                {/* Template override */}
                <div className="mt-3">
                  <select
                    value={editedTemplate}
                    onChange={(e) => setEditedTemplate(e.target.value)}
                    className="w-full text-xs border border-border rounded-md px-3 py-2 bg-background"
                  >
                    {Object.entries(TEMPLATE_NAMES).map(([id, name]) => (
                      <option key={id} value={id}>{name}{id === generated.template ? ' (recommended)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Editable headline */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Headline</Label>
                <Input
                  value={editedHeadline}
                  onChange={(e) => setEditedHeadline(e.target.value)}
                  className="text-sm font-medium"
                />
              </div>

              {/* Editable bio */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Site Bio</Label>
                <Textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  rows={4}
                  className="text-sm resize-none"
                />
              </div>

              {/* Section order preview */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Sections</Label>
                <div className="space-y-1">
                  {generated.sections.map((s) => (
                    <div key={s.id} className={`flex items-center gap-2 py-1.5 px-3 rounded text-sm ${s.visible ? '' : 'opacity-40'}`}>
                      <span className={`w-2 h-2 rounded-full ${s.visible ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      <span>{s.label}</span>
                      {!s.visible && <span className="text-xs text-muted-foreground">(hidden — no data)</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
            Cancel
          </Button>

          {step === 'idle' && (
            <Button size="sm" onClick={handleGenerate}>
              <Wand2 className="h-4 w-4 mr-1" />
              Generate My Website
            </Button>
          )}

          {step === 'review' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerate}>
                <Wand2 className="h-4 w-4 mr-1" /> Regenerate
              </Button>
              <Button size="sm" onClick={handlePublish} disabled={publishing}>
                {publishing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-1" />
                )}
                Publish Site
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
