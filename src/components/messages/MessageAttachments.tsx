import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Image, X, Loader2, ImageOff } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MessageAttachmentsProps {
  onAttach: (url: string, type: 'image' | 'file', fileName?: string) => void;
  disabled?: boolean;
}

export const MessageAttachments = ({ onAttach, disabled }: MessageAttachmentsProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFile = async (file: File, type: 'image' | 'file') => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `messages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(filePath);

      onAttach(publicUrl, type, file.name);
      setOpen(false);
      
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
    if (file) {
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
        accept="image/*"
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
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || isUploading}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploading}
            >
              <Image className="h-4 w-4 text-primary" />
              Photo
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Paperclip className="h-4 w-4 text-primary" />
              Document
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
};

interface AttachmentPreviewProps {
  url: string;
  type: 'image' | 'file';
  fileName?: string;
  onRemove: () => void;
}

export const AttachmentPreview = ({ url, type, fileName, onRemove }: AttachmentPreviewProps) => {
  const [imageFailed, setImageFailed] = useState(false);
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
