import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Loader2, Upload, X, ArrowRightLeft, Handshake, Zap, Target, GraduationCap, UtensilsCrossed, Hotel, Gift, Instagram, Youtube, Music, Shield, Building2, UserSearch, ArrowRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AIJobDescriptionGenerator } from "@/components/opportunity/AIJobDescriptionGenerator";
import { useAuth } from "@/hooks/useAuth";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { useFeatureGate } from "@/hooks/useFeatureGate";

interface PostOpportunityDialogProps {
  variant?: "default" | "outline" | "hero";
  size?: "default" | "xl";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const GIG_TYPES = [
  { value: "barter", label: "Barter / Trade", description: "Offer something in exchange for content", icon: ArrowRightLeft },
  { value: "job", label: "Paid Gig", description: "Pay a creator for their work", icon: Briefcase },
  { value: "collab", label: "Collaboration", description: "Work together on a creative project", icon: Handshake },
];

const BARTER_OFFERING_EXAMPLES = [
  { icon: UtensilsCrossed, label: "Free Meal / Dining Experience" },
  { icon: Hotel, label: "Complimentary Stay / Room Night" },
  { icon: Gift, label: "Free Products / Services" },
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "tiktok", label: "TikTok", icon: Music },
  { value: "youtube", label: "YouTube", icon: Youtube },
];

const CONTENT_TYPE_OPTIONS = [
  "Instagram Story", "Instagram Reel", "Instagram Post", "Instagram Carousel",
  "TikTok Video", "YouTube Video", "YouTube Short",
  "Blog Post", "Review", "Photo Set", "Live Stream",
];

const USAGE_TYPES = [
  { value: "organic_social", label: "Organic Social" },
  { value: "paid_social", label: "Paid Social Ads" },
  { value: "ooh", label: "Out-of-Home (OOH)" },
  { value: "broadcast", label: "TV / Broadcast" },
  { value: "full_buyout", label: "Full Buyout" },
];
const USAGE_TERRITORIES = [
  { value: "local", label: "Local" },
  { value: "national", label: "National" },
  { value: "global", label: "Global" },
];
const USAGE_DURATIONS = [
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "1_year", label: "1 year" },
  { value: "perpetual", label: "Perpetual" },
];

