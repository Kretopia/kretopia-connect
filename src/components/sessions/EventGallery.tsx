import { useRef, useState } from "react";
import { ImagePlus, X as XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";

const MAX_GALLERY = 6;

interface EventGalleryProps {
  eventId: string;
  urls: string[];
  isCreator: boolean;
  onChange: (urls: string[]) => void;
}

/** The event's photos. A visitor sees them when there are any; only the host sees the upload and remove controls. */
export function EventGallery({ eventId, urls, isCreator, onChange }: EventGalleryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (urls.length === 0 && !isCreator) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user || !isCreator) return;
    const room = MAX_GALLERY - urls.length;
    if (room <= 0) {
      toast({ title: `Max ${MAX_GALLERY} photos`, description: "Remove one to add another.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const next = [...urls];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/events/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("portfolio").upload(path, file);
        if (upErr) {
          console.error(upErr);
          continue;
        }
        const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
        next.push(publicUrl);
      }
      const { error } = await supabase.from("creative_jams").update({ gallery_image_urls: next }).eq("id", eventId);
      if (error) throw error;
      onChange(next);
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = async (url: string) => {
    if (!isCreator) return;
    const next = urls.filter((item) => item !== url);
    const { error } = await supabase.from("creative_jams").update({ gallery_image_urls: next }).eq("id", eventId);
    if (error) {
      toast({ title: "Could not remove photo", description: error.message, variant: "destructive" });
      return;
    }
    onChange(next);
  };

  return (
    <section aria-label="Event gallery" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Gallery</h2>
        {isCreator && urls.length < MAX_GALLERY && (
          <>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <KretopiaSpinner className="mr-2 h-4 w-4" /> : <ImagePlus className="mr-2 h-4 w-4" aria-hidden />}
              Add photo
            </Button>
          </>
        )}
      </div>
      {urls.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {urls.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              {isCreator && (
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute right-2 top-2 rounded-full bg-background/90 p-2 text-foreground opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <XIcon className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Add up to {MAX_GALLERY} photos to show off the event.</p>}
    </section>
  );
}

export default EventGallery;
