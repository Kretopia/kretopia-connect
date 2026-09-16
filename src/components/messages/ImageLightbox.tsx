import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface ImageLightboxProps {
  url: string | null;
  onClose: () => void;
}

export const ImageLightbox = ({ url, onClose }: ImageLightboxProps) => (
  <Dialog open={!!url} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
      <button onClick={onClose} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70">
        <X className="h-5 w-5" />
      </button>
      {url && <img src={url} alt="" className="w-full h-auto max-h-[85vh] object-contain" />}
    </DialogContent>
  </Dialog>
);
