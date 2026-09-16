import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Scan, Upload, X, Loader2, Copy, Share2, ExternalLink, Calendar } from "lucide-react";
import { APP_URL } from "@/lib/constants";

interface ScoutEventDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export const ScoutEventDialog = ({ trigger, open: controlledOpen, onOpenChange }: ScoutEventDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [platform, setPlatform] = useState("flyer");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; claim_token: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async () => {
    if (!text.trim() && !imageBase64 && !url.trim()) {
      toast({
        title: "Add something to scout",
        description: "Paste the flyer text, upload a screenshot, or paste a link.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-event-details", {
        body: {
          text: text.trim() || undefined,
          image_base64: imageBase64 || undefined,
          source_url: url.trim() || undefined,
          source_platform: platform,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.event);
      toast({
        title: "Event scouted",
        description: "Now share the claim link with the host so they can take it over.",
      });
    } catch (err: any) {
      toast({ title: "Couldn't scout the event", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getClaimUrl = () => `${APP_URL}/claim-event/${result?.claim_token}`;

  const handleCopyClaimLink = () => {
    const claim = getClaimUrl();
    const shareText = `Hey! I spotted your event "${result?.title}" and listed it on Kretopia so creatives in the community can find it and RSVP. Claim it here to manage guests, send updates, and post photos:\n\n${claim}`;
    navigator.clipboard.writeText(shareText);
    toast({ title: "Claim link copied", description: "Send it to the event host." });
  };

  const handleShareClaimLink = async () => {
    const claim = getClaimUrl();
    const shareData = {
      title: `Your event is live on Kretopia`,
      text: `I scouted your event "${result?.title}" so creatives can find it. Claim it to manage RSVPs and message guests.`,
      url: claim,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopyClaimLink();
    }
  };

  const handleClose = () => {
    setOpen(false);
    setText("");
    setUrl("");
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-primary" />
            Scout an event
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Spotted a great event for the community? Drop a flyer, paste the details, or share a link —
              we'll list it as a draft and send a claim link to the host.
            </p>

            <div>
              <Label>Where did you find it?</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flyer">Flyer / poster</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="eventbrite">Eventbrite</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Event link (optional)</Label>
              <Input
                type="url"
                placeholder="https://eventbrite.com/... or any link with details"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div>
              <Label>Paste the details (optional)</Label>
              <Textarea
                placeholder="Copy & paste the event description, flyer text, caption, etc."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
              />
            </div>

            <div>
              <Label>Or upload a flyer / screenshot</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              {imagePreview ? (
                <div className="relative mt-2">
                  <img
                    src={imagePreview}
                    alt="Flyer preview"
                    className="rounded-lg border max-h-56 w-full object-contain bg-muted"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => {
                      setImagePreview(null);
                      setImageBase64(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-2 w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload flyer
                </Button>
              )}
            </div>

            <Button className="w-full gap-2" onClick={handleExtract} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
              {loading ? "Reading the details…" : "Scout this event"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              The event stays hidden from public discovery until the host claims it.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
              <Calendar className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-semibold text-lg">"{result.title}" is scouted</h3>
              <p className="text-sm text-muted-foreground mt-1">
                It's saved but hidden until the host claims it. Send them this link.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Claim link</Label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={getClaimUrl()}
                  className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs"
                />
                <Button size="icon" variant="outline" onClick={handleCopyClaimLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={handleShareClaimLink}>
                <Share2 className="h-4 w-4" />
                Share claim link
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open(`/event/${result.id}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Preview
              </Button>
            </div>

            <Button variant="ghost" className="w-full" onClick={() => {
              setText("");
              setUrl("");
              setImagePreview(null);
              setImageBase64(null);
              setResult(null);
            }}>
              Scout another
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
