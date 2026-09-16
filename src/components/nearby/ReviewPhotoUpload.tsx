import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Camera, X, Loader2 } from "lucide-react";

interface ReviewPhotoUploadProps {
  onPhotosUploaded: (urls: string[]) => void;
  existingPhotos?: string[];
}

export function ReviewPhotoUpload({ onPhotosUploaded, existingPhotos = [] }: ReviewPhotoUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(existingPhotos);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.length) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(e.target.files).slice(0, 5 - photos.length)) {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/reviews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('location-photos').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('location-photos').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      const updated = [...photos, ...newUrls];
      setPhotos(updated);
      onPhotosUploaded(updated);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
    onPhotosUploaded(updated);
  };

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((url, i) => (
            <div key={i} className="relative h-16 w-16 rounded-md overflow-hidden border border-border group">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < 5 && (
        <>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs gap-1 h-7"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            Add Photos ({photos.length}/5)
          </Button>
        </>
      )}
    </div>
  );
}
