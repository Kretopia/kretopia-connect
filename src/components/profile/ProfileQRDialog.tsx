import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
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
  userAvatar,
}: ProfileQRDialogProps) => {
  const { toast } = useToast();
  const connectUrl = `https://www.kretopia.com/profile/${userId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(connectUrl);
      toast({
        title: "Link Copied!",
        description: "Share this link to connect with others",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const svg = document.getElementById("profile-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1200;
      
      if (ctx) {
        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw QR code
        ctx.drawImage(img, 100, 200, 800, 800);
        
        // Add text
        ctx.fillStyle = "#000000";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`Connect with ${userName}`, canvas.width / 2, 100);
        
        ctx.font = "32px Arial";
        ctx.fillText("Scan to connect on Kretopia", canvas.width / 2, 1100);
      }

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `kretopia-${userName.replace(/\s+/g, "-")}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
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
        // User cancelled share or error occurred
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Your Connection QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* QR Code */}
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-2xl border-4 border-border bg-white p-6">
              <QRCodeSVG
                id="profile-qr-code"
                value={connectUrl}
                size={256}
                level="H"
                includeMargin={false}
                imageSettings={
                  userAvatar
                    ? {
                        src: userAvatar,
                        x: undefined,
                        y: undefined,
                        height: 50,
                        width: 50,
                        excavate: true,
                      }
                    : undefined
                }
              />
            </div>
            
            <div className="text-center space-y-1">
              <p className="font-semibold">{userName}</p>
              <p className="text-sm text-muted-foreground">
                Scan to connect on Kretopia
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">How it works:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Others scan your QR code with their phone</li>
              <li>If they have Kretopia: instant connection request</li>
              <li>New to Kretopia: sign up & auto-connect</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button onClick={handleShare} variant="outline" className="flex-1 gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button onClick={handleCopyLink} variant="outline" className="flex-1 gap-2">
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
