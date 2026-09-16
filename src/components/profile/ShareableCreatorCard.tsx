import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, Share2, Shield, Sparkles, Copy, Check, MessageCircle, Twitter, Link2, Instagram } from "lucide-react";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { APP_URL } from "@/lib/constants";

interface CreatorCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: {
    full_name: string;
    role: string;
    avatar_url?: string | null;
    bio?: string | null;
    badge?: string | null;
    level?: number;
    xp?: number;
    location?: string | null;
    professional_skills?: Array<{ skill: string }> | null;
    user_id?: string;
  };
}

const BADGE_LABELS: Record<string, { label: string; color: string }> = {
  og: { label: "OG Member", color: "from-yellow-400 to-amber-600" },
  beta: { label: "Beta Pioneer", color: "from-amber-400 to-orange-600" },
  official: { label: "Official", color: "from-primary to-primary" },
  founder: { label: "Founder", color: "from-primary to-primary" },
  odos: { label: "ODOS", color: "from-emerald-400 to-emerald-600" },
};

export function ShareableCreatorCard({ open, onOpenChange, profile }: CreatorCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const skills = profile.professional_skills?.slice(0, 4) || [];
  const badgeInfo = profile.badge ? BADGE_LABELS[profile.badge] : null;

  const getProfileUrl = () => {
    if (profile.user_id) {
      return `${APP_URL}/profile/${profile.user_id}`;
    }
    return `${APP_URL}/u/${profile.full_name?.replace(/\s+/g, "-").toLowerCase() || "creator"}`;
  };

  const getShareText = () => {
    return `Check out ${profile.full_name}'s creative profile on Kretopia!`;
  };

  const generateCardBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
      });
    } catch (err) {
      console.error("Card generation error:", err);
      return null;
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${profile.full_name?.replace(/\s+/g, "-").toLowerCase() || "creator"}-kretopia.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Card downloaded!", description: "Share it on your socials" });
    } catch (err) {
      console.error("Download error:", err);
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    const profileUrl = getProfileUrl();
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    // First try native share with file (works on mobile)
    if (navigator.share) {
      try {
        const blob = await generateCardBlob();
        if (blob) {
          const file = new File([blob], "creator-card.png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${profile.full_name} on Kretopia`,
              text: getShareText(),
              files: [file],
            });
            return;
          }
        }
        // Try share without file
        await navigator.share({
          title: `${profile.full_name} on Kretopia`,
          text: getShareText(),
          url: getProfileUrl(),
        });
        return;
      } catch (err: any) {
        // User cancelled or share failed — fall through to manual options
        if (err?.name === "AbortError") return;
        console.log("Native share unavailable, showing manual options");
      }
    }
    
    // Fallback: show manual share options
    setShowShareOptions(true);
  };

  const shareToWhatsApp = () => {
    const url = getProfileUrl();
    const text = encodeURIComponent(`${getShareText()}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareToTwitter = () => {
    const url = getProfileUrl();
    const text = encodeURIComponent(getShareText());
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, "_blank");
  };

  const shareToInstagramStory = async () => {
    // Instagram doesn't have a web share URL for stories, so download the card
    // and prompt the user
    await handleDownload();
    toast({
      title: "Card downloaded!",
      description: "Open Instagram → Stories → Add from gallery to share your card",
    });
  };

  const shareViaEmail = () => {
    const url = getProfileUrl();
    const subject = encodeURIComponent(`${profile.full_name} on Kretopia`);
    const body = encodeURIComponent(`${getShareText()}\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setShowShareOptions(false); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Your Creator Card
          </DialogTitle>
        </DialogHeader>

        {/* The actual card */}
        <div className="flex justify-center py-4">
          <div
            ref={cardRef}
            className="w-[360px] rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 40%, #2d1b69 70%, #1a0a2e 100%)" }}
          >
            {/* Top pattern */}
            <div className="relative h-20 overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: `${30 + i * 15}px`,
                      height: `${30 + i * 15}px`,
                      left: `${10 + i * 18}%`,
                      top: `${-10 + (i % 2) * 30}%`,
                      background: `radial-gradient(circle, ${i % 2 === 0 ? "#a855f7" : "#ec4899"} 0%, transparent 70%)`,
                    }}
                  />
                ))}
              </div>
              <div className="absolute top-3 right-4 flex items-center gap-1">
                <span className="text-white/60 text-[10px] font-medium tracking-wider">KRETOPIA</span>
              </div>
            </div>

            {/* Profile section */}
            <div className="px-6 -mt-8 pb-6 text-center">
              <div className="relative inline-block mb-3">
                <div className="w-20 h-20 rounded-full border-[3px] border-primary/50 overflow-hidden bg-gray-800">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/50">
                      {profile.full_name?.[0] || "?"}
                    </div>
                  )}
                </div>
                {badgeInfo && (
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r ${badgeInfo.color} rounded-full px-2 py-0.5 flex items-center gap-0.5`}>
                    <Shield className="h-2.5 w-2.5 text-white" />
                    <span className="text-[8px] text-white font-bold whitespace-nowrap">{badgeInfo.label}</span>
                  </div>
                )}
              </div>

              <h3 className="text-white font-bold text-lg leading-tight">{profile.full_name || "Creator"}</h3>
              <p className="text-primary text-sm mt-0.5">{profile.role || "Creative"}</p>
              {profile.location && (
                <p className="text-white/40 text-xs mt-1">{profile.location}</p>
              )}

              {profile.bio && (
                <p className="text-white/60 text-xs mt-3 leading-relaxed line-clamp-2">
                  {profile.bio}
                </p>
              )}

              {skills.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                  {skills.map((s, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-medium text-white/80 border border-primary/30 bg-primary/10"
                    >
                      {s.skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/10">
                <div className="text-center">
                  <p className="text-white font-bold text-sm">{profile.level || 1}</p>
                  <p className="text-white/40 text-[9px]">LEVEL</p>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="text-center">
                  <p className="text-white font-bold text-sm">{profile.xp || 0}</p>
                  <p className="text-white/40 text-[9px]">XP</p>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="text-center">
                  <p className="text-primary font-bold text-sm"></p>
                  <p className="text-white/40 text-[9px]">CREATOR</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5">
                <p className="text-white/30 text-[9px] tracking-widest">JOIN THE CREATIVE NETWORK</p>
                <p className="text-primary text-[10px] font-medium mt-0.5">kretopia.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Share options panel */}
        {showShareOptions && (
          <div className="grid grid-cols-4 gap-3 py-3 px-2 border rounded-xl border-border bg-muted/30">
            <button onClick={shareToWhatsApp} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-accent transition-colors">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-green-500" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">WhatsApp</span>
            </button>
            <button onClick={shareToInstagramStory} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-accent transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Instagram className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Instagram</span>
            </button>
            <button onClick={shareToTwitter} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-accent transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Twitter className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">X / Twitter</span>
            </button>
            <button onClick={shareViaEmail} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-accent transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Email</span>
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleDownload} disabled={downloading} variant="outline" className="flex-1 gap-2">
            <Download className="h-4 w-4" />
            {downloading ? "Saving..." : "Download"}
          </Button>
          <Button onClick={handleShare} className="flex-1 gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button onClick={handleCopyLink} variant="ghost" size="icon">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
