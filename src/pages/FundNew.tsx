import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, Rocket, Loader2, Lock, Sparkles, Wand2, ImagePlus, ChevronLeft, ChevronRight, Upload, Check,
} from "lucide-react";
import { useCreateCampaign, useMyCampaigns } from "@/hooks/useThriveFund";
import { useAuth } from "@/contexts/AuthContext";
import { hasProAccess, hasCreatorProAccess, type SubscriptionTier } from "@/lib/subscriptionConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { FUND_CATEGORIES } from "@/lib/fundCategories";

interface TierDraft {
  amount: string;
  title: string;
  description: string;
  max_backers: string;
}

const STEPS = [
  { key: "basics", label: "Basics" },
  { key: "story", label: "Story & Cover" },
  { key: "tiers", label: "Pledge Tiers" },
  { key: "goal", label: "Goal & Launch" },
] as const;

const FundNew = () => {
  const { user, subscriptionInfo } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [params] = useSearchParams();
  const projectId = params.get("project") || null;
  const tier = (subscriptionInfo.tier || "free") as SubscriptionTier;
  const isPro = hasProAccess(tier);
  const isCreatorPro = hasCreatorProAccess(tier);
  const { data: myCampaigns } = useMyCampaigns();
  // Yearly campaign caps: Spark 1, Creator 3, Creator+/Founder unlimited
  const yearlyCap = isCreatorPro ? -1 : isPro ? 3 : 1;
  const currentYear = new Date().getFullYear();
  const yearlyCount = (myCampaigns ?? []).filter((c) => {
    if (c.status === "cancelled") return false;
    return new Date(c.created_at).getFullYear() === currentYear;
  }).length;
  const limitReached = yearlyCap !== -1 && yearlyCount >= yearlyCap;
  const tierBlocked = false; // Spark now gets 1 free/year — no hard tier block
  const gated = limitReached;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(params.get("title") || "");
  const [tagline, setTagline] = useState("");
  const [story, setStory] = useState("");
  const [category, setCategory] = useState("Film");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [goal, setGoal] = useState("5000");
  const [days, setDays] = useState("30");
  const [tiers, setTiers] = useState<TierDraft[]>([
    { amount: "10", title: "Supporter", description: "Early access + a thank-you in the credits.", max_backers: "" },
    { amount: "50", title: "Backer", description: "Everything above + signed digital asset.", max_backers: "" },
    { amount: "250", title: "Producer Credit", description: "Everything above + Executive Producer credit.", max_backers: "20" },
  ]);
  const [aiBusy, setAiBusy] = useState<null | "tagline" | "story" | "tiers" | "image">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const createMut = useCreateCampaign();

  const updateTier = (i: number, patch: Partial<TierDraft>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTier = () => setTiers((prev) => [...prev, { amount: "", title: "", description: "", max_backers: "" }]);
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));

  // ── AI assist ──
  const callAI = async (action: "tagline" | "story" | "tiers" | "image") => {
    if (!title.trim()) {
      toast.error("Add a title first so we have context");
      return;
    }
    setAiBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke("thrivefund-ai-assist", {
        body: { action, title, category, tagline, story, goal: Number(goal) || 0 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === "tagline" && data.text) setTagline(data.text);
      if (action === "story" && data.text) setStory(data.text);
      if (action === "tiers" && Array.isArray(data.tiers)) {
        setTiers(
          data.tiers.map((t: any) => ({
            amount: String(t.amount ?? ""),
            title: t.title ?? "",
            description: t.description ?? "",
            max_backers: t.max_backers ? String(t.max_backers) : "",
          }))
        );
        toast.success(`Smart suggested ${data.tiers.length} tiers`);
      }
      if (action === "image" && data.imageDataUrl) {
        await uploadDataUrl(data.imageDataUrl);
        toast.success("Cover image generated");
      }
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setAiBusy(null);
    }
  };

  const uploadDataUrl = async (dataUrl: string) => {
    if (!user) return;
    setCoverUploading(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${user.id}/${Date.now()}.png`;
      const { error } = await supabase.storage.from("campaign-media").upload(path, blob, {
        contentType: "image/png",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("campaign-media").getPublicUrl(path);
      setCoverUrl(data.publicUrl);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save image");
    } finally {
      setCoverUploading(false);
    }
  };

  const onUploadFile = async (file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Max 8MB");
      return;
    }
    setCoverUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("campaign-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("campaign-media").getPublicUrl(path);
      setCoverUrl(data.publicUrl);
      toast.success("Cover uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  // ── Age / ID verification gating ──
  const [profile, setProfile] = useState<{ age_verified?: boolean; id_verified?: boolean; date_of_birth?: string | null; email_verified?: boolean } | null>(null);
  const [dob, setDob] = useState("");
  const [savingDob, setSavingDob] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("age_verified, id_verified, date_of_birth, email_verified").eq("user_id", user.id).maybeSingle().then(({ data }: any) => {
      if (data) {
        setProfile(data);
        if (data.date_of_birth) setDob(data.date_of_birth);
      }
    });
  }, [user]);

  const yearsOld = (d: string) => {
    if (!d) return 0;
    return Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 86400000));
  };

  const saveDob = async () => {
    if (!user) return;
    if (yearsOld(dob) < 18) {
      toast.error("You must be 18 or older to launch a campaign.");
      return;
    }
    setSavingDob(true);
    try {
      const { error } = await supabase.from("profiles").update({ date_of_birth: dob }).eq("user_id", user.id);
      if (error) throw error;
      setProfile((p) => ({ ...(p ?? {}), date_of_birth: dob, age_verified: true }));
      toast.success("Age verified");
    } catch (e: any) {
      toast.error(e.message || "Couldn't save");
    } finally {
      setSavingDob(false);
    }
  };

  const ageVerified = !!profile?.age_verified;

  // ── Submit ──
  const handleSubmit = async (publish: boolean) => {
    if (!user) {
      navigate("/auth?redirect=/fund/new");
      return;
    }
    if (publish && !ageVerified) {
      toast.error("Confirm your date of birth (18+) before launching.");
      return;
    }
    if (publish && gated) {
      toast.error(
        tierBlocked
          ? "Upgrade to Creator to launch a ThriveFund campaign"
          : "Creator tier allows 1 active campaign. Upgrade to Creator+ for unlimited."
      );
      return;
    }
    if (!title.trim() || !goal || Number(goal) <= 0) {
      toast.error("Please add a title and a positive funding goal");
      return;
    }
    const deadline = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
    try {
      const campaign = await createMut.mutateAsync({
        title: title.trim(),
        tagline: tagline.trim() || undefined,
        story: story.trim() || undefined,
        category,
        cover_image_url: coverUrl.trim() || undefined,
        goal_amount: Number(goal),
        currency: "USD",
        deadline,
        project_id: projectId,
        publish,
        tiers: tiers
          .filter((t) => t.title.trim() && Number(t.amount) > 0)
          .map((t, i) => ({
            amount: Number(t.amount),
            title: t.title.trim(),
            description: t.description.trim() || null,
            reward_type: "digital",
            estimated_delivery: null,
            max_backers: t.max_backers ? Number(t.max_backers) : null,
            display_order: i,
            is_active: true,
          })),
      });
      const mod = (campaign as any).moderation as { decision: string; reason: string } | null;
      if (publish && mod) {
        if (mod.decision === "block") toast.error(`Blocked: ${mod.reason}`);
        else if (mod.decision === "review") toast.success("Submitted for review — we'll publish once approved.");
        else toast.success("Campaign launched and live!");
      } else {
        toast.success(publish ? "Campaign launched!" : "Draft saved");
      }
      navigate(`/fund/${campaign.slug}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create campaign");
    }
  };

  // ── Validation per step ──
  const canAdvance = () => {
    if (step === 0) return title.trim().length > 0;
    if (step === 1) return story.trim().length > 0;
    if (step === 2) return tiers.some((t) => t.title.trim() && Number(t.amount) > 0);
    return true;
  };

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>Launch Your Campaign · ThriveFund</title>
      </Helmet>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-5 space-y-3">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">
            ThriveFund · New Campaign
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05]">
            Launch your campaign
          </h1>
          <p className="text-sm text-muted-foreground">
            All-or-nothing: cards are only charged if you hit your goal by the deadline.
          </p>
        </div>

        {/* Bottom hairline under the header, before the phase rail */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent mb-5" />

        {/* Phase rail — same "single gradient progress track + labeled,
            sequentially-gated markers" pattern as Studio's StudioPhaseRail,
            adapted to this campaign wizard's own 4 real steps instead of
            the project lifecycle's phases. Markers let you step back into
            an already-completed step; a step ahead of the current one stays
            locked (dimmed, lock glyph) until canAdvance() clears it via the
            Next button below — no new progression system, just this
            wizard's existing `step` state rendered the Studio way. */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {Math.round(progressPct)}% through setup
            </span>
          </div>
          <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: "linear-gradient(90deg, hsl(var(--muted-foreground) / 0.5), hsl(var(--energy)))",
                boxShadow: "0 0 12px hsl(var(--energy) / 0.5)",
              }}
              initial={false}
              animate={{ width: `${Math.max(progressPct, 3)}%` }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: [0.2, 0.65, 0.3, 0.95] }}
            />
          </div>
          <div className="mt-2 flex items-start justify-between gap-0.5">
            {STEPS.map((s, i) => {
              const locked = i > step;
              const status = i < step ? "complete" : i === step ? "current" : "todo";
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={locked}
                  aria-current={status === "current" ? "step" : undefined}
                  aria-disabled={locked}
                  onClick={() => !locked && setStep(i)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-0.5 rounded-md transition-colors",
                    locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/60"
                  )}
                  title={locked ? `${s.label} — complete the earlier steps first` : s.label}
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full border flex items-center justify-center text-[9px] font-bold transition-colors",
                      status === "current" && "ring-2 ring-[hsl(var(--energy)/0.25)]"
                    )}
                    style={{
                      backgroundColor: status === "todo" ? "transparent" : "hsl(var(--energy))",
                      borderColor: status === "todo" ? "hsl(var(--muted-foreground) / 0.3)" : "hsl(var(--energy))",
                      color: status === "todo" ? "hsl(var(--muted-foreground))" : "hsl(var(--energy-foreground))",
                    }}
                  >
                    {status === "complete" ? <Check className="h-2.5 w-2.5" /> : locked ? <Lock className="h-2 w-2" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide leading-tight text-center",
                      status === "current" && "text-foreground",
                      status === "complete" && "text-muted-foreground",
                      status === "todo" && "text-muted-foreground/40"
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!gated && yearlyCap !== -1 && (
          <Card className="p-3 mb-4 rounded-xl border-primary/20 bg-primary/5 shadow-none">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{yearlyCount} of {yearlyCap}</span> ThriveFund campaigns used this year on the {isPro ? "Creator" : "Spark"} plan.
              {!isCreatorPro && (
                <Link to="/subscription" className="ml-1 text-primary font-medium hover:underline">
                  {isPro ? "Go Creator+ for unlimited →" : "Upgrade for more →"}
                </Link>
              )}
            </p>
          </Card>
        )}

        {gated && (
          <Card className="p-5 mb-5 rounded-2xl border-primary/40 bg-gradient-to-br from-primary/10 to-energy/10 shadow-none">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/15 p-2">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  You've used your {yearlyCap} ThriveFund campaign{yearlyCap > 1 ? "s" : ""} for {currentYear}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {!isPro
                    ? "Spark includes 1 free campaign per year. Upgrade to Creator for 3 per year, or Creator+ for unlimited."
                    : "Creator includes 3 campaigns per year. Upgrade to Creator+ for unlimited concurrent campaigns."}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" asChild className="gap-1">
                    <Link to="/subscription">
                      <Sparkles className="h-3.5 w-3.5" />
                      {!isPro ? "Upgrade to Creator" : "Upgrade to Creator+"}
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/fund">Browse campaigns instead</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── STEP 0: Basics ── */}
        {step === 0 && (
          <Card className="p-5 space-y-4 rounded-2xl border-border/60 shadow-none">
            <div>
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Debut Album"
                maxLength={120}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                The hook backers see first. Keep it specific.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Tagline</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-energy hover:text-energy hover:bg-energy/10"
                  disabled={aiBusy === "tagline" || !title.trim()}
                  onClick={() => callAI("tagline")}
                >
                  {aiBusy === "tagline" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  Smart write
                </Button>
              </div>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="A one-line hook"
                maxLength={140}
              />
            </div>

            <div>
              <Label>Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {FUND_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </Card>
        )}

        {/* ── STEP 1: Story + Cover ── */}
        {step === 1 && (
          <div className="space-y-4">
            <Card className="p-5 space-y-4 rounded-2xl border-border/60 shadow-none">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Cover image</Label>
                  <div className="flex gap-1">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && onUploadFile(e.target.files[0])}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1"
                      onClick={() => fileRef.current?.click()}
                      disabled={coverUploading}
                    >
                      {coverUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      Upload
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-energy hover:text-energy hover:bg-energy/10"
                      onClick={() => callAI("image")}
                      disabled={aiBusy === "image" || !title.trim()}
                    >
                      {aiBusy === "image" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                      Smart generate
                    </Button>
                  </div>
                </div>
                {coverUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-border aspect-video bg-muted">
                    <img src={coverUrl} alt="Campaign cover" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border aspect-video bg-muted/30 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Upload an image or let Smart generate one</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Story *</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-energy hover:text-energy hover:bg-energy/10"
                    onClick={() => callAI("story")}
                    disabled={aiBusy === "story" || !title.trim()}
                  >
                    {aiBusy === "story" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    Smart write
                  </Button>
                </div>
                <Textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="What you're building, who it's for, and why it matters. Markdown supported."
                  rows={10}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Markdown supported. Kreto uses your title, tagline & goal as context.
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* ── STEP 2: Tiers ── */}
        {step === 2 && (
          <Card className="p-5 space-y-3 rounded-2xl border-border/60 shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black tracking-tight">Pledge tiers</h2>
                <p className="text-xs text-muted-foreground">Rewards backers can choose from</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-energy hover:text-energy hover:bg-energy/10"
                  onClick={() => callAI("tiers")}
                  disabled={aiBusy === "tiers" || !title.trim()}
                >
                  {aiBusy === "tiers" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  Smart suggest
                </Button>
                <Button variant="outline" size="sm" onClick={addTier} className="gap-1">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            {tiers.map((t, i) => (
              <Card key={i} className="p-3 rounded-xl border-border/60 bg-muted/30 shadow-none">
                <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start">
                  <div>
                    <Label className="text-[10px]">Amount $</Label>
                    <Input
                      type="number"
                      value={t.amount}
                      onChange={(e) => updateTier(i, { amount: e.target.value })}
                      placeholder="25"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Title</Label>
                    <Input
                      value={t.title}
                      onChange={(e) => updateTier(i, { title: e.target.value })}
                      placeholder="Backer"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTier(i)}
                    className="mt-5"
                    aria-label="Remove tier"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="mt-2">
                  <Label className="text-[10px]">Description</Label>
                  <Textarea
                    value={t.description}
                    onChange={(e) => updateTier(i, { description: e.target.value })}
                    rows={2}
                    placeholder="What backers get at this tier"
                  />
                </div>
                <div className="mt-2">
                  <Label className="text-[10px]">Max backers (optional)</Label>
                  <Input
                    type="number"
                    value={t.max_backers}
                    onChange={(e) => updateTier(i, { max_backers: e.target.value })}
                    placeholder="Leave blank for unlimited"
                  />
                </div>
              </Card>
            ))}
          </Card>
        )}

        {/* ── STEP 3: Goal & Launch ── */}
        {step === 3 && (
          <Card className="p-5 space-y-4 rounded-2xl border-border/60 shadow-none">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Funding goal (USD) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
              <div>
                <Label>Duration (days) *</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-energy/30 bg-energy/5 p-4">
              <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase mb-2">Review</p>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Title:</span> <span className="font-medium">{title || "—"}</span></p>
                <p><span className="text-muted-foreground">Category:</span> {category}</p>
                <p><span className="text-muted-foreground">Goal:</span> ${Number(goal).toLocaleString()} · <span className="text-muted-foreground">Duration:</span> {days} days</p>
                <p><span className="text-muted-foreground">Tiers:</span> {tiers.filter((t) => t.title.trim() && Number(t.amount) > 0).length}</p>
                <p><span className="text-muted-foreground">Cover:</span> {coverUrl ? "✓ Set" : "Not set"}</p>
              </div>
            </div>

            {/* Verification gate */}
            <div className={cn(
              "rounded-xl border p-4 space-y-3",
              ageVerified ? "border-energy/40 bg-energy/5" : "border-destructive/40 bg-destructive/5"
            )}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider">
                  {ageVerified ? "✓ Identity & age verified" : "Age verification required (18+)"}
                </p>
                {profile?.id_verified && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-energy">ID ✓</span>
                )}
              </div>
              {!ageVerified ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Crowdfunding requires you to be at least 18. Confirm your date of birth to continue.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="flex-1"
                    />
                    <Button onClick={saveDob} disabled={!dob || savingDob} size="sm">
                      {savingDob ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {profile?.id_verified
                    ? "Verified creators get auto-approved campaigns. Nice."
                    : "Tip: complete ID verification on your profile to skip the human review step."}
                </p>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Platform fee 5% on funded campaigns. Stripe processing fees apply. All campaigns are
              screened by our smart moderator for fraud, prohibited content, and policy compliance —
              flagged campaigns go to human review before going live.
            </p>
          </Card>
        )}

        {/* ── Footer nav ── */}
        <div className="flex flex-wrap gap-2 mt-6 items-center">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="gap-1.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canAdvance()}
              className="gap-1.5 ml-auto"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={createMut.isPending}
              >
                Save draft
              </Button>
              <Button
                size="sm"
                onClick={() => handleSubmit(true)}
                disabled={createMut.isPending || gated || !ageVerified}
                className="gap-1.5"
              >
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {gated ? <><Lock className="h-3.5 w-3.5" /> Upgrade to launch</> : !ageVerified ? <><Lock className="h-3.5 w-3.5" /> Verify age to launch</> : <>Launch <Rocket className="h-3.5 w-3.5" /></>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FundNew;
