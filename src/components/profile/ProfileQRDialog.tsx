import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBrandHeader } from "@/components/ui/dialogBrand";
import { DIALOG_BODY } from "@/components/ui/dialogBrand.tokens";
import { Button } from "@/components/ui/button";
import { KretopiaQRCode } from "@/components/brand/KretopiaQRCode";
import { Download, Share2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userAvatar?: string;
}

export const ProfileQRDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
}: ProfileQRDialogProps) => {
  const { toast } = useToast();
  const connectUrl = `https://www.kretopia.com/profile/${userId}`;
  const passportId = `KRT-${userId.replace(/-/g, "").slice(0, 5).toUpperCase()}`;
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  useEffect(() => { if (!open) setQrBlob(null); }, [open, userId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(connectUrl);
      toast({
        title: "Link Copied!",
        description: "Share this link to connect with others",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (!qrBlob) return;
    const url = URL.createObjectURL(qrBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kretopia-passport-${passportId}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Connect with ${userName} on Kretopia`,
          text: `Scan my QR code or use this link to connect with me on Kretopia`,
          url: connectUrl,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        await handleCopyLink();
      }
    } else {
      await handleCopyLink();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The reference for every authenticated modal (see ui/dialogBrand.tokens.ts): `brand` makes it wear the surface for a visitor too. */}
      <DialogContent brand className="max-w-sm p-0">
        <DialogBrandHeader title="Passport QR" description={<>{userName || "Your passport"} · {passportId}</>} />

        <div className={`flex flex-col items-center gap-3 ${DIALOG_BODY}`}>
          <div role="img" aria-label={`Kretopia QR code for ${userName || "this passport"}`} className="rounded-md border border-energy/30 bg-[hsl(var(--qr-paper))] p-3 shadow-md">
            {open && <KretopiaQRCode data={connectUrl} size={224} className="overflow-hidden rounded-sm" onReady={setQrBlob} />}
          </div>
          <p className="text-center text-sm text-muted-foreground">Scan to open this public passport</p>
          <div className="flex w-full gap-2 border-t border-border pt-4">
            <Button onClick={handleShare} className="min-w-0 flex-1 gap-2" aria-label="Share passport link"><Share2 className="h-4 w-4" />Share</Button>
            <Button onClick={handleCopyLink} variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Copy passport link" title="Copy passport link"><Copy className="h-4 w-4" /></Button>
            <Button onClick={handleDownload} disabled={!qrBlob} variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Download passport QR as PNG" title="Download passport QR as PNG"><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
