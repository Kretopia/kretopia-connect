import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRCodeDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: any;
}

export function QRCodeDisplay({
  open,
  onOpenChange,
  location,
}: QRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  if (!location) return null;

  const checkInUrl = `https://www.kretopia.com/check-in?code=${location.qr_code}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${location.name.replace(/\s+/g, "-")}-QR.png`;
          a.click();
          URL.revokeObjectURL(url);

          toast({
            title: "Downloaded",
            description: "QR code saved successfully",
          });
        }
      });
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code - ${location.name}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 40px;
            }
            .container {
              text-align: center;
              max-width: 600px;
            }
            h1 {
              font-size: 32px;
              margin-bottom: 8px;
            }
            .subtitle {
              color: #666;
              font-size: 18px;
              margin-bottom: 40px;
            }
            .qr-container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              display: inline-block;
            }
            .instructions {
              margin-top: 40px;
              font-size: 16px;
              color: #666;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${location.name}</h1>
            <div class="subtitle">${location.address}, ${location.city}</div>
            <div class="qr-container">
              ${svg.outerHTML}
            </div>
            <div class="instructions">
              <p><strong>Scan to Check In</strong></p>
              <p>Earn ${location.points_per_visit} points per visit</p>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code for {location.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            ref={qrRef}
            className="flex flex-col items-center gap-4 p-6 bg-background rounded-lg border"
          >
            <QRCodeSVG
              value={checkInUrl}
              size={256}
              level="H"
              includeMargin={true}
            />
            <div className="text-center">
              <p className="font-semibold">{location.name}</p>
              <p className="text-sm text-muted-foreground">
                {location.address}
              </p>
              <p className="text-sm font-semibold text-primary mt-2">
                Scan to earn {location.points_per_visit} points
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
            <p className="font-semibold mb-1">Check-in URL:</p>
            <code className="break-all">{checkInUrl}</code>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex-1">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
