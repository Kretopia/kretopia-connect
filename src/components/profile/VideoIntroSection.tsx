import { useState } from "react";
import { Play, Video, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface VideoIntroSectionProps {
  videoUrl?: string | null;
  isOwnProfile: boolean;
  onRefresh: () => void;
}

export const VideoIntroSection = ({ videoUrl, isOwnProfile, onRefresh }: VideoIntroSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 50MB for video intro", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/video-intro.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("portfolio")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);

      const { error } = await supabase
        .from("profiles")
        .update({ video_intro_url: urlData.publicUrl })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({ title: "Video intro uploaded!" });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    try {
      await supabase.from("profiles").update({ video_intro_url: null }).eq("user_id", user.id);
      toast({ title: "Video intro removed" });
      onRefresh();
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
  };

  if (!videoUrl && !isOwnProfile) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden mb-6">
      {videoUrl ? (
        <div className="relative">
          {isPlaying ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full max-h-[400px] bg-black"
              onEnded={() => setIsPlaying(false)}
            />
          ) : (
            <button
              onClick={() => setIsPlaying(true)}
              className="relative w-full group"
            >
              <video
                src={videoUrl}
                className="w-full max-h-[300px] object-cover"
                muted
                playsInline
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                <div className="h-16 w-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-7 w-7 text-primary-foreground ml-1" />
                </div>
              </div>
              <div className="absolute bottom-3 left-3">
                <span className="text-xs font-medium text-white bg-black/50 px-2 py-1 rounded-full flex items-center gap-1">
                  <Video className="h-3 w-3" />
                  Video Intro
                </span>
              </div>
            </button>
          )}
          {isOwnProfile && (
            <div className="absolute top-2 right-2 flex gap-1">
              <Button size="icon" variant="secondary" className="h-7 w-7" onClick={handleRemove}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : isOwnProfile ? (
        <label className="flex flex-col items-center gap-3 p-8 cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <Upload className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm">Add a Video Intro</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              30-60s showreel to increase profile engagement by up to 3x
            </p>
          </div>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </label>
      ) : null}
    </div>
  );
};