export const PostOpportunityDialog = ({
  variant = "default",
  size = "default",
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  onSuccess
}: PostOpportunityDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscriptionInfo, user } = useAuth();
  const isPro = hasProAccess(subscriptionInfo.tier as any);
  const gigGate = useFeatureGate("gigPosts");
  const [accountType, setAccountType] = useState<"individual" | "company" | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("account_type, username")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled || !data) return;
        setAccountType((data.account_type as any) || "individual");
        setProfileUsername(data.username || null);
      } catch {
        // non-fatal: nudge just won't render
      }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  const isCompany = accountType === "company";

  const [formData, setFormData] = useState({
    email: "",
    company: "",
    title: "",
    type: "",
    description: "",
    compensation: "",
    location: "",
    requirements: "",
    skills: "",
    deliverables: "",
    duration: "",
    // Barter-specific
    barter_offering: "",
    barter_requesting: "",
    platform_requirements: [] as string[],
    min_followers: "",
    content_deliverables: [] as string[],
    // Usage rights
    usage_type: "",
    usage_territory: "",
    usage_duration: "",
    usage_exclusive: false,
    // Structured barter
    barter_gifted_value_usd: "",
    barter_posting_deadline: "",
    application_deadline: "",
    whitelisting_allowed: false,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    const checkPendingOpportunity = async () => {
      const pendingData = localStorage.getItem('pendingOpportunity');
      if (pendingData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const savedData = JSON.parse(pendingData);
          setFormData(prev => ({ ...prev, ...savedData.formData }));
          if (savedData.imagePreview) setImagePreview(savedData.imagePreview);
          localStorage.removeItem('pendingOpportunity');
          setOpen(true);
          toast({ title: "Welcome back!", description: "Your gig is ready to post." });
        }
      }
    };
    checkPendingOpportunity();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const togglePlatform = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platform_requirements: prev.platform_requirements.includes(platform)
        ? prev.platform_requirements.filter(p => p !== platform)
        : [...prev.platform_requirements, platform],
    }));
  };

  const toggleContentDeliverable = (item: string) => {
    setFormData(prev => ({
      ...prev,
      content_deliverables: prev.content_deliverables.includes(item)
        ? prev.content_deliverables.filter(d => d !== item)
        : [...prev.content_deliverables, item],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isFreePost = formData.type === "barter" || formData.type === "collab";
    if (isFreePost && !gigGate.guard()) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        localStorage.setItem('pendingOpportunity', JSON.stringify({ formData, imagePreview }));
        toast({ title: "Almost there!", description: "Please sign up or log in to post your gig." });
        setLoading(false);
        setOpen(false);
        navigate('/auth?return=post-opportunity');
        return;
      }

      // Moderation
      const { data: moderationData, error: moderationError } = await supabase.functions.invoke('moderate-opportunity', {
        body: { title: formData.title, description: formData.description, compensation: formData.compensation }
      });
      if (moderationError) throw moderationError;
      if (moderationData?.flagged) {
        toast({ title: "Content Flagged", description: moderationData.reason || "Your post contains content that violates our guidelines.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Image upload or AI generation
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('portfolio').upload(filePath, imageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(filePath);
        imageUrl = publicUrl;
      } else {
        const { data: aiImageData, error: aiError } = await supabase.functions.invoke('generate-opportunity-image', {
          body: { title: formData.title, description: formData.description, type: formData.type }
        });
        if (!aiError && aiImageData?.image) {
          const base64Data = aiImageData.image.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
          const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
          const filePath = `${user.id}/${Math.random()}.png`;
          const { error: uploadError } = await supabase.storage.from('portfolio').upload(filePath, blob);
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(filePath);
            imageUrl = publicUrl;
          }
        }
      }

      // Build compensation string for barter
      let compensation = formData.compensation;
      if (formData.type === "barter" && formData.barter_offering && !compensation) {
        compensation = formData.barter_offering;
      }

      // Build deliverables string
      let deliverables = formData.deliverables;
      if (formData.content_deliverables.length > 0 && !deliverables) {
        deliverables = formData.content_deliverables.join(", ");
      }

      const { data: newOpportunity, error: opportunityError } = await supabase
        .from('opportunities')
        .insert({
          title: formData.title,
          type: formData.type,
          description: formData.description,
          compensation,
          location: formData.location,
          requirements: formData.requirements,
          skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
          deliverables,
          duration: formData.duration,
          tags: formData.company ? [formData.company] : [],
          status: 'active',
          image_url: imageUrl,
          created_by: user.id,
          barter_offering: formData.barter_offering || null,
          barter_requesting: formData.barter_requesting || null,
          platform_requirements: formData.platform_requirements.length > 0 ? formData.platform_requirements : null,
          min_followers: formData.min_followers ? parseInt(formData.min_followers) : null,
          content_deliverables: formData.content_deliverables.length > 0 ? JSON.stringify(formData.content_deliverables) : null,
          usage_type: formData.usage_type || null,
          usage_territory: formData.usage_territory || null,
          usage_duration: formData.usage_duration || null,
          usage_exclusive: formData.usage_exclusive,
          barter_gifted_value_usd: formData.barter_gifted_value_usd ? parseFloat(formData.barter_gifted_value_usd) : null,
          barter_posting_deadline: formData.barter_posting_deadline || null,
          application_deadline: formData.application_deadline || null,
          whitelisting_allowed: formData.whitelisting_allowed,
        } as any)
        .select()
        .single();

      if (opportunityError) throw opportunityError;

      if (newOpportunity) {
        const { analytics } = await import("@/lib/analytics");
        analytics.opportunityCreate(newOpportunity.id);
      }

      toast({ title: "Gig Posted!", description: "Your gig is now live on Kretopia." });

      // Reset
      setFormData({
        email: "", company: "", title: "", type: "", description: "", compensation: "",
        location: "", requirements: "", skills: "", deliverables: "", duration: "",
        barter_offering: "", barter_requesting: "", platform_requirements: [],
        min_followers: "", content_deliverables: [],
        usage_type: "", usage_territory: "", usage_duration: "", usage_exclusive: false,
        barter_gifted_value_usd: "", barter_posting_deadline: "", application_deadline: "", whitelisting_allowed: false,
      });
      setImageFile(null);
      setImagePreview("");
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error posting gig:', error);
      toast({ title: "Failed to Post", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isBarter = formData.type === "barter";
  const isPaid = formData.type === "job" || formData.type === "gig";
  const isCollab = formData.type === "collab";
  const hasType = formData.type !== "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Post a Gig</DialogTitle>
          <DialogDescription>What kind of opportunity are you posting?</DialogDescription>
        </DialogHeader>

        {/* Smart nudge — account-aware shortcuts */}
        {user && accountType && (
          <div className="space-y-2">
            {isCompany ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(profileUsername ? `/u/${profileUsername}` : "/profile");
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              >
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">Posting as your Brand Page</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Tap to review your brand profile before going live.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/talent-finder");
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/40 transition-colors text-left"
            >
              <div className="shrink-0 w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                <UserSearch className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  Hiring talent? Try Smart Talent Finder
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Describe who you need and get a curated shortlist — faster than posting a gig.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        )}


        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Type Selection (visual cards) */}
          {!hasType ? (
            <div className="grid grid-cols-1 gap-2">
              {GIG_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Type indicator + change */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {GIG_TYPES.find(t => t.value === formData.type)?.label}
                  </Badge>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, type: "" }))}>
                  Change
                </Button>
              </div>

              {/* AI Generator */}
              <AIJobDescriptionGenerator
                isPro={isPro}
                onGenerated={(data) => {
                  setFormData(prev => ({
                    ...prev,
                    title: data.title || prev.title,
                    description: data.description || prev.description,
                    requirements: data.requirements || prev.requirements,
                    deliverables: data.deliverables || prev.deliverables,
                    skills: data.skills?.join(", ") || prev.skills,
                    compensation: data.compensation || prev.compensation,
                  }));
                }}
              />

              {/* Common fields */}
              <div className="space-y-2">
                <Label htmlFor="post-title">
                  {isBarter ? "Campaign Title *" : isPaid ? "Job Title *" : isCollab ? "Project Title *" : "Title *"}
                </Label>
                <Input
                  id="post-title"
                  placeholder={
                    isBarter ? "e.g., Free Dinner for 2 in exchange for Reel + Stories"
                    : isPaid ? "e.g., DJ needed for Saturday night event"
                    : isCollab ? "e.g., Music video — need videographer + editor"
                    : "e.g., Looking for Videographer"
                  }
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  maxLength={100}
                />
              </div>

              {/* Barter-specific: What You're Offering */}
              {isBarter && (
                <div className="space-y-3 p-3 rounded-xl border-2 border-dashed border-primary bg-primary/5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary dark:text-primary">
                    <Gift className="h-4 w-4" />
                    The Exchange
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barter-offering">What You're Offering *</Label>
                    <Input
                      id="barter-offering"
                      placeholder="e.g., Complimentary 2-night stay at our villa, Free dinner for 2"
                      value={formData.barter_offering}
                      onChange={(e) => setFormData(prev => ({ ...prev, barter_offering: e.target.value }))}
                      required={isBarter}
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {BARTER_OFFERING_EXAMPLES.map(ex => (
                        <button
                          key={ex.label}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, barter_offering: ex.label }))}
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                        >
                          <ex.icon className="h-3 w-3" />
                          {ex.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barter-requesting">What You Need in Return *</Label>
                    <Input
                      id="barter-requesting"
                      placeholder="e.g., 1 Instagram Reel + 3 Stories tagging our venue"
                      value={formData.barter_requesting}
                      onChange={(e) => setFormData(prev => ({ ...prev, barter_requesting: e.target.value }))}
                      required={isBarter}
                    />
                  </div>

                  {/* Content type chips */}
                  <div className="space-y-2">
                    <Label className="text-xs">Content Types Needed</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CONTENT_TYPE_OPTIONS.map(item => {
                        const isSelected = formData.content_deliverables.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleContentDeliverable(item)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Platform requirements */}
                  <div className="space-y-2">
                    <Label className="text-xs">Required Platforms</Label>
                    <div className="flex gap-2">
                      {PLATFORM_OPTIONS.map(p => {
                        const isSelected = formData.platform_requirements.includes(p.value);
                        const Icon = p.icon;
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => togglePlatform(p.value)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Min followers */}
                  <div className="space-y-2">
                    <Label htmlFor="min-followers" className="text-xs">Minimum Followers (optional)</Label>
                    <Input
                      id="min-followers"
                      type="number"
                      placeholder="e.g., 5000"
                      value={formData.min_followers}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_followers: e.target.value }))}
                    />
                  </div>

                  {/* Structured barter terms */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="gifted-value" className="text-xs">Gifted Value (USD)</Label>
                      <Input
                        id="gifted-value"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g., 250"
                        value={formData.barter_gifted_value_usd}
                        onChange={(e) => setFormData(prev => ({ ...prev, barter_gifted_value_usd: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="post-deadline" className="text-xs">Posting Deadline</Label>
                      <Input
                        id="post-deadline"
                        type="date"
                        value={formData.barter_posting_deadline}
                        onChange={(e) => setFormData(prev => ({ ...prev, barter_posting_deadline: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-background/50 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">Whitelisting / paid amplification</p>
                      <p className="text-[10px] text-muted-foreground">Brand can boost creator's post as paid ads</p>
                    </div>
                    <Switch
                      checked={formData.whitelisting_allowed}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, whitelisting_allowed: v }))}
                    />
                  </div>
                </div>
              )}

              {/* Paid-specific: Budget */}
              {isPaid && (
                <div className="space-y-2 p-3 rounded-xl border-2 border-dashed border-green-300 bg-green-500/5">
                  <Label htmlFor="compensation" className="flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-300">
                    Budget / Compensation *
                  </Label>
                  <Input
                    id="compensation"
                    placeholder="e.g., $500, $200-500/night, Revenue share"
                    value={formData.compensation}
                    onChange={(e) => setFormData(prev => ({ ...prev, compensation: e.target.value }))}
                    required={isPaid}
                  />
                </div>
              )}

              {/* Collab-specific */}
              {isCollab && (
                <div className="space-y-2 p-3 rounded-xl border-2 border-dashed border-primary bg-primary/5">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary">
                    Collaboration Details
                  </Label>
                  <Input
                    placeholder="What do you bring to the table? e.g., Studio time, beats, location"
                    value={formData.compensation}
                    onChange={(e) => setFormData(prev => ({ ...prev, compensation: e.target.value }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="post-description">Description *</Label>
                <Textarea
                  id="post-description"
                  placeholder={
                    isBarter ? "Describe the experience you're offering and what kind of creator you're looking for..."
                    : isPaid ? "Describe the gig, what's expected, and any important details..."
                    : "Describe the project and what you're looking for..."
                  }
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  required
                  rows={4}
                  maxLength={1000}
                />
              </div>

              {/* Non-barter compensation */}
              {!isPaid && !isCollab && !isBarter && (
                <div className="space-y-2">
                  <Label htmlFor="compensation-other">Budget / Compensation</Label>
                  <Input
                    id="compensation-other"
                    placeholder="e.g., $500, Revenue share, Credit"
                    value={formData.compensation}
                    onChange={(e) => setFormData(prev => ({ ...prev, compensation: e.target.value }))}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="post-location">Location</Label>
                  <Input
                    id="post-location"
                    placeholder="e.g., Bali, Remote"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-duration">Duration</Label>
                  <Input
                    id="post-duration"
                    placeholder="e.g., 1 day, 1 week"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="application-deadline" className="flex items-center gap-2">
                  Application Deadline
                  <span className="text-[10px] font-normal text-muted-foreground">(optional — auto-closes the gig after this date)</span>
                </Label>
                <Input
                  id="application-deadline"
                  type="date"
                  value={formData.application_deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, application_deadline: e.target.value }))}
                />
              </div>
              <div className="space-y-3 p-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-500/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  <Shield className="h-4 w-4" />
                  Usage Rights <span className="text-[10px] font-normal text-muted-foreground">(optional but recommended)</span>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-1">Tell creators exactly how their work will be used so they can price fairly.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide">Usage</Label>
                    <Select value={formData.usage_type} onValueChange={(v) => setFormData(prev => ({ ...prev, usage_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {USAGE_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide">Territory</Label>
                    <Select value={formData.usage_territory} onValueChange={(v) => setFormData(prev => ({ ...prev, usage_territory: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {USAGE_TERRITORIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide">Duration</Label>
                    <Select value={formData.usage_duration} onValueChange={(v) => setFormData(prev => ({ ...prev, usage_duration: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {USAGE_DURATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background/50 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">Exclusive usage</p>
                    <p className="text-[10px] text-muted-foreground">Creator can't work with competing brands during the term</p>
                  </div>
                  <Switch
                    checked={formData.usage_exclusive}
                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, usage_exclusive: v }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-skills">Skills Needed (comma-separated)</Label>
                <Input
                  id="post-skills"
                  placeholder="e.g., Photography, Content Creation, Video Editing"
                  value={formData.skills}
                  onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
                />
              </div>

              {!isBarter && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="post-requirements">Requirements</Label>
                    <Textarea
                      id="post-requirements"
                      placeholder="e.g., 5k+ followers, 2+ years experience"
                      value={formData.requirements}
                      onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-deliverables">Deliverables</Label>
                    <Textarea
                      id="post-deliverables"
                      placeholder="e.g., 3 Instagram posts, 1 YouTube video"
                      value={formData.deliverables}
                      onChange={(e) => setFormData(prev => ({ ...prev, deliverables: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </>
              )}

              {/* Image upload */}
              <div className="space-y-2">
                <Label>Cover Image</Label>
                <div className="flex flex-col gap-2">
                  <Input id="post-image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => document.getElementById('post-image')?.click()} className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    {imageFile ? "Change Image" : "Upload Image"}
                  </Button>
                  {imageFile && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setImageFile(null); setImagePreview(""); }}>
                      <X className="mr-1 h-3 w-3" /> Remove
                    </Button>
                  )}
                  {imagePreview && (
                    <div className="relative w-full h-36 rounded-lg overflow-hidden border">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {!imageFile && (
                    <p className="text-[10px] text-muted-foreground text-center">No image? We'll generate one with AI</p>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...</>
                ) : (
                  isBarter ? "Post Barter Gig" : isPaid ? "Post Paid Gig" : isCollab ? "Post Collaboration" : "Post Gig"
                )}
              </Button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
