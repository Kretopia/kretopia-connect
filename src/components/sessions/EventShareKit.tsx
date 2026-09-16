import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Copy, Check, Share2, Download, 
  MessageCircle, Twitter, Code2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCodeStyling from "qr-code-styling";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { buildWarmShareMessage, buildEventShareUrl, logShareClick, type ShareChannel } from "@/lib/eventActions";

interface EventShareKitProps {
  event: {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    venue_name?: string;
    category: string;
    is_ticketed?: boolean | null;
    ticket_price?: number | null;
    ticket_currency?: string | null;
    created_by?: string;
  };
  hostFirstName?: string | null;
  attendeeCount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EventShareKit = ({ event, hostFirstName, attendeeCount, open, onOpenChange }: EventShareKitProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name?: string | null; username?: string | null } | null>(null);
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from('profiles').select('full_name, username').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setProfile(data as any), () => setProfile(null));
  }, [user?.id]);
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCode = useRef<QRCodeStyling | null>(null);

  const isHost = !!user && event.created_by === user.id;
  const sharerFirstName = profile?.full_name?.split(" ")[0] || null;
  const sharerUsername = profile?.username || null;

  const eventUrl = buildEventShareUrl(event.id, sharerUsername);

  const { text: defaultShareText } = buildWarmShareMessage(
    {
      id: event.id,
      title: event.title,
      startTime: event.start_time,
      venueName: event.venue_name,
      isTicketed: event.is_ticketed,
      ticketPrice: event.ticket_price,
      ticketCurrency: event.ticket_currency,
      attendeeCount: attendeeCount,
    },
    {
      hostFirstName,
      sharerFirstName,
      sharerUsername,
      isHost,
    }
  );

  // Reset custom message whenever the dialog re-opens for a fresh event
  useEffect(() => {
    if (open) setCustomMessage(defaultShareText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event.id]);

  const shareText = customMessage || defaultShareText;

  useEffect(() => {
    if (open && qrRef.current) {
      qrCode.current = new QRCodeStyling({
        width: 200,
        height: 200,
        data: eventUrl,
        dotsOptions: { color: "#7B61FF", type: "rounded" },
        cornersSquareOptions: { color: "#9413D2", type: "extra-rounded" },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: { crossOrigin: "anonymous" },
      });
      qrRef.current.innerHTML = '';
      qrCode.current.append(qrRef.current);
    }
  }, [open, eventUrl]);

  const track = (channel: ShareChannel) => {
    logShareClick(event.id, channel, user?.id || null).catch(() => {});
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    toast({ title: "Link copied!" });
    track("copy");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(shareText);
    toast({ title: "Message copied — paste anywhere" });
    track("copy");
  };

  const downloadQR = () => {
    qrCode.current?.download({ 
      name: `kretopia-event-${event.id.slice(0, 8)}`, 
      extension: "png" 
    });
    track("qr");
  };

  const shareNative = async () => {
    track("native");
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: shareText });
      } catch {}
    } else {
      copyMessage();
    }
  };

  const shareWhatsApp = () => {
    track("whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareTwitter = () => {
    track("twitter");
    // Twitter handles URL preview from text — pass message + URL separately for richer card
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const embedCode = `<iframe src="${eventUrl}&embed=1" width="400" height="500" frameborder="0" style="border-radius: 12px; max-width: 100%;"></iframe>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {isHost ? "Invite your people" : "Tell a friend"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Editable warm message */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Your message</Label>
            <Textarea
              value={shareText}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={7}
              className="text-sm resize-none"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {sharerUsername ? `Tracked link: ?ref=${sharerUsername}` : "Add a username to track invites"}
              </p>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={copyMessage}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
          </div>

          {/* Quick share row */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Send via</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="flex-col h-auto py-3 gap-1" onClick={shareNative}>
                <Share2 className="h-5 w-5" />
                <span className="text-xs">Share</span>
              </Button>
              <Button variant="outline" className="flex-col h-auto py-3 gap-1" onClick={shareWhatsApp}>
                <MessageCircle className="h-5 w-5 text-primary" />
                <span className="text-xs">WhatsApp</span>
              </Button>
              <Button variant="outline" className="flex-col h-auto py-3 gap-1" onClick={shareTwitter}>
                <Twitter className="h-5 w-5 text-primary" />
                <span className="text-xs">X / Twitter</span>
              </Button>
            </div>
          </div>

          {/* Quick Link */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Direct link</Label>
            <div className="flex gap-2">
              <Input value={eventUrl} readOnly className="text-sm" />
              <Button size="icon" variant="outline" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* QR Code (collapsed feel) */}
          <details className="rounded-lg border border-border/50 overflow-hidden">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium bg-muted/30 select-none">
              QR Code · for posters & flyers
            </summary>
            <div className="flex flex-col items-center gap-3 p-4">
              <div ref={qrRef} className="rounded-lg overflow-hidden" />
              <Button size="sm" variant="outline" onClick={downloadQR}>
                <Download className="h-4 w-4 mr-2" /> Download QR
              </Button>
            </div>
          </details>

          {/* Embed Code */}
          <details className="rounded-lg border border-border/50 overflow-hidden">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium bg-muted/30 select-none flex items-center gap-2">
              <Code2 className="h-4 w-4" /> Embed on your site
            </summary>
            <div className="p-4 space-y-2">
              <Textarea value={embedCode} readOnly rows={3} className="text-xs font-mono" />
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(embedCode);
                  toast({ title: "Embed code copied!" });
                  track("embed");
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy embed code
              </Button>
            </div>
          </details>

          {sharerUsername && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> Every RSVP from your link is attributed to you — so when we launch
                Promoter rewards, your shares already count.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
