import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Globe, Sparkles, Eye, Loader2, Lock, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { TEMPLATES, isTemplateAccessible } from "@/components/creator-site/templateConfig";
import { hasCreatorProAccess } from "@/lib/subscriptionConfig";
// Templates imported from templateConfig.ts

interface SiteSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export const SiteSetupWizard = ({ open, onOpenChange, onComplete }: SiteSetupWizardProps) => {
  const { user, subscriptionInfo } = useAuth();
  const { toast } = useToast();
  const isCreatorPro = hasCreatorProAccess(subscriptionInfo.tier as any);
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState("bold-electric");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  // Load existing profile data
  useEffect(() => {
    if (!user || !open) return;
    supabase
      .from("profiles")
      .select("full_name, role, bio, username, site_headline, site_bio, site_template")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfileData(data);
          setHeadline(data.site_headline || data.role || "");
          setBio(data.site_bio || data.bio || "");
          setTemplate(data.site_template || "bold-electric");
          if (data.username) setUsername(data.username);
          else {
            // Auto-suggest username from name
            const suggested = (data.full_name || "")
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
              .slice(0, 20);
            setUsername(suggested);
          }
        }
      });
  }, [user?.id, open]);

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      // Available if no result or it's our own
      setUsernameAvailable(!data || data.user_id === user?.id);
      setCheckingUsername(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, user?.id]);

  const handlePublish = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        site_enabled: true,
        site_template: template,
        site_headline: headline || null,
        site_bio: bio || null,
        username: username.toLowerCase() || null,
      })
      .eq("user_id", user.id);

    if (error) {
      if (error.message?.includes("username")) {
        toast({ title: "Username unavailable", description: "Try a different username", variant: "destructive" });
      } else {
        toast({ title: "Failed to publish", variant: "destructive" });
      }
    } else {
      toast({ title: "Your site is live! 🎉" });
      onComplete();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const steps = [
    // Step 0: Choose Template
    {
      title: "Choose Your Look",
      subtitle: "Pick a template that matches your style",
      content: (
        <div className="space-y-3">
          {TEMPLATES.map((t) => {
            const accessible = isTemplateAccessible(t.id, isCreatorPro);
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (!accessible) {
                    toast({ title: "Creator Pro Template", description: `"${t.name}" requires Creator Pro.` });
                    return;
                  }
                  setTemplate(t.id);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  template === t.id
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : accessible ? "border-border hover:border-muted-foreground/30" : "border-border opacity-60 hover:opacity-80"
                }`}
              >
                <div className={`w-16 h-12 rounded-lg ${t.preview} border border-border/50 flex items-center justify-center shrink-0 shadow-sm`}>
                  <div className={`w-4 h-4 rounded-full ${t.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm">{t.name}</p>
                    {!accessible && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  {!accessible && <p className="text-[10px] text-primary mt-0.5">Creator Pro</p>}
                </div>
                {template === t.id && accessible && (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                )}
                {!accessible && <Crown className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      ),
    },
    // Step 1: Customize Content
    {
      title: "Make It Yours",
      subtitle: "Customize the headline and bio visitors see",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Headline</Label>
            <Input
              placeholder="e.g. Award-Winning Director & Visual Storyteller"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This replaces your role/title on the site
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Site Bio</Label>
            <Textarea
              placeholder="Write a compelling intro for your visitors..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              className="text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Focus on what you do for clients, not just about yourself
            </p>
          </div>
        </div>
      ),
    },
    // Step 2: Choose URL
    {
      title: "Claim Your URL",
      subtitle: "Pick a unique username for your site",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Username</Label>
            <div className="relative">
              <Input
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                className="text-sm pl-[140px]"
                maxLength={30}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                kretopia.com/
              </span>
            </div>
            {username.length >= 3 && (
              <div className="flex items-center gap-2 text-xs">
                {checkingUsername ? (
                  <span className="text-muted-foreground">Checking...</span>
                ) : usernameAvailable ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Available!
                  </span>
                ) : (
                  <span className="text-destructive">Already taken</span>
                )}
              </div>
            )}
            {username.length > 0 && username.length < 3 && (
              <p className="text-xs text-muted-foreground">Username must be at least 3 characters</p>
            )}
          </div>

          {/* Preview URL */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Your site will be live at:</p>
            <p className="text-sm font-mono font-medium">
              kretopia.com/{username || "your-username"}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium">Creator Pro Upgrade</p>
                <p className="text-xs text-muted-foreground">
                  Connect your own domain (yourdomain.com) with Creator Pro
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    // Step 3: Review & Publish
    {
      title: "Ready to Launch",
      subtitle: "Review your site and go live",
      content: (
        <div className="space-y-4">
          {/* Mini preview */}
          <div className={`rounded-xl overflow-hidden border border-border shadow-lg ${
            template === "bold-electric" ? "bg-[#0a0a0c] text-white" :
            template === "minimal-editorial" ? "bg-[#faf9f7] text-[#1a1a1a]" :
            "bg-white text-[#111]"
          }`}>
            <div className="p-6 space-y-2">
              <p className="text-xs uppercase tracking-widest opacity-50">{profileData?.full_name}</p>
              <h3 className="text-lg font-bold leading-tight">{headline || profileData?.role || "Creative Professional"}</h3>
              <p className="text-xs opacity-60 line-clamp-2">{bio || profileData?.bio || "Your bio will appear here"}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Template</span>
              <span className="font-medium">{TEMPLATES.find(t => t.id === template)?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">URL</span>
              <span className="font-mono text-xs">kretopia.com/{username}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary" className="text-xs">Ready to publish</Badge>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const canProceed = step === 0 || step === 1 || (step === 2 && username.length >= 3 && usernameAvailable) || step === 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-w-[95vw] p-0 gap-0 overflow-hidden">
        {/* Progress */}
        <div className="flex gap-1 px-6 pt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="px-6 pt-4 pb-2">
          <h2 className="text-lg font-bold">{currentStep.title}</h2>
          <p className="text-sm text-muted-foreground">{currentStep.subtitle}</p>
        </div>

        <div className="px-6 pb-4 max-h-[60vh] overflow-y-auto">
          {currentStep.content}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step < steps.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canProceed}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handlePublish} disabled={saving || !canProceed}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-1" />
              )}
              Publish Site
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
