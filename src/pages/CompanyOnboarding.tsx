import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { Building2, Camera, ArrowRight, ArrowLeft, CheckCircle2, Globe, MapPin, Users, Briefcase, Sparkles, Upload } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { cn } from "@/lib/utils";
import { INTENTS, normalizeIntents, type PrimaryIntent } from "@/lib/intents";
import { HIRING_GOALS, intentColumnsFor, mergeGoalIntents } from "@/lib/companyHiringGoal";

const STEPS = [
  { id: 1, title: "Company Info", icon: Building2 },
  { id: 2, title: "Details & Goals", icon: Sparkles },
];

const INDUSTRIES = [
  "Music & Audio", "Film & Video", "Photography", "Design & Creative",
  "Fashion & Beauty", "Gaming & Esports", "Advertising & Marketing",
  "Media & Publishing", "Events & Live Entertainment", "Tech & Software",
  "Education & Training", "Non-Profit & Social Impact", "Other",
];

const COMPANY_SIZES = [
  "Solo (1)", "2–10", "11–50", "51–200", "201–500", "500+",
];

export default function CompanyOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState("");

  // What this account already says it is here to do (profiles.primary_intents): the saved side of the goal question.
  const [savedIntents, setSavedIntents] = useState<PrimaryIntent[]>([]);

  const [form, setForm] = useState({
    company_name: "",
    company_industry: "",
    company_size: "",
    company_tagline: "",
    company_about: "",
    company_address: "",
    website: "",
    hiring_goal: "",
  });

  useEffect(() => {
    if (!user) return;
    const loadExisting = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_name, company_industry, company_size, company_tagline, company_about, company_address, website, company_logo_url, primary_intents, primary_intent")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setForm(prev => ({
          ...prev,
          company_name: data.company_name || "",
          company_industry: data.company_industry || "",
          company_size: data.company_size || "",
          company_tagline: data.company_tagline || "",
          company_about: data.company_about || "",
          company_address: data.company_address || "",
          website: data.website || "",
        }));
        if (data.company_logo_url) setLogoUrl(data.company_logo_url);
        setSavedIntents(normalizeIntents((data as any).primary_intents ?? (data as any).primary_intent));
      }
    };
    loadExisting();
  }, [user]);

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setTempImageUrl(url);
    setShowCropDialog(true);
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!user) return;
    setUploadingLogo(true);
    const ext = "webp";
    const path = `company-logos/${user.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, croppedBlob, { upsert: true, contentType: "image/webp" });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploadingLogo(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setLogoUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    setUploadingLogo(false);
  };

  const handleNext = () => {
    if (step === 1 && !form.company_name.trim()) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    // The chosen goal becomes the account's saved intent (the record Home, nudges and matching read); a missing,
    // "Other" or unknown choice leaves the saved intents exactly as they are.
    const intentColumns = intentColumnsFor(mergeGoalIntents(savedIntents, form.hiring_goal), savedIntents);
    const { error } = await supabase.from("profiles").update({
      company_name: form.company_name.trim(),
      company_industry: form.company_industry,
      company_size: form.company_size,
      company_tagline: form.company_tagline.trim(),
      company_about: form.company_about.trim(),
      company_address: form.company_address.trim(),
      website: form.website.trim(),
      company_logo_url: logoUrl || null,
      // `onboarding_completed` is the column. The field that used to be sent here, without the "d", is not a
      // column of profiles, so the whole update was rejected as an unknown column.
      onboarding_completed: true,
      ...(intentColumns ?? {}),
    } as any).eq("user_id", user.id);

    if (error) {
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (intentColumns) setSavedIntents(intentColumns.primary_intents);
    toast({ title: "Welcome to Kretopia!", description: "Your company page is ready." });
    // "/work" isn't a real route (App.tsx only defines "/desk" for
    // WorkHome/BrandWorkHome) — every brand finishing onboarding was
    // landing on CatchAllRedirect instead of their actual dashboard.
    navigate("/desk");
    setLoading(false);
  };

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO title="Set Up Your Company | Kretopia" description="Set up your company profile on Kretopia" />

      {/* Progress bar */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-primary">
              Step {step} of {STEPS.length}
            </span>
            <span className="text-xs text-muted-foreground">{STEPS[step - 1].title}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-6">

          {/* Step 1: Company Info */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Set up your company</h1>
                <p className="text-muted-foreground text-sm">Tell us about your organization so creators can find you.</p>
              </div>

              {/* Logo upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group cursor-pointer" onClick={() => document.getElementById("logo-input")?.click()}>
                  <Avatar className="h-24 w-24 rounded-2xl border-2 border-dashed border-border group-hover:border-primary transition-colors">
                    <AvatarImage src={logoUrl} className="object-cover rounded-2xl" />
                    <AvatarFallback className="rounded-2xl bg-muted">
                      {uploadingLogo ? <KretopiaSpinner className="h-6 w-6" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                    <Upload className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Upload your logo</p>
                <input id="logo-input" type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              </div>

              {/* Form fields */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="e.g. Acme Creative Studios"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label>Industry</Label>
                  <Select value={form.company_industry} onValueChange={v => setForm(f => ({ ...f, company_industry: v }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Company Size</Label>
                  <Select value={form.company_size} onValueChange={v => setForm(f => ({ ...f, company_size: v }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="How many people?" /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="company_address">Location</Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="company_address"
                      value={form.company_address}
                      onChange={e => setForm(f => ({ ...f, company_address: e.target.value }))}
                      placeholder="City, Country"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <div className="relative mt-1.5">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="website"
                      value={form.website}
                      onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                      placeholder="https://yourcompany.com"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleNext} className="w-full h-12 text-base font-semibold gap-2" size="lg">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Details & Goals */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center space-y-2">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-accent" />
                </div>
                <h1 className="text-2xl font-bold">Almost there!</h1>
                <p className="text-muted-foreground text-sm">A few more details to attract the best talent.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={form.company_tagline}
                    onChange={e => setForm(f => ({ ...f, company_tagline: e.target.value }))}
                    placeholder="e.g. We make stories that move people"
                    maxLength={120}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{form.company_tagline.length}/120</p>
                </div>

                <div>
                  <Label htmlFor="about">About Your Company</Label>
                  <Textarea
                    id="about"
                    value={form.company_about}
                    onChange={e => setForm(f => ({ ...f, company_about: e.target.value }))}
                    placeholder="What does your company do? What kind of creators do you work with?"
                    rows={4}
                    maxLength={1000}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{form.company_about.length}/1000</p>
                </div>

                <div>
                  <Label>What are you looking to do on Kretopia?</Label>
                  {savedIntents.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Currently set: {savedIntents.map((id) => INTENTS.find((i) => i.id === id)?.label).filter(Boolean).join(" + ")}. Pick a goal to update it.
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {HIRING_GOALS.map(({ label: goal }) => (
                      <button
                        key={goal}
                        onClick={() => setForm(f => ({ ...f, hiring_goal: f.hiring_goal === goal ? "" : goal }))}
                        className={cn(
                          "text-left px-4 py-3 rounded-xl border text-sm transition-all",
                          form.hiring_goal === goal
                            ? "border-primary bg-primary/5 text-foreground font-medium"
                            : "border-border bg-card hover:border-primary/30 text-muted-foreground"
                        )}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={handleFinish} disabled={loading} className="flex-1 h-12 text-base font-semibold gap-2" size="lg">
                  {loading ? <KretopiaSpinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {loading ? "Saving…" : "Launch Profile"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCropDialog && tempImageUrl && (
        <ImageCropDialog
          open={showCropDialog}
          onClose={() => setShowCropDialog(false)}
          imageUrl={tempImageUrl}
          onCropComplete={handleCroppedImage}
        />
      )}
    </div>
  );
}
