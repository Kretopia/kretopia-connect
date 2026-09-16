import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useOutreachMedia = (userId: string | undefined) => {
  const [mediaUploading, setMediaUploading] = useState(false);

  /** Upload an image/video to outreach-media and return its embed marker `[image:url|name]`. */
  const uploadAndGetMarker = async (file: File, type: "image" | "video"): Promise<string | null> => {
    setMediaUploading(true);
    try {
      const path = `${userId!}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("outreach-media").upload(path, file);
      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return null;
      }
      const { data: urlData } = supabase.storage.from("outreach-media").getPublicUrl(path);
      return type === "image"
        ? `[image:${urlData.publicUrl}|${file.name}]`
        : `[video:${urlData.publicUrl}|${file.name}]`;
    } catch {
      toast.error("Upload failed");
      return null;
    } finally {
      setMediaUploading(false);
    }
  };

  /** Convenience wrapper that appends marker to a body via a setter. */
  const handleMediaInsert = async (
    file: File,
    type: "image" | "video",
    setBody: (fn: (prev: string) => string) => void
  ) => {
    const marker = await uploadAndGetMarker(file, type);
    if (!marker) return;
    setBody((prev) => prev + (prev ? "\n\n" : "") + marker);
    toast.success(`${type === "image" ? "Image" : "Video"} embedded`);
  };

  /** Upload multiple attachments (used by compose / bulk send). */
  const uploadAttachments = async (files: File[]): Promise<{ name: string; url: string }[]> => {
    const out: { name: string; url: string }[] = [];
    for (const file of files) {
      const path = `${userId!}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("outreach-media").upload(path, file);
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from("outreach-media").getPublicUrl(path);
      out.push({ name: file.name, url: urlData.publicUrl });
    }
    return out;
  };

  return { mediaUploading, handleMediaInsert, uploadAttachments };
};
