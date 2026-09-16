import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy, Coins, Users, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { APP_URL } from "@/lib/constants";
import { AmbassadorAttributionVerifier } from "@/components/ambassador/AmbassadorAttributionVerifier";
import { formatDistanceToNow } from "date-fns";

interface Application {
  id: string;
  status: "pending" | "approved" | "rejected";
  full_name: string;
  email: string;
  pitch: string;
  created_at: string;
}

const TIERS = [
  { signups: 5, label: "Spark Ambassador", icon: "", reward: "100 ThriveCoins + Spark badge" },
  { signups: 25, label: "Connector", icon: "🔗", reward: "1 month Pro free + Connector badge" },
  { signups: 100, label: "Catalyst", icon: "⚡", reward: "3 months Pro + 5% revshare from referred users" },
  { signups: 500, label: "Mogul", icon: "👑", reward: "Lifetime Pro + 5% revshare + featured profile" },
];

export default function Ambassador() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [ambassadorCode, setAmbassadorCode] = useState<string | null>(null);
  const [signupCount, setSignupCount] = useState(0);
  const [recentSignups, setRecentSignups] = useState<Array<{ first_name: string; signed_up_at: string }>>([]);
  const [copied, setCopied] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [primaryPlatform, setPrimaryPlatform] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [niche, setNiche] = useState("");
  const [pitch, setPitch] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: app }, { data: profile }] = await Promise.all([
        supabase.from("ambassador_applications").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("ambassador_code, full_name").eq("user_id", user.id).maybeSingle(),
      ]);
      if (app) setApplication(app as Application);
      const p = profile as { ambassador_code: string | null; full_name: string | null } | null;
      if (p?.ambassador_code) {
        setAmbassadorCode(p.ambassador_code);
        const { data: stats } = await supabase.rpc("get_ambassador_referral_stats");
        const row = Array.isArray(stats) ? stats[0] : stats;
        if (row) {
          setSignupCount(Number((row as any).total_signups ?? 0));
          const recent = (row as any).recent;
          if (Array.isArray(recent)) setRecentSignups(recent as any);
        }
      }
      if (p?.full_name) setFullName(p.full_name);
      if (user.email) setEmail(user.email);
      setLoading(false);
    })().catch((e) => {
      console.error("[Ambassador] load failed", e);
      setLoading(false);
    });
  }, [user]);

  if (!user) return <Navigate to="/auth?redirect=/ambassador" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !pitch.trim()) {
      toast.error("Please fill in name, email and pitch.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("ambassador_applications")
      .insert({
        user_id: user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        primary_platform: primaryPlatform.trim() || null,
        audience_size: audienceSize.trim() || null,
        niche: niche.trim() || null,
        pitch: pitch.trim(),
      })
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setApplication(data as Application);
    toast.success("Application submitted! We'll review within 48 hours.");
  };

  const shareLink = ambassadorCode ? `${APP_URL}/?amb=${ambassadorCode}` : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Link copied!");
  };

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Approved ambassador → dashboard
  if (application?.status === "approved" && ambassadorCode) {
    const currentTier = [...TIERS].reverse().find((t) => signupCount >= t.signups);
    const nextTier = TIERS.find((t) => signupCount < t.signups);

    return (
      <div className="container max-w-3xl mx-auto py-8 px-4 pb-24 space-y-6">
        <SEO title="Ambassador Dashboard · Kretopia" description="Track your ambassador signups and rewards." />

        <div className="text-center space-y-2">
          <Badge variant="secondary" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Ambassador</Badge>
          <h1 className="text-3xl font-bold">Your Ambassador Hub</h1>
          <p className="text-sm text-muted-foreground">Bring creators in. Climb tiers. Earn real rewards.</p>
        </div>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your share link</p>
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="font-mono text-sm" />
                <Button onClick={copyLink} variant="outline" size="icon">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Code: <span className="font-mono font-semibold text-foreground">{ambassadorCode}</span></p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-3.5 w-3.5" /> Signups</div>
            <p className="text-3xl font-bold mt-1">{signupCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Trophy className="h-3.5 w-3.5" /> Current tier</div>
            <p className="text-lg font-bold mt-1">{currentTier ? `${currentTier.icon} ${currentTier.label}` : "—"}</p>
          </CardContent></Card>
        </div>

        <AmbassadorAttributionVerifier ownAmbassadorCode={ambassadorCode} />

        <Card>
          <CardHeader><CardTitle className="text-lg">Recent signups</CardTitle></CardHeader>
          <CardContent>
            {recentSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No attributed signups yet. Share your link — they'll show up here within seconds of sign-up.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {recentSignups.map((r, i) => (
                  <li key={i} className="py-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{r.first_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.signed_up_at), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Tier rewards</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {TIERS.map((t) => {
              const reached = signupCount >= t.signups;
              const isNext = nextTier?.signups === t.signups;
              return (
                <div
                  key={t.signups}
                  className={`p-3 rounded-lg border ${reached ? "border-primary/40 bg-primary/5" : isNext ? "border-accent/40" : "border-border/40"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{t.icon}</span>
                      <div>
                        <p className="font-semibold text-sm">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.reward}</p>
                      </div>
                    </div>
                    <Badge variant={reached ? "default" : "outline"}>
                      {reached ? "Unlocked" : `${signupCount}/${t.signups}`}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1.5 text-foreground font-semibold"><Coins className="h-3.5 w-3.5" /> How rewards pay out</p>
            <p>• Tier badges and Pro time apply automatically when you hit a threshold.</p>
            <p>• Revenue share (5%) on referred users' platform fees pays monthly to your KrePay wallet once you reach Catalyst.</p>
            <p>• ThriveCoins can be spent on Copilot top-ups, profile boosts, and more in the XP shop.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending or rejected
  if (application) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4 pb-24">
        <SEO title="Ambassador Application · Kretopia" description="Your ambassador application status." />
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Badge variant={application.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
              {application.status}
            </Badge>
            <h1 className="text-2xl font-bold">
              {application.status === "pending" ? "We're reviewing your application" : "Application not approved"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {application.status === "pending"
                ? "Most reviews complete within 48 hours. We'll email you when there's news."
                : "Reach out to the team if you'd like feedback or to reapply later."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Application form
  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 pb-24 space-y-6">
      <SEO title="Become a Kretopia Ambassador" description="Bring creators to Kretopia. Earn ThriveCoins, free Pro, and a share of the revenue." />

      <div className="text-center space-y-3">
        <Badge variant="secondary" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Ambassador Program</Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Bring creators in. Get paid for it.</h1>
        <p className="text-muted-foreground">Earn ThriveCoins, free Pro, status badges and revshare for every creator you onboard.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TIERS.map((t) => (
          <Card key={t.signups}><CardContent className="p-4">
            <div className="text-2xl">{t.icon}</div>
            <p className="font-semibold text-sm mt-1">{t.label}</p>
            <p className="text-xs text-muted-foreground">{t.signups}+ signups</p>
            <p className="text-xs mt-2">{t.reward}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Apply</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fullName">Full name *</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="platform">Primary platform</Label>
                <Input id="platform" placeholder="Instagram, TikTok, YouTube…" value={primaryPlatform} onChange={(e) => setPrimaryPlatform(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="audience">Audience size</Label>
                <Input id="audience" placeholder="e.g. 10K, 250K" value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="niche">Niche</Label>
              <Input id="niche" placeholder="Music producers, fashion creators, filmmakers…" value={niche} onChange={(e) => setNiche(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pitch">Why you'd be a great ambassador *</Label>
              <Textarea id="pitch" rows={4} placeholder="Tell us about the creators you'd bring on and how you'd promote Kretopia." value={pitch} onChange={(e) => setPitch(e.target.value)} required />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit application
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
