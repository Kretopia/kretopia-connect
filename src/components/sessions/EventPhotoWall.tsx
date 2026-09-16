// Event photo wall. Visible to anyone who can see the event. Checked-in
// attendees and the host can upload. Photos go to the `event-photos` storage
// bucket (created lazily on first upload via a helper) and recorded in event_photos.

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface EventPhotoWallProps {
  eventId: string;
  isHost: boolean;
  canUpload: boolean;
}

interface Photo {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

const BUCKET = "event-photos";

export const EventPhotoWall = ({ eventId, isHost, canUpload }: EventPhotoWallProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const { data } = await supabase
        .from("event_photos")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(60);
      setPhotos((data as Photo[]) || []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      const newRows: Photo[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${eventId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (upErr) {
          console.error("upload failed", upErr);
          continue;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

        const { data: row, error: insErr } = await supabase
          .from("event_photos")
          .insert({ event_id: eventId, user_id: user.id, image_url: pub.publicUrl })
          .select("*")
          .single();
        if (insErr) {
          console.error("insert failed", insErr);
          continue;
        }
        newRows.push(row as Photo);
      }
      setPhotos((prev) => [...newRows, ...prev]);
      if (newRows.length) toast({ title: `Added ${newRows.length} photo${newRows.length > 1 ? "s" : ""}` });
    } catch (e) {
      console.error(e);
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (photo: Photo) => {
    if (!user) return;
    if (photo.user_id !== user.id && !isHost) return;
    try {
      await supabase.from("event_photos").delete().eq("id", photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch {
      // silent
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Photo Wall</h3>
            {photos.length > 0 && (
              <span className="text-xs text-muted-foreground">· {photos.length}</span>
            )}
          </div>
          {canUpload && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Add
              </Button>
            </>
          )}
        </div>

        {photos.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            {canUpload ? "Be the first to add a photo from this event." : "No photos yet."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
                <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                {(p.user_id === user?.id || isHost) && (
                  <button
                    onClick={() => handleDelete(p)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
