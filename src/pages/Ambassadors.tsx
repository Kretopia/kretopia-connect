import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { Crown, Sparkles, TrendingUp, Link2, CheckCircle2, ArrowRight, DollarSign, Users, Award, Lock } from "lucide-react";

const Ambassadors = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    instagram: "",
  });

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    (async () => {
      const { data: app } = await supabase
        .from("ambassador_applications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setExisting(app);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setForm(f => ({
        ...f,
        full_name: profile?.full_name || "",
        email: user.email || "",
      }));
      setLoading(false);
    })();
  }, [user?.id, user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      sessionStorage.setItem("post_auth_redirect", "/ambassadors");
      navigate("/auth");
      return;
    }
    if (!form.email.trim()) {
      toast({ title: "Email required", description: "We need an email to reach you.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("ambassador_applications").insert({
      user_id: user.id,
      full_name: form.full_name || user.email?.split("@")[0] || "Anonymous",
      email: form.email,
      pitch: "[Waitlist signup — closed beta]",
      social_links: {
        instagram: form.instagram || null,
      },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't join waitlist", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "You're on the list", description: "We'll reach out personally as we open more seats." });
    setExisting({ status: "pending" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Kretopia Ambassadors — Closed Beta"
        description="The Kretopia Ambassador Program is currently invite-only. Join the waitlist — earn 30% recurring commission, 5% on jobs your referrals win, lifetime Pro, and founder-tier perks."
        url="https://kretopia.com/ambassadors"
      />

      {/* HERO */}
      <section className="relative overflow-hidden bg-cinematic dark border-b border-border/50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-20 h-[500px] w-[500px] rounded-full bg-primary/25 blur-[140px]" />
          <div className="absolute top-20 -right-20 h-[400px] w-[400px] rounded-full bg-accent/20 blur-[120px]" />
        </div>

        <div className="relative container mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-20">
          <Badge variant="outline" className="mb-5 border-primary/40 bg-primary/5 text-primary uppercase tracking-widest text-[10px]">
            <Lock className="h-3 w-3 mr-1.5" /> Currently Invite-Only
          </Badge>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-[-0.04em] text-foreground leading-[0.95] mb-5">
            Get paid to grow<br />
            <span className="landing-accent">the Creative OS.</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-4">
            The Kretopia Ambassador Program is in closed beta. We're hand-picking a small group of creators with real influence in film, music, fashion, content, and events to shape what this becomes.
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-2xl leading-relaxed mb-8">
            Want in? Join the waitlist below — we open new seats every few weeks and reach out personally.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild className="gap-2">
              <a href="#waitlist">Request access <ArrowRight className="h-4 w-4" /></a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#perks">See the perks</a>
            </Button>
          </div>
        </div>
      </section>

      {/* PERKS */}
      <section id="perks" className="container mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">What ambassadors get</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-8">Real upside, not just a referral link.</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: DollarSign, title: "30% recurring", body: "Earn 30% of every paid subscription your community brings in — every month, for as long as they stay." },
            { icon: TrendingUp, title: "5% of their jobs", body: "When a creator you brought in gets paid for a gig on Kretopia, you earn 5% of the platform fee — talent-manager style." },
            { icon: Link2, title: "Vanity invite link", body: "kretopia.com/with/yourname plus a co-branded landing page so your audience knows it's you." },
            { icon: Crown, title: "Lifetime Pro", body: "Free Creator+ for life the moment you're approved. Full access to every feature, no caps." },
            { icon: Award, title: "Status badges", body: "Permanent Ambassador badge, with rank tiers as you grow your roster — industry signal that you helped build this." },
            { icon: Users, title: "Direct line to founders", body: "Private channel with the team. Your feedback ships. Early access to every feature." },
          ].map((p, i) => (
            <Card key={i} className="p-5 border-border/60 bg-card hover:border-primary/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-1.5">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" className="bg-muted/30 border-y border-border/50">
        <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Request access</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Join the waitlist.</h2>
          <p className="text-muted-foreground mb-8">
            We're keeping the first cohort small and intentional. Drop your details — if there's a fit, we'll be in touch directly.
          </p>

          {loading ? (
            <Card className="p-6 animate-pulse h-48" />
          ) : existing ? (
            <Card className="p-8 border-primary/30 bg-primary/5 text-center">
              <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">
                {existing.status === "approved" ? "You're in." : existing.status === "rejected" ? "Not this round" : "You're on the list"}
              </h3>
              <p className="text-muted-foreground mb-5">
                {existing.status === "approved"
                  ? "Welcome to the Ambassador program. Your perks are now active."
                  : existing.status === "rejected"
                  ? "We're not moving forward right now — keep building, the door stays open."
                  : "We open new seats every few weeks. If there's a fit, we'll reach out personally."}
              </p>
              <Button asChild variant={existing.status === "approved" ? "default" : "outline"}>
                <Link to={existing.status === "approved" ? "/ambassador" : "/profile"}>
                  {existing.status === "approved" ? "Open ambassador hub" : "Back to profile"}
                </Link>
              </Button>
            </Card>
          ) : (
            <Card className="p-6 sm:p-8 border-border/60 bg-card">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" required placeholder="you@domain.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="full_name">Name</Label>
                  <Input id="full_name" placeholder="Your name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="instagram">Instagram or main platform <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="instagram" placeholder="@handle or link" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} />
                </div>

                <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
                  {submitting ? "Joining..." : <>Join the waitlist <ArrowRight className="h-4 w-4" /></>}
                </Button>
                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> No spam. We only reach out if there's a real fit.
                </p>
              </form>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

export default Ambassadors;
