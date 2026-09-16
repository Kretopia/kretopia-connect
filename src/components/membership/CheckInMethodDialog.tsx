import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Smartphone } from "lucide-react";
import { NFCReader } from "@/lib/nfcUtils";

interface CheckInMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectQR: () => void;
  onSelectNFC: () => void;
}

export const CheckInMethodDialog = ({
  open,
  onOpenChange,
  onSelectQR,
  onSelectNFC,
}: CheckInMethodDialogProps) => {
  const nfcSupported = NFCReader.isSupported();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-In Method</DialogTitle>
          <DialogDescription>
            Choose how you'd like to check in at this location
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Button
            onClick={() => {
              onSelectQR();
              onOpenChange(false);
            }}
            className="h-24 flex flex-col gap-2"
            variant="outline"
          >
            <QrCode className="h-8 w-8" />
            <div className="text-center">
              <div className="font-semibold">Scan QR Code</div>
              <div className="text-xs text-muted-foreground">
                Use your camera to scan
              </div>
            </div>
          </Button>

          <Button
            onClick={() => {
              onSelectNFC();
              onOpenChange(false);
            }}
            className="h-24 flex flex-col gap-2"
            variant="outline"
            disabled={!nfcSupported}
          >
            <Smartphone className="h-8 w-8" />
            <div className="text-center">
              <div className="font-semibold">Tap NFC Tag</div>
              <div className="text-xs text-muted-foreground">
                {nfcSupported
                  ? "Quick and contactless"
                  : "Not supported on this device"}
              </div>
            </div>
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Both methods verify your location for security
        </div>
      </DialogContent>
    </Dialog>
  );
};
