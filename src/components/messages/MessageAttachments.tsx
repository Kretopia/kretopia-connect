import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Image, X, ImageOff } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PRIVATE_MESSAGE_ATTACHMENTS, uploadPrivateAttachment, uploadPublicAttachment, getAttachmentUrl, isPrivateAttachment } from "@/lib/messageAttachments";
import { useEffect } from "react";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface MessageAttachmentsProps {
  onAttach: (url: string, type: 'image' | 'file', fileName?: string) => void;
  disabled?: boolean;
  receiverId?: string | null;
}

export const MessageAttachments = ({ onAttach, disabled, receiverId }: MessageAttachmentsProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFile = async (file: File, type: 'image' | 'file') => {
    setIsUploading(true);
    try {
      let stored: string | null = null;
      if (PRIVATE_MESSAGE_ATTACHMENTS) {
        // Fail closed: no conversation, no upload.
        if (!receiverId) throw new Error("No conversation selected");
        try {
          stored = await uploadPrivateAttachment(file, receiverId);
        } catch (privateError) {
          // Private storage rules not active on the backend yet: keep
          // messaging working with the previous behaviour.
          console.warn("[attachments] private upload unavailable, using legacy storage:", privateError);
        }
      }
      if (!stored) stored = await uploadPublicAttachment(file);
      onAttach(stored, type, file.name);


      
      toast({
        title: type === 'image' ? "Image attached" : "File attached",
        description: "Ready to send with your message",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Could not upload the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      if (!IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Unsupported image",
          description: "Please choose a JPEG, PNG, WebP or GIF image.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 10MB",
          variant: "destructive",
        });
        return;
      }
      uploadFile(file, 'image');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file under 25MB",
          variant: "destructive",
        });
        return;
      }
      uploadFile(file, 'file');
    }
  };

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Each icon opens its file picker directly: an intermediate popover
          swallowed the click and the picker never opened. */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach a photo"
          disabled={disabled || isUploading}
          className="h-11 w-11 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => imageInputRef.current?.click()}
        >
          {isUploading ? (
            <KretopiaSpinner className="h-5 w-5" />
          ) : (
            <Image className="h-5 w-5" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach a document"
          disabled={disabled || isUploading}
          className="h-11 w-11 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      </div>
    </>
  );
};

interface AttachmentPreviewProps {
  url: string;
  type: 'image' | 'file';
  fileName?: string;
  onRemove: () => void;
}

/** Resolves a stored attachment value to a displayable URL (signed for private files). */
export const useResolvedAttachmentUrl = (stored?: string | null) => {
  const [url, setUrl] = useState<string | null>(
    stored && !isPrivateAttachment(stored) ? stored : null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!stored) return;
    if (!isPrivateAttachment(stored)) { setUrl(stored); return; }
    getAttachmentUrl(stored).then((u) => {
      if (cancelled) return;
      if (u) setUrl(u); else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [stored]);
  return { url, failed };
};

export const AttachmentPreview = ({ url: stored, type, fileName, onRemove }: AttachmentPreviewProps) => {
  const { url: resolved, failed } = useResolvedAttachmentUrl(stored);
  const url = resolved ?? "";
  const [imageFailedRaw, setImageFailed] = useState(false);
  const imageFailed = imageFailedRaw || failed;
  return (
    <div className="relative inline-block mb-2">
      {type === 'image' ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          {imageFailed ? (
            <div className="flex items-center gap-2 h-20 w-32 bg-muted/50 text-xs text-muted-foreground px-2">
              <ImageOff className="h-3.5 w-3.5 shrink-0" /> Failed to load
            </div>
          ) : (
            <img
              src={url}
              alt="Attachment preview"
              onError={() => setImageFailed(true)}
              className="max-h-32 max-w-48 object-cover"
            />
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 rounded-full"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 pr-8">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm truncate max-w-32">{fileName || 'Document'}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
