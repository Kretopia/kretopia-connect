import { useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImagePlus, X, Sparkles, Loader2, Crop, Check } from "lucide-react";
import Cropper from "react-easy-crop";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EventCoverPickerProps {
  coverPreview: string | null;
  onCoverChange: (file: File | null, preview: string | null) => void;
  eventTitle?: string;
  eventCategory?: string;
}

const getCroppedImg = (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, pixelCrop.width, pixelCrop.height
      );
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/jpeg", 0.92);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
};

export const EventCoverPicker = ({
  coverPreview,
  onCoverChange,
  eventTitle = "",
  eventCategory = "creative",
}: EventCoverPickerProps) => {
  const { toast } = useToast();
  const [showCropper, setShowCropper] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // The <input accept="image/*"> hint is a filter suggestion only, not a
    // guarantee — validate the actual MIME type before it ever reaches the
    // cropper/upload path (deliberately excludes image/svg+xml, which can
    // carry embedded scripts).
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: "Unsupported file type", description: "Please choose a JPG, PNG, WEBP, or GIF image.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setCropSource(url);
    setShowCropper(true);
  };

  const onCropComplete = useCallback((_: any, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropDone = async () => {
    if (!cropSource || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(cropSource, croppedAreaPixels);
      const file = new File([blob], `event-cover-${Date.now()}.jpg`, { type: "image/jpeg" });
      const preview = URL.createObjectURL(blob);
      onCoverChange(file, preview);
      setShowCropper(false);
      setCropSource(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch {
      toast({ title: "Crop failed", variant: "destructive" });
    }
  };

  const handleAiGenerate = async () => {
    const prompt = aiPrompt.trim() || `A stunning, vibrant event cover image for a ${eventCategory} event called "${eventTitle}". Professional, modern, creative atmosphere.`;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-event-cover", {
        body: { prompt },
      });
      if (error) throw error;
      if (!data?.imageUrl) throw new Error("No image returned");

      // Convert base64 data URL to file
      const resp = await fetch(data.imageUrl);
      const blob = await resp.blob();
      const file = new File([blob], `ai-cover-${Date.now()}.png`, { type: "image/png" });
      
      // Open cropper with AI image
      setCropSource(data.imageUrl);
      setShowCropper(true);
      setShowAiDialog(false);
      setAiPrompt("");
      
      // Store the file temporarily for after crop
      (window as any).__aiCoverFile = file;

      toast({ title: "Image generated!", description: "Crop it to fit your event." });
    } catch (err: any) {
      const msg = err?.message || "Failed to generate image";
      if (msg.includes("429") || msg.includes("rate")) {
        toast({ title: "Too many requests", description: "Please wait a moment and try again.", variant: "destructive" });
      } else if (msg.includes("402")) {
        toast({ title: "Credits needed", description: "Generation credits have been exhausted.", variant: "destructive" });
      } else {
        toast({ title: "Generation failed", description: msg, variant: "destructive" });
      }
    } finally {
      setGenerating(false);
    }
  };

  const removeCover = () => {
    onCoverChange(null, null);
  };

  return (
    <>
      <div className="space-y-2">
        <Label>Cover Image / Flyer</Label>
        {coverPreview ? (
          <div className="relative rounded-lg overflow-hidden border">
            <img src={coverPreview} alt="Cover preview" className="w-full h-40 object-cover" />
            <div className="absolute top-2 right-2 flex gap-1.5">
              <Button type="button" size="icon" variant="secondary" className="h-7 w-7 bg-background/70 backdrop-blur-sm"
                onClick={() => { setCropSource(coverPreview); setShowCropper(true); }}>
                <Crop className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={removeCover}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <ImagePlus className="h-7 w-7 text-muted-foreground mb-1.5" />
              <span className="text-sm text-muted-foreground">Upload a flyer or cover image</span>
              <span className="text-xs text-muted-foreground">JPG, PNG up to 5MB</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </label>
            <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-sm"
              onClick={() => setShowAiDialog(true)}>
              <Sparkles className="h-4 w-4 text-primary" /> Generate with AI
            </Button>
          </div>
        )}
      </div>

      {/* Cropper Dialog */}
      <Dialog open={showCropper} onOpenChange={(open) => { if (!open) { setShowCropper(false); setCropSource(null); } }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Crop Image</DialogTitle>
          </DialogHeader>
          <div className="relative h-[55vh] sm:h-[60vh] bg-black">
            {cropSource && (
              <Cropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={4 / 5}
                objectFit="contain"
                restrictPosition={false}
                minZoom={0.4}
                maxZoom={3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="p-4 space-y-3 bg-background">
            <p className="text-[11px] text-muted-foreground text-center">
              Pinch or drag to position. Use zoom to fit your full flyer.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground shrink-0">Zoom</span>
              <input
                type="range"
                min={0.4}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowCropper(false); setCropSource(null); }}>
                Cancel
              </Button>
              <Button type="button" variant="default" className="flex-1 gap-1.5" onClick={handleCropDone}>
                <Check className="h-4 w-4" /> Apply Crop
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Generate Cover with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Describe the image you want</Label>
              <Input
                placeholder={`e.g., A vibrant ${eventCategory} event poster with neon lights`}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={generating}
              />
              <p className="text-xs text-muted-foreground">Leave empty for an auto-generated image based on your event details.</p>
            </div>
            <Button
              type="button"
              variant="gradient"
              className="w-full gap-2"
              onClick={handleAiGenerate}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Image</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
