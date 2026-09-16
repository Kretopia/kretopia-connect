import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, Copy, MessageCircle, Twitter, Instagram, ArrowRight, DollarSign, Briefcase, Check, Share2 } from "lucide-react";
import Confetti from "react-dom-confetti";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface ProfileLaunchScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string;
  role?: string;
  avatarUrl?: string;
  topCredit?: string | null;
  creditsCount?: number;
  pendingConnect?: string | null;
}

const ACCENT = "#FF2DA1";

const confettiConfig = {
  angle: 90,
  spread: 280,
  startVelocity: 55,
  elementCount: 140,
  dragFriction: 0.1,
  duration: 5000,
  stagger: 2,
  width: "10px",
  height: "10px",
  colors: [ACCENT, "#ffffff", "#ff8ac9", "#B0083F"],
};

/**
 * Wave 2: "Your profile is LIVE" celebration moment.
 * Replaces the old direct-to-/circle redirect with a pride + share + next-step screen.
 */
export function ProfileLaunchScreen({
  open,
  onOpenChange,
  userId,
  fullName,
  role,
  avatarUrl,
  topCredit,
  creditsCount = 0,
  pendingConnect,
}: ProfileLaunchScreenProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);

  const profileUrl = useMemo(
    () => `https://www.kretopia.com/profile/${userId}`,
    [userId]
  );

  const shareCopy = useMemo(() => {
    if (topCredit) {
      return `I just verified my work on ${topCredit} (and more) on Kretopia — see my creative résumé:`;
    }
    if (creditsCount > 0) {
      return `I just verified ${creditsCount} of my projects on Kretopia — see my creative résumé:`;
    }
    return `This is my verified creative profile on Kretopia — check it out:`;
  }, [topCredit, creditsCount]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setShowConfetti(true), 250);
      return () => clearTimeout(t);
    }
    setShowConfetti(false);
    setCopied(false);
  }, [open]);

  const trackShare = async (channel: string) => {
    try {
      const { analytics } = await import("@/lib/analytics");
      analytics.featureUsed(`profile_launch_share_${channel}`);
    } catch {}
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareCopy} ${profileUrl}`);
      setCopied(true);
      trackShare("copy");
      toast({ title: "Link copied!", description: "Paste it anywhere to share your profile." });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleWhatsApp = () => {
    trackShare("whatsapp");
    const text = encodeURIComponent(`${shareCopy} ${profileUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleTwitter = () => {
    trackShare("twitter");
    const text = encodeURIComponent(shareCopy);
    const url = encodeURIComponent(profileUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const handleInstagram = async () => {
    trackShare("instagram");
    // IG has no web share intent — copy and prompt
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: "Link copied — open Instagram",
        description: "Paste into your story or bio. Tap 'Continue' when done.",
      });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    // Honor a stashed post-auth redirect (e.g. studio guest invite, event RSVP)
    const stashed = (() => {
      try { return sessionStorage.getItem("thrivein_post_auth_redirect"); } catch { return null; }
    })();
    if (stashed) {
      try { sessionStorage.removeItem("thrivein_post_auth_redirect"); } catch {}
      navigate(stashed);
      return;
    }
    const pendingEventJoin = sessionStorage.getItem("pending_event_join");
    if (pendingEventJoin) {
      sessionStorage.removeItem("pending_event_join");
      navigate(`/event/${pendingEventJoin}`);
    } else if (pendingConnect) {
      navigate(`/profile/${pendingConnect}?from=match`);
    } else {
      navigate("/");
    }
  };

  const goSetRate = () => {
    onOpenChange(false);
    navigate("/profile?edit=rate");
  };

  const goBrowseGigs = () => {
    onOpenChange(false);
    navigate("/opportunities");
  };

  const firstName = fullName?.split(" ")[0] || "Creator";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-border max-h-[92dvh] overflow-y-auto"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <DialogTitle className="sr-only">{fullName}'s profile is live</DialogTitle>

        {/* Confetti anchors */}
        <div className="absolute top-0 left-1/4 z-50"><Confetti active={showConfetti} config={confettiConfig} /></div>
        <div className="absolute top-0 left-1/2 z-50"><Confetti active={showConfetti} config={confettiConfig} /></div>
        <div className="absolute top-0 left-3/4 z-50"><Confetti active={showConfetti} config={confettiConfig} /></div>

        {/* Header — same cinematic aurora plate as the landing/tutorial surfaces, now theme-aware */}
        <div className="relative pt-10 pb-7 px-6 text-center overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(65% 60% at 50% 0%, rgba(255,45,161,0.18), transparent 65%)" }}
          />

          <div className="relative">
            <p
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] mb-4 px-2.5 py-1 rounded-full border"
              style={{ borderColor: "rgba(255,45,161,0.3)", backgroundColor: "rgba(255,45,161,0.06)", color: ACCENT }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
              Your profile is live
            </p>

            <div className="flex justify-center mb-3">
              <Avatar
                className="h-24 w-24 shadow-2xl"
                style={{ boxShadow: "0 0 0 4px rgba(255,45,161,0.45), 0 0 46px rgba(255,45,161,0.35)" }}
              >
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="text-foreground text-2xl font-bold" style={{ backgroundColor: "rgba(255,45,161,0.2)" }}>
                  {firstName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            </div>

            <h2 className="landing-h2 landing-glow text-2xl mb-0.5" style={{ color: "hsl(var(--foreground))" }}>{fullName}</h2>
            {role && <p className="text-foreground/70 text-sm font-medium">{role}</p>}

            {creditsCount > 0 && (
              <div
                className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
                style={{ borderColor: "rgba(255,45,161,0.25)", backgroundColor: "rgba(255,45,161,0.06)", color: "hsl(var(--foreground))" }}
              >
                <Check className="h-3 w-3" style={{ color: ACCENT }} />
                {creditsCount} verified credit{creditsCount === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>

        <div className="relative p-5 space-y-5">
          {/* Pride copy */}
          <div className="text-center space-y-1">
            <p className="text-base font-bold text-foreground">
              Way to go, {firstName}<span className="pink-glow-breathe" style={{ color: ACCENT }}>.</span> Your creative résumé is ready.
            </p>
            <p className="text-xs text-foreground/50">
              Share it now to get your first profile views.
            </p>
          </div>

          {/* PRIMARY: Share buttons */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
                Share your profile
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="btn-glass btn-glass-primary w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied — paste anywhere" : "Copy profile link"}
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleWhatsApp}
                className="btn-glass btn-glass-outline h-10 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={handleInstagram}
                className="btn-glass btn-glass-outline h-10 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg"
              >
                <Instagram className="h-3.5 w-3.5" />
                Instagram
              </button>
              <button
                type="button"
                onClick={handleTwitter}
                className="btn-glass btn-glass-outline h-10 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg"
              >
                <Twitter className="h-3.5 w-3.5" />
                X / Twitter
              </button>
            </div>

            <p className="text-[10px] text-center text-foreground/30 font-mono truncate">
              {profileUrl.replace("https://www.", "")}
            </p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center">
              <span style={{ backgroundColor: "hsl(var(--background))" }} className="px-2 text-[10px] uppercase tracking-widest text-foreground/40">
                Or do this next
              </span>
            </div>
          </div>

          {/* SECONDARY: Next-step CTAs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={goSetRate}
              className="btn-glass btn-glass-neutral text-left p-3 rounded-xl"
            >
              <DollarSign className="h-4 w-4 mb-1.5" style={{ color: ACCENT }} />
              <p className="text-xs font-semibold text-foreground">Set your rate</p>
              <p className="text-[10px] text-foreground/50">Get hired faster</p>
            </button>
            <button
              type="button"
              onClick={goBrowseGigs}
              className="btn-glass btn-glass-neutral text-left p-3 rounded-xl"
            >
              <Briefcase className="h-4 w-4 mb-1.5" style={{ color: ACCENT }} />
              <p className="text-xs font-semibold text-foreground">Browse gigs</p>
              <p className="text-[10px] text-foreground/50">Apply with one tap</p>
            </button>
          </div>

          {/* Continue */}
          <button
            type="button"
            onClick={handleContinue}
            className="w-full inline-flex items-center justify-center gap-2 text-sm text-foreground/50 hover:text-[hsl(var(--energy))] transition-colors py-1"
          >
            Skip for now — go to my home
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
