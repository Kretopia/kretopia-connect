import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Image, Video, Music, X, Loader2, Upload } from "lucide-react";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated?: () => void;
}

export const CreatePostDialog = ({ open, onOpenChange, onPostCreated }: CreatePostDialogProps) => {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setMediaFiles([...mediaFiles, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
  };

  const getMediaType = (files: File[]): string => {
    if (files.length === 0) return 'text';
    const types = new Set(files.map(f => {
      if (f.type.startsWith('image/')) return 'image';
      if (f.type.startsWith('video/')) return 'video';
      if (f.type.startsWith('audio/')) return 'audio';
      return 'other';
    }));
    if (types.size > 1) return 'mixed';
    return Array.from(types)[0];
  };

  const uploadMedia = async (file: File): Promise<{ url: string; type: string; thumbnail?: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('portfolio')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('portfolio')
      .getPublicUrl(filePath);

    const type = file.type.startsWith('image/') ? 'image' 
               : file.type.startsWith('video/') ? 'video'
               : file.type.startsWith('audio/') ? 'audio' : 'other';

    return { url: publicUrl, type };
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaFiles.length === 0) {
      toast({
        title: "Content required",
        description: "Please add some text or media to your post",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload media files
      const mediaUrls = await Promise.all(mediaFiles.map(uploadMedia));

      // Create post
      const { error } = await supabase
        .from('feed_posts')
        .insert({
          user_id: user.id,
          content: content.trim() || null,
          media_urls: mediaUrls,
          media_type: getMediaType(mediaFiles),
          tags,
        });

      if (error) throw error;

      toast({
        title: "Post shared!",
        description: "Your post has been shared with your circle"
      });

      // Reset form
      setContent("");
      setTags([]);
      setMediaFiles([]);
      onOpenChange(false);
      onPostCreated?.();
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        title: "Failed to create post",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Share your work, ask for feedback, or support your network..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="resize-none"
          />

          {/* Media Upload */}
          <div>
            <div className="flex gap-2 mb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <Image className="h-4 w-4 mr-2" />
                Image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('video-upload')?.click()}
              >
                <Video className="h-4 w-4 mr-2" />
                Video
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('audio-upload')?.click()}
              >
                <Music className="h-4 w-4 mr-2" />
                Audio
              </Button>
            </div>
            
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="relative group rounded-lg border p-2">
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-24 object-cover rounded"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-24 bg-muted rounded">
                        {file.type.startsWith('video/') ? (
                          <Video className="h-8 w-8 text-muted-foreground" />
                        ) : (
                          <Music className="h-8 w-8 text-muted-foreground" />
                        )}
                        <p className="text-xs text-muted-foreground mt-1 truncate w-full px-1 text-center">
                          {file.name}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="flex gap-2">
              <Input
                placeholder="Add tags (e.g., feedback, portfolio, design)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                    #{tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={uploading || (!content.trim() && mediaFiles.length === 0)}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              'Share Post'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
