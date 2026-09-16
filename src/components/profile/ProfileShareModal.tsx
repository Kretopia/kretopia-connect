import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, MessageCircle, Twitter, Instagram, Check, ExternalLink, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface ProfileShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string;
  role?: string;
  avatarUrl?: string;
  topCredit?: string | null;
  creditsCount?: number;
}

/**
 * Reusable share-my-profile dialog. Used by the Hub "Share my profile" CTA
 * and shares the same viral copy/share targets as the ProfileLaunchScreen.
 */
export function ProfileShareModal({
  open,
  onOpenChange,
  userId,
  fullName,
  role,
  avatarUrl,
  topCredit,
  creditsCount = 0,
}: ProfileShareModalProps) {
  const { toast } = useToast();
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

  const trackShare = async (channel: string) => {
    try {
      const { analytics } = await import("@/lib/analytics");
      analytics.featureUsed(`profile_hub_share_${channel}`);
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
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: "Link copied — open Instagram",
        description: "Paste into your story or bio.",
      });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const firstName = fullName?.split(" ")[0] || "Creator";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 border-none overflow-hidden bg-card">
        <DialogHeader className="sr-only">
          <DialogTitle>Share your profile</DialogTitle>
        </DialogHeader>

        {/* EPK-style preview header */}
        <div className="relative bg-gradient-to-br from-primary via-primary/80 to-energy/30 pt-7 pb-6 px-6 text-center">
          <div className="relative flex justify-center mb-3">
            <Avatar className="h-20 w-20 ring-4 ring-energy/80 shadow-xl">
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-primary/40 text-white text-xl font-bold">
                {firstName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">{fullName}</h2>
          {role && <p className="text-white/80 text-sm font-medium">{role}</p>}
          {creditsCount > 0 && (
            <p className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur text-white text-[11px] font-semibold">
              {creditsCount} verified credit{creditsCount === 1 ? "" : "s"}
            </p>
          )}

          <Link
            to={`/profile/${userId}`}
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-white/90 hover:text-white transition-colors underline-offset-2 hover:underline"
          >
            <Eye className="h-3 w-3" /> View public profile
          </Link>
        </div>

        {/* Share targets */}
        <div className="p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
            Share to
          </p>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleWhatsApp}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-all"
            >
              <div className="h-10 w-10 rounded-full bg-success/15 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-success" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">WhatsApp</span>
            </button>
            <button
              onClick={handleInstagram}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-all"
            >
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Instagram className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">Instagram</span>
            </button>
            <button
              onClick={handleTwitter}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-all"
            >
              <div className="h-10 w-10 rounded-full bg-foreground/10 flex items-center justify-center">
                <Twitter className="h-5 w-5 text-foreground" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">X / Twitter</span>
            </button>
          </div>

          <Button
            variant="hero"
            className="w-full h-11"
            onClick={handleCopy}
          >
            {copied ? (
              <><Check className="h-4 w-4" /> Copied!</>
            ) : (
              <><Copy className="h-4 w-4" /> Copy profile link</>
            )}
          </Button>

          <p className="text-[10px] text-center text-muted-foreground/70 break-all">
            {profileUrl.replace("https://", "")}
          </p>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full text-xs"
          >
            <Link to={`/profile/${userId}`}>
              <ExternalLink className="h-3.5 w-3.5" /> Open public profile
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
