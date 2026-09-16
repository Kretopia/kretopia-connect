import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductFileUploadProps {
  userId: string;
  files: string[];
  onFilesChange: (files: string[]) => void;
  maxFiles?: number;
}

const ProductFileUpload = ({ userId, files, onFilesChange, maxFiles = 5 }: ProductFileUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const remainingSlots = maxFiles - files.length;
    if (remainingSlots <= 0) {
      toast({ title: "Maximum files reached", description: `You can upload up to ${maxFiles} files`, variant: "destructive" });
      return;
    }

    const filesToUpload = Array.from(selectedFiles).slice(0, remainingSlots);
    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        if (file.size > 25 * 1024 * 1024) {
          toast({ title: "File too large", description: `${file.name} exceeds 25MB limit. Try compressing your file.`, variant: "destructive" });
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Verify auth before upload
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({ title: "Not authenticated", description: "Please log in to upload files", variant: "destructive" });
          return;
        }

        // Use signed upload URL to bypass preview proxy limitations
        const { data: signedData, error: signedError } = await supabase.storage
          .from("product-files")
          .createSignedUploadUrl(filePath);

        if (signedError || !signedData) throw signedError || new Error("Failed to create upload URL");

        // Use XMLHttpRequest to bypass the preview proxy that intercepts window.fetch
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const uploadUrl = signedData.signedUrl;
        
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl, true);
          xhr.setRequestHeader('x-upsert', 'false');
          xhr.setRequestHeader('cache-control', '3600');
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
            }
          };
          xhr.onerror = () => reject(new Error('Upload failed - network error'));
          xhr.send(file);
        });

        // Store the path (not public URL since bucket is private)
        uploadedUrls.push(filePath);
      }

      onFilesChange([...files, ...uploadedUrls]);
      toast({ title: "Files uploaded", description: `${uploadedUrls.length} file(s) uploaded` });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const getFileName = (path: string) => {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    return name.length > 30 ? name.substring(0, 27) + "..." : name;
  };

  return (
    <div className="space-y-3">
      <Label>Product Files * (buyers will download these)</Label>
      <p className="text-xs text-muted-foreground">
        Upload the files buyers will receive after purchase (ZIP, PDF, audio, video, etc. up to 25MB each)
      </p>
      
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((filePath, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <FileIcon className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="text-sm truncate flex-1">{getFileName(filePath)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => removeFile(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {files.length < maxFiles && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full p-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center gap-1 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Click to upload product files ({files.length}/{maxFiles})</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".zip,.rar,.pdf,.psd,.ai,.eps,.fig,.mp3,.wav,.flac,.mp4,.mov,.ttf,.otf,.woff,.woff2,.json,.csv,.xls,.xlsx"
      />
    </div>
  );
};

export default ProductFileUpload;
