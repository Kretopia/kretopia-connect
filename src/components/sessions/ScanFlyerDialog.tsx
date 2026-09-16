import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractInvokeError } from "@/lib/extractInvokeError";

export interface ScannedEventDetails {
  title?: string;
  description?: string;
  category?: string;
  start_date?: string | null;
  start_time?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  max_participants?: number | null;
  is_ticketed?: boolean;
  ticket_price?: number | null;
  ticket_currency?: string | null;
  external_ticket_url?: string | null;
}

interface PreparedFlyerImage {
  base64: string;
  mimeType: string;
}

interface CapturedFlyerFile {
  dataUrl: string;
  file: File;
  mimeType: string;
}

interface ScanFlyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (details: ScannedEventDetails, flyerFile: File, flyerPreview: string) => void;
}

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("This image could not be read."));
    reader.readAsDataURL(file);
  });

const dataUrlToFile = (dataUrl: string, filename: string, fallbackType: string): File => {
  const [header, payload = ""] = dataUrl.split(",");
  const mimeType = header.match(/data:([^;]+)/)?.[1] || fallbackType || "image/jpeg";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename || "event-flyer.jpg", { type: mimeType });
};

const captureFlyerFile = async (file: File): Promise<CapturedFlyerFile> => {
  // Android WebViews/photo pickers can revoke file handles after the picker closes.
  // Copy the bytes into memory immediately, then only use this safe in-memory File.
  const dataUrl = await readFileAsDataUrl(file);
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("Choose a JPG, PNG, or screenshot image.");
  }
  const safeFile = dataUrlToFile(dataUrl, file.name, file.type || "image/jpeg");
  return { dataUrl, file: safeFile, mimeType: safeFile.type || file.type || "image/jpeg" };
};

// Compress + resize image client-side to keep payloads small and fast.
// Returns base64 (no data: prefix) and MIME type.
const compressImage = (sourceDataUrl: string, maxWidth = 1600, quality = 0.85): Promise<PreparedFlyerImage> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported on this device"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
        if (!blob) return reject(new Error("Could not prepare this image."));
        resolve({ base64: await blobToBase64(blob), mimeType: "image/jpeg" });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error("Could not read this image file. Try a JPG or PNG."));
    };
    img.src = sourceDataUrl;
  });

const prepareImageForScan = async (captured: CapturedFlyerFile): Promise<PreparedFlyerImage> => {
  try {
    return await compressImage(captured.dataUrl);
  } catch (err) {
    // Mobile WebViews sometimes fail to decode camera/gallery files for canvas/FileReader.
    // Raw byte reading is more reliable and still lets the scanner inspect supported formats.
    console.warn("compressImage failed, sending raw file bytes:", err);
    return {
      base64: captured.dataUrl.split(",")[1] || await blobToBase64(captured.file),
      mimeType: captured.mimeType,
    };
  }
};

export const ScanFlyerDialog = ({ open, onOpenChange, onExtracted }: ScanFlyerDialogProps) => {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 12MB", variant: "destructive" });
      return;
    }
    setScanning(true);
    try {
      const captured = await captureFlyerFile(file);
      const { base64: image_base64, mimeType: image_mime_type } = await prepareImageForScan(captured);
      if (!image_base64) throw new Error("Could not prepare this image file.");

      const { data, error } = await supabase.functions.invoke("extract-event-details", {
        body: { image_base64, image_mime_type, extract_only: true },
      });

      if (error) {
        const realMsg = await extractInvokeError(error);
        throw new Error(realMsg || "We couldn't reach the flyer scanner. Try again in a moment.");
      }
      if (data?.error) throw new Error(String(data.error));
      if (!data?.extracted) {
        throw new Error("We couldn't read enough details from this flyer. Try a clearer photo with the title, date and venue visible.");
      }

      onExtracted(data.extracted as ScannedEventDetails, captured.file, captured.dataUrl);
      onOpenChange(false);
      toast({ title: "Flyer scanned", description: "We filled in what we could find. Review and tweak." });
    } catch (err: any) {
      const msg = err?.message || "Could not read the flyer";
      console.error("ScanFlyerDialog error:", err);
      toast({
        title: "Scan failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !scanning && onOpenChange(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" /> Scan a flyer
          </DialogTitle>
          <DialogDescription>
            Upload an event flyer or screenshot — we'll auto-fill the title, date, venue, ticket info and more.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          type="button"
          variant="gradient"
          className="w-full gap-2"
          onClick={handlePick}
          disabled={scanning}
        >
          {scanning ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Reading flyer…</>
          ) : (
            <><Upload className="h-4 w-4" /> Choose flyer image</>
          )}
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">
          JPG, PNG, screenshots up to 12MB. The flyer is also used as your cover image.
        </p>
      </DialogContent>
    </Dialog>
  );
};
