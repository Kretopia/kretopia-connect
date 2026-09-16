import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Scan, Upload, X, Loader2, Copy, Share2 } from "lucide-react";
import { APP_URL } from "@/lib/constants";

interface ScoutGigDialogProps {
  trigger?: React.ReactNode;
}

export const ScoutGigDialog = ({ trigger }: ScoutGigDialogProps) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [platform, setPlatform] = useState("facebook");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; claim_token: string } | null>(null);
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
    if (!text && !imageBase64) {
      toast({ title: "Add content", description: "Paste text or upload a screenshot", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-gig-details", {
        body: { text, image_base64: imageBase64, source_platform: platform },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.opportunity);
      toast({ title: "Gig scouted!", description: "Extracted and created the listing" });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getClaimUrl = () => {
    return `${APP_URL}/claim-gig/${result?.claim_token}`;
  };

  const handleCopyClaimLink = () => {
    const url = getClaimUrl();
    const shareText = `Hey! I listed your gig on Kretopia so creatives can find and apply directly. Claim it here to manage applicants, message talent, and fill the role faster:\n\n${url}`;
    navigator.clipboard.writeText(shareText);
    toast({ title: "Claim link copied!", description: "Send it to the person who posted this gig" });
  };

  const handleShareClaimLink = async () => {
    const url = getClaimUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Your gig is live on Kretopia", text: "I listed your gig so creatives can apply directly. Claim it to manage applicants and fill the role faster.", url });
      } catch { }
    } else {
      handleCopyClaimLink();
    }
  };

  const handleClose = () => {
    setOpen(false);
    setText("");
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Scan className="h-4 w-4" />
            Scout a Gig
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-primary" />
            Scout a Gig
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Spotted a casting or gig on social media? Paste the text or upload a screenshot — AI will extract the details and create a claimable listing.
            </p>

            <div>
              <Label>Where did you find it?</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Paste the gig text</Label>
              <Textarea
                placeholder="Copy & paste the casting call, job post, or opportunity description here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
              />
            </div>

            <div>
              <Label>Or upload a screenshot</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              {imagePreview ? (
                <div className="relative mt-2">
                  <img src={imagePreview} alt="Screenshot" className="rounded-lg border max-h-48 w-full object-contain" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => { setImagePreview(null); setImageBase64(null); }}
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
                  Upload Screenshot
                </Button>
              )}
            </div>

            <Button className="w-full gap-2" onClick={handleExtract} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
              {loading ? "Extracting details..." : "Extract & Create Gig"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
              <div className="text-3xl mb-2"></div>
              <h3 className="font-semibold text-lg">Gig Scouted Successfully!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Now send the claim link to the person who posted this gig so they can take ownership.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Claim Link</Label>
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
                Share Claim Link
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => window.open(`/opportunity/${result.id}`, '_blank')}>
                View Gig
              </Button>
            </div>

            <Button variant="ghost" className="w-full" onClick={handleClose}>
              Scout Another
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
