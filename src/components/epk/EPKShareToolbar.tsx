import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Share2, Copy, Check, MessageCircle, Send, FileDown, Loader2, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { useNavigate } from "react-router-dom";

interface EPKShareToolbarProps {
  profileName: string;
  profileRole: string;
  userId: string;
  epkPdfData?: any; // EPKPdfInput passed from parent
}

export const EPKShareToolbar = ({ profileName, profileRole, userId, epkPdfData }: EPKShareToolbarProps) => {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { subscriptionInfo } = useAuth();
  const navigate = useNavigate();
  const isPro = hasProAccess((subscriptionInfo?.tier || 'free') as any);

  // Use the static OG-tagged share path so previews show avatar + name + role.
  // The page redirects instantly to /epk/:userId after the crawler reads meta.
  const epkUrl = `https://www.kretopia.com/share/epk/${userId}/`;
  const shareText = `${profileName} — ${profileRole}\nCreative Passport · Verified on Kretopia\n\n`;
  const shortShareText = `${profileName} — ${profileRole} · Creative Passport on Kretopia`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profileName} — ${profileRole} | Kretopia`,
          text: shortShareText,
          url: epkUrl,
        });
      } catch (e) {
        // User cancelled share
      }
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText + epkUrl)}`;
    window.open(url, '_blank');
  };

  const handleInstagram = () => {
    navigator.clipboard.writeText(`${shortShareText}\n${epkUrl}`);
    toast.success("Link & caption copied! Paste it in your Instagram Story or bio.");
  };

  const handleX = () => {
    const text = `${shortShareText}`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(epkUrl)}`;
    window.open(url, '_blank');
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(epkUrl);
    setCopied(true);
    toast.success("EPK link copied!");
    const { trackDeckEvent } = await import("@/lib/deckMetrics");
    void trackDeckEvent("epk_link_shared", "share", { profile_user_id: userId, surface: "copy" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!isPro) {
      toast.error("Creator plan required", {
        description: "Upgrade to Creator or Creator+ to download your EPK as a professional PDF deck.",
        action: {
          label: "Upgrade",
          onClick: () => navigate("/subscription"),
        },
      });
      return;
    }

    if (!epkPdfData) {
      toast.error("Profile data not ready. Please try again.");
      return;
    }

    setGenerating(true);
    try {
      const { generateEPKPdf } = await import("@/lib/epkPdfGenerator");
      await generateEPKPdf(epkPdfData);
      const { trackDeckEvent } = await import("@/lib/deckMetrics");
      void trackDeckEvent("epk_pdf_downloaded", "passport", { profile_user_id: userId });
      toast.success("EPK PDF downloaded!");
    } catch (error) {
      console.error("EPK PDF generation error:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Share your Creative Passport</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Download PDF Button */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 touch-manipulation border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleDownloadPdf}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {generating ? 'Generating...' : 'PDF'}
            {!isPro && <Crown className="h-3 w-3 text-amber-500" />}
          </Button>
          {navigator.share && (
            <Button
              size="sm"
              className="h-9 gap-1.5 touch-manipulation"
              onClick={handleNativeShare}
            >
              <Send className="h-3.5 w-3.5" />
              Share
            </Button>
          )}
        </div>
      </div>
      
      {/* Link preview */}
      <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-background border text-xs">
        <span className="truncate text-muted-foreground flex-1 font-mono">{epkUrl}</span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 shrink-0 touch-manipulation"
          onClick={handleCopyLink}
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* Share buttons — 44px min touch targets */}
      <div className="grid grid-cols-4 gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-11 flex-col gap-0.5 text-[10px] touch-manipulation"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-4 w-4 text-green-500" />
          WhatsApp
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-11 flex-col gap-0.5 text-[10px] touch-manipulation"
          onClick={handleInstagram}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
          </svg>
          Instagram
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-11 flex-col gap-0.5 text-[10px] touch-manipulation"
          onClick={handleX}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          X
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-11 flex-col gap-0.5 text-[10px] touch-manipulation"
          onClick={handleCopyLink}
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
};
