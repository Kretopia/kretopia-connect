import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Building2, CheckCircle2, Loader2, Mail, X, Upload, Crop, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { AIJobDescriptionGenerator } from "@/components/opportunity/AIJobDescriptionGenerator";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { CastingFieldsForm, type CastingFields } from "@/components/opportunity/CastingFieldsForm";
import { PageTransition } from "@/components/PageTransition";
import { EditorialPageHero } from "@/components/kretopia/EditorialPageHero";
import { EditorialChapter } from "@/components/kretopia/EditorialChapter";
import { Reveal } from "@/components/kretopia/Reveal";
import { SectionHeading } from "@/components/typography/Heading";

const ACCENT = "hsl(var(--energy))";

const NOTES = [
  { icon: ShieldCheck, title: "Verified credits", body: "Every creative is backed by co-signed work — you see proof, not promises." },
  { icon: Sparkles, title: "Written for you", body: "Kreto drafts the brief from a sentence. You edit, you post." },
  { icon: Users, title: "Matched, not shouted", body: "Your listing reaches the people whose record actually fits the job." },
  { icon: Zap, title: "No account needed", body: "Verify your email and the listing is live in minutes." },
];


const STORAGE_KEY = "thrivein_draft_opportunity";

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveDraft(data: Record<string, unknown>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function clearDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const PostOpportunity = () => {
  const draft = loadDraft();
  const [step, setStep] = useState<"form" | "sent" | "error">("form");
  const [posting, setPosting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [rawImageUrl, setRawImageUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [showLogoCropDialog, setShowLogoCropDialog] = useState(false);
  const [rawLogoUrl, setRawLogoUrl] = useState<string>("");
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    company_name: draft?.company_name || "",
    email: draft?.email || "",
    logo_url: draft?.logo_url || "",
    title: draft?.title || "",
    description: draft?.description || "",
    type: draft?.type || "collab",
    compensation: draft?.compensation || "",
    skills: (draft?.skills as string[]) || ([] as string[]),
    requirements: draft?.requirements || "",
    deliverables: draft?.deliverables || "",
    location: draft?.location || "remote",
    location_city: draft?.location_city || "",
    location_country: draft?.location_country || "",
    image_url: draft?.image_url || "",
  });
  const [casting, setCasting] = useState<CastingFields>(draft?.casting || {});
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscriptionInfo, user } = useAuth();
  const isPro = hasProAccess(subscriptionInfo.tier as any);

  // Auto-save draft on every form change
  useEffect(() => {
    saveDraft({ ...formData, casting });
  }, [formData, casting]);

  // This page was built for anonymous, no-account visitors (email
  // verification, re-typed company name) — but the app's own "Post a Gig"
  // buttons (BrandWorkHome, Smart Talent Finder) send an ALREADY logged-in
  // user here too. Pre-fill what the account already knows so a real user
  // isn't asked to retype their own company name/email; the submit path
  // below skips the email-verification step for them entirely. Guests
  // (no user) get the exact same behavior as before, unchanged.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_name, full_name, company_logo_url, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return;
      setFormData((prev) => ({
        ...prev,
        company_name: prev.company_name || data.company_name || data.full_name || "",
        email: prev.email || user.email || "",
        logo_url: prev.logo_url || data.company_logo_url || data.avatar_url || "",
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Warn before leaving page with data
  useEffect(() => {
    const hasData = formData.title.trim() || formData.description.trim() || formData.company_name.trim();
    if (!hasData) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formData.title, formData.description, formData.company_name]);

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Image must be under 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawImageUrl(reader.result as string);
        setShowCropDialog(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "cover.jpg", { type: "image/jpeg" });
    setImageFile(file);
    setFormData({ ...formData, image_url: "" });
    const url = URL.createObjectURL(croppedBlob);
    setImagePreview(url);
    setShowCropDialog(false);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    setFormData({ ...formData, image_url: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Image must be under 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawLogoUrl(reader.result as string);
        setShowLogoCropDialog(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "logo.jpg", { type: "image/jpeg" });
    setLogoFile(file);
    setFormData({ ...formData, logo_url: "" });
    const url = URL.createObjectURL(croppedBlob);
    setLogoPreview(url);
    setShowLogoCropDialog(false);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    setFormData({ ...formData, logo_url: "" });
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
  };

  // Authenticated users skip the guest email-verification round-trip
  // entirely — the account is already verified, so the listing goes live
  // immediately. Mirrors PostOpportunityDialog's insert (the other,
  // already-shipped authenticated posting path): moderation check first,
  // upload any image/logo to the user's own storage folder, then insert
  // directly with created_by set and status already "active".
  const submitAuthenticated = async () => {
    const { data: moderation, error: moderationError } = await supabase.functions.invoke("moderate-opportunity", {
      body: { title: formData.title, description: formData.description, compensation: formData.compensation },
    });
    if (moderationError) throw moderationError;
    if (moderation?.flagged) {
      throw new Error(moderation.reason || "Your post contains content that violates our guidelines.");
    }

    const uploadToPortfolio = async (file: File, label: string) => {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user!.id}/${label}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("portfolio").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
      return publicUrl;
    };

    const uploadedImageUrl = imageFile ? await uploadToPortfolio(imageFile, "opportunity-cover") : null;
    const uploadedLogoUrl = logoFile ? await uploadToPortfolio(logoFile, "opportunity-logo") : null;

    const { data: newOpportunity, error: insertError } = await supabase
      .from("opportunities")
      .insert({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        compensation: formData.compensation || null,
        skills: formData.skills,
        requirements: formData.requirements || null,
        deliverables: formData.deliverables || null,
        location: formData.location,
        location_city: formData.location_city || null,
        location_country: formData.location_country || null,
        image_url: uploadedImageUrl || formData.image_url || null,
        status: "active",
        created_by: user!.id,
        tags: formData.company_name ? [formData.company_name] : [],
        ...(formData.type === "casting" ? casting : {}),
      } as any)
      .select()
      .single();

    if (insertError) throw insertError;

    if (newOpportunity) {
      const { analytics } = await import("@/lib/analytics");
      analytics.opportunityCreate(newOpportunity.id);
    }

    clearDraft();
    toast({ title: "Opportunity posted!", description: "Your listing is live on Kretopia right now." });
    navigate(`/opportunity/${newOpportunity.id}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_name.trim() || !formData.email.trim() || !formData.title.trim() || !formData.description.trim()) {
      toast({ title: "Missing fields", description: "Please fill in company name, email, title, and description.", variant: "destructive" });
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setPosting(true);
    try {
      if (user) {
        await submitAuthenticated();
        return;
      }

      // Guest path — unchanged: create a pending listing and email a
      // verification link before it goes live.
      const fileToBase64 = (file: File) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      const imageData = imageFile ? await fileToBase64(imageFile) : null;
      const logoData = logoFile ? await fileToBase64(logoFile) : null;

      const { data, error } = await supabase.functions.invoke("verify-guest-opportunity", {
        body: { action: "send-verification", ...formData, ...(formData.type === "casting" ? casting : {}), image_data: imageData, logo_data: logoData },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      clearDraft();
      setStep("sent");
    } catch (error: any) {
      console.error("Error posting:", error);
      toast({ title: "Something went wrong", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  if (step === "sent") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Helmet>
          <title>Check Your Email | Kretopia</title>
        </Helmet>
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email! </CardTitle>
            <CardDescription className="text-base">
              We sent a verification link to <strong>{formData.email}</strong>. Click it to publish your opportunity and start receiving applications from top creatives.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Didn't get it? Check your spam folder or{" "}
              <button onClick={() => setStep("form")} className="text-foreground underline hover:text-[hsl(var(--energy))] transition-colors">
                try again
              </button>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Hire Talent — Post an Opportunity | Kretopia</title>
        <meta name="description" content="Post a job, collaboration, or gig opportunity on Kretopia and connect with thousands of creative professionals. No account needed." />
      </Helmet>

      <EditorialPageHero
        kicker="Hire Talent"
        oneLine
        title="Hire talent."
        accentTitle="Backed by proof."
        subtitle={
          user
            ? "Post your opportunity and reach creatives whose work is already on the record. Goes live immediately."
            : "Post your opportunity and reach creatives whose work is already on the record. No account needed — just verify your email."
        }
      />

      {/* I — The brief */}
      <EditorialChapter index="I" kicker="The brief" title="Tell us who you need." accentWord="Kreto writes the rest.">
        <form onSubmit={handleSubmit} className="w-full">
          <Reveal>
            <div className="rounded-2xl border border-border bg-foreground/[0.02] overflow-hidden">
              {/* AI-powered brief writer — anchored at the top as the primary action */}
              <div className="p-5 sm:p-8 border-b border-border bg-gradient-to-r from-[hsl(var(--energy)/0.08)] via-transparent to-transparent">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--energy)/0.12)]">
                    <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
                  </span>
                  <div>
                    <p className="text-foreground font-semibold text-sm">Start with Kreto</p>
                    <p className="text-foreground/50 text-xs">Describe the gig in plain language. Kreto drafts the rest.</p>
                  </div>
                </div>
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
              </div>

              <div className="p-5 sm:p-8 space-y-8">
                {/* Section: Company */}
                <section className="space-y-5">
                  <SectionHeading as="h3" icon={<Building2 className="h-4 w-4" style={{ color: ACCENT }} />}>
                    Your Company
                  </SectionHeading>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="company_name">Company Name *</Label>
                      <Input
                        id="company_name"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        placeholder="e.g., Acme Studios"
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="email">Work Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="you@company.com"
                        maxLength={255}
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="logo_upload">Logo (optional)</Label>
                      <input
                        ref={logoFileInputRef}
                        id="logo_upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoSelect}
                        className="hidden"
                      />
                      {logoPreview || formData.logo_url ? (
                        <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-border group">
                          <img
                            src={logoPreview || formData.logo_url}
                            alt="Logo preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => logoFileInputRef.current?.click()}
                              className="text-white/90 hover:text-white"
                              aria-label="Replace logo"
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={clearLogo}
                              className="text-white/90 hover:text-white"
                              aria-label="Remove logo"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="w-full h-10 border-2 border-dashed border-border rounded-lg flex items-center justify-center gap-1.5 text-foreground/50 hover:border-[hsl(var(--energy)/0.5)] hover:text-foreground transition-colors text-xs font-medium"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <div className="h-px bg-border" />

                {/* Section: Opportunity */}
                <section className="space-y-5">
                  <SectionHeading as="h3" icon={<Briefcase className="h-4 w-4" style={{ color: ACCENT }} />}>
                    Opportunity
                  </SectionHeading>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Looking for Video Editor for Music Video"
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="job">Paid Job</SelectItem>
                          <SelectItem value="collab">Collaboration</SelectItem>
                          <SelectItem value="barter">Barter/Trade</SelectItem>
                          <SelectItem value="casting">Casting Call (Models)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Location Type</Label>
                      <Select value={formData.location} onValueChange={(val) => setFormData({ ...formData, location: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="onsite">On-site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="compensation">Compensation</Label>
                      <Input
                        id="compensation"
                        value={formData.compensation}
                        onChange={(e) => setFormData({ ...formData, compensation: e.target.value })}
                        placeholder="e.g., $500-1000"
                        maxLength={200}
                      />
                    </div>
                  </div>

                  {(formData.location === "hybrid" || formData.location === "onsite") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="location_city">City</Label>
                        <Input
                          id="location_city"
                          value={formData.location_city}
                          onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                          placeholder="e.g., Dubai, Los Angeles"
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location_country">Country</Label>
                        <Input
                          id="location_country"
                          value={formData.location_country}
                          onChange={(e) => setFormData({ ...formData, location_country: e.target.value })}
                          placeholder="e.g., UAE, United States"
                          maxLength={100}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the role, project, and what you're looking for..."
                      rows={5}
                      maxLength={2000}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="requirements">Requirements</Label>
                      <Textarea
                        id="requirements"
                        value={formData.requirements}
                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                        placeholder="Any specific requirements or qualifications..."
                        rows={3}
                        maxLength={1000}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deliverables">Deliverables</Label>
                      <Textarea
                        id="deliverables"
                        value={formData.deliverables}
                        onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                        placeholder="What will the collaborator deliver..."
                        rows={3}
                        maxLength={1000}
                      />
                    </div>
                  </div>
                </section>

                <div className="h-px bg-border" />

                {/* Section: Skills */}
                <section className="space-y-5">
                  <SectionHeading as="h3" icon={<Zap className="h-4 w-4" style={{ color: ACCENT }} />}>
                    Required Skills
                  </SectionHeading>
                  <div className="space-y-2">
                    <Label htmlFor="skills-input">Add skills</Label>
                    <div className="flex gap-2">
                      <Input
                        id="skills-input"
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                        placeholder="e.g., Video Editing, Color Grading, After Effects"
                        maxLength={50}
                      />
                      <Button type="button" onClick={handleAddSkill} variant="outline">Add</Button>
                    </div>
                    {formData.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {formData.skills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="gap-1 px-2.5 py-1">
                            {skill}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveSkill(skill)} />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Casting-specific fields */}
                {formData.type === "casting" && (
                  <>
                    <div className="h-px bg-border" />
                    <section className="space-y-5">
                      <SectionHeading as="h3" icon={<Users className="h-4 w-4" style={{ color: ACCENT }} />}>
                        Casting Details
                      </SectionHeading>
                      <CastingFieldsForm value={casting} onChange={setCasting} />
                    </section>
                  </>
                )}

                <div className="h-px bg-border" />

                {/* Section: Cover Image */}
                <section className="space-y-5">
                  <SectionHeading as="h3" icon={<Upload className="h-4 w-4" style={{ color: ACCENT }} />}>
                    Cover Image (optional)
                  </SectionHeading>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  {imagePreview || formData.image_url ? (
                    <div className="relative w-full h-56 sm:h-72 rounded-xl overflow-hidden border border-border">
                      <img
                        src={imagePreview || formData.image_url}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3 flex gap-2">
                        {imagePreview && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => {
                              setRawImageUrl(imagePreview);
                              setShowCropDialog(true);
                            }}
                          >
                            <Crop className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-9 w-9"
                          onClick={clearImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-40 sm:h-52 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-foreground/50 hover:border-[hsl(var(--energy)/0.5)] hover:text-foreground transition-colors"
                    >
                      <Upload className="h-7 w-7" />
                      <span className="text-sm font-medium">Click to upload an image</span>
                      <span className="text-xs">PNG, JPG up to 5MB</span>
                    </button>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-foreground/50">
                    <span>Or paste a URL:</span>
                    <Input
                      value={formData.image_url}
                      onChange={(e) => {
                        setFormData({ ...formData, image_url: e.target.value });
                        setImageFile(null);
                        setImagePreview("");
                      }}
                      placeholder="https://example.com/image.jpg"
                      className="h-8 text-sm flex-1"
                      maxLength={500}
                    />
                  </div>
                </section>
              </div>

              {/* Sticky submit footer */}
              <div className="sticky bottom-0 z-10 p-5 sm:p-8 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <Button type="submit" size="lg" className="flex-1 gap-2 h-12 text-base" disabled={posting}>
                    {posting ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> {user ? "Posting..." : "Submitting..."}</>
                    ) : (
                      <><CheckCircle2 className="h-5 w-5" /> {user ? "Post Opportunity" : "Post Opportunity (Free)"}</>
                    )}
                  </Button>
                  <p className="text-xs text-foreground/45 max-w-sm text-center sm:text-left">
                    {user
                      ? "Your listing goes live immediately — no email verification needed, you're already signed in."
                      : "We'll send a verification email. Your listing goes live once you confirm. No account needed."}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </form>
      </EditorialChapter>

      {/* II — Why it works */}
      <EditorialChapter index="II" kicker="Why it works" title="Anyone can post a job." accentWord="Few can prove the work.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NOTES.map((n, i) => (
            <Reveal key={n.title} delayIndex={i}>
              <div className="h-full rounded-2xl border border-border bg-foreground/[0.02] p-5 transition-colors hover:border-[hsl(var(--energy)/0.35)]">
                <span
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--energy)/0.1)]"
                >
                  <n.icon className="h-4 w-4" style={{ color: ACCENT }} />
                </span>
                <p className="text-foreground font-semibold text-sm mb-1.5">{n.title}</p>
                <p className="text-sm leading-relaxed text-foreground/55">{n.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delayIndex={2}>
          <p className="mt-10 max-w-2xl font-serif italic text-lg leading-relaxed text-foreground/80">
            "A CV tells you what someone claims. A credit tells you what they actually shipped — and who signed for it."
          </p>
        </Reveal>
      </EditorialChapter>


      <ImageCropDialog
        imageUrl={rawImageUrl}
        open={showCropDialog}
        onClose={() => setShowCropDialog(false)}
        onCropComplete={handleCropComplete}
      />
      <ImageCropDialog
        imageUrl={rawLogoUrl}
        open={showLogoCropDialog}
        onClose={() => setShowLogoCropDialog(false)}
        onCropComplete={handleLogoCropComplete}
      />
    </div>
    </PageTransition>

  );
};

export default PostOpportunity;
