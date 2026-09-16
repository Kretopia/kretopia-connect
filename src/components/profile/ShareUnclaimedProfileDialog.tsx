import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Share2, Mail, MessageCircle, Check } from "lucide-react";
import { getShareUrl } from "@/lib/constants";

interface ShareUnclaimedProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName: string;
  profileUrl: string;
}

export const ShareUnclaimedProfileDialog = ({
  open,
  onOpenChange,
  profileName,
  profileUrl
}: ShareUnclaimedProfileDialogProps) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Always use production URL for sharing
  const productionUrl = getShareUrl(profileUrl);
  
  const shareMessages = {
    claim: {
      title: "Is this you?",
      text: `Hey! I found your profile on Kretopia. Is this you? Claim it to unlock all features: ${productionUrl}`
    },
    simple: {
      title: "Check this out",
      text: `Check out ${profileName}'s profile on Kretopia: ${productionUrl}`
    }
  };

  const handleCopy = async (type: 'claim' | 'simple') => {
    try {
      await navigator.clipboard.writeText(shareMessages[type].text);
      setCopiedType(type);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedType(null), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleNativeShare = async (type: 'claim' | 'simple') => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareMessages[type].title,
          text: shareMessages[type].text,
          url: productionUrl
        });
      } catch (error) {
        // User cancelled or share failed
        if ((error as Error).name !== 'AbortError') {
          toast.error("Failed to share");
        }
      }
    } else {
      handleCopy(type);
    }
  };

  const handleWhatsApp = (type: 'claim' | 'simple') => {
    const text = encodeURIComponent(shareMessages[type].text);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleEmail = (type: 'claim' | 'simple') => {
    const subject = encodeURIComponent(shareMessages[type].title);
    const body = encodeURIComponent(shareMessages[type].text);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* "Is this you?" Option */}
          <div className="p-4 rounded-xl border bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
              Know this person? Help them claim their profile!
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              "{shareMessages.claim.text}"
            </p>
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleCopy('claim')}
                className="gap-1.5"
              >
                {copiedType === 'claim' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </Button>
              {navigator.share && (
                <Button 
                  size="sm" 
                  onClick={() => handleNativeShare('claim')}
                  className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleWhatsApp('claim')}
                className="gap-1.5"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleEmail('claim')}
                className="gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </Button>
            </div>
          </div>

          {/* Simple Share Option */}
          <div className="p-4 rounded-xl border">
            <p className="text-sm font-medium mb-2">Just share the profile</p>
            <p className="text-xs text-muted-foreground mb-3">
              "{shareMessages.simple.text}"
            </p>
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleCopy('simple')}
                className="gap-1.5"
              >
                {copiedType === 'simple' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </Button>
              {navigator.share && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleNativeShare('simple')}
                  className="gap-1.5"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
