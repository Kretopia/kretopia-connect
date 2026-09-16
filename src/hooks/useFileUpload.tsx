import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseFileUploadOptions {
  bucket: string;
  folder: string;
  userId: string;
}

export const useFileUpload = ({ bucket, folder, userId }: UseFileUploadOptions) => {
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "audio" | "document">("image");

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setMediaUrl(publicUrl);

      // Detect media type
      if (file.type.startsWith('image/')) setMediaType('image');
      else if (file.type.startsWith('video/')) setMediaType('video');
      else if (file.type.startsWith('audio/')) setMediaType('audio');
      else setMediaType('document');

      toast.success("File uploaded successfully!");
      return { url: publicUrl, type: mediaType };
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload file");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setMediaUrl("");
  };

  return {
    uploading,
    mediaUrl,
    mediaType,
    uploadFile,
    clearFile,
  };
};
