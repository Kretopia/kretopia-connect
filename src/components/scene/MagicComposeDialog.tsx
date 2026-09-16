import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ImagePlus, Wand2, X, Upload } from "lucide-react";
import { toast } from "sonner";

export interface ComposedArticle {
  title: string;
  subtitle: string;
  category: string;
  coverImageUrl: string | null;
  content: string; // markdown with inline ![](url) image references
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComposed: (result: ComposedArticle) => void;
  initialTitle?: string;
  initialCategory?: string;
}

/**
 * Magic Compose: paste raw doc text + drop in images → AI does everything.
 * Picks cover, places body images, finds quotes, bolds key phrases,
 * generates subtitle and category. Available to admins and writers.
 */
export const MagicComposeDialog = ({ open, onOpenChange, onComposed, initialTitle, initialCategory }: Props) => {
  const { user } = useAuth();
  const [rawText, setRawText] = useState("");
  const [titleHint, setTitleHint] = useState(initialTitle || "");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [composing, setComposing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `magazine/${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) {
        toast.error(`Upload failed: ${file.name}`);
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      newUrls.push(publicUrl);
    }
    setImages(prev => [...prev, ...newUrls]);
    setUploading(false);
    if (newUrls.length) toast.success(`Added ${newUrls.length} image${newUrls.length > 1 ? "s" : ""}`);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url: string) => {
    setImages(prev => prev.filter(u => u !== url));
  };

  const handleCompose = async () => {
    if (rawText.trim().length < 50) {
      toast.error("Paste the full article text first (at least a few sentences)");
      return;
    }
    setComposing(true);
    try {
      const { data, error } = await supabase.functions.invoke("compose-magazine-article", {
        body: {
          rawText: rawText.trim(),
          images,
          title: titleHint.trim() || undefined,
          category: initialCategory || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.content) throw new Error("AI returned no content");

      onComposed({
        title: data.title || titleHint || "Untitled",
        subtitle: data.subtitle || "",
        category: data.category || initialCategory || "inspiration",
        coverImageUrl: data.coverImageUrl || null,
        content: data.content,
      });
      toast.success("Article composed! Review the layout below.");
      // Reset for next use
      setRawText("");
      setTitleHint("");
      setImages([]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Compose failed, try again");
    } finally {
      setComposing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Magic Compose
          </DialogTitle>
          <DialogDescription className="text-xs">
            Paste the full article from your Google Doc, drop in images, and let AI handle the layout —
            cover image, subheadings, quotes, bold emphasis, and image placement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title hint */}
          <div>
            <Label className="text-xs">Title (optional — AI will extract one if blank)</Label>
            <Input
              value={titleHint}
              onChange={e => setTitleHint(e.target.value)}
              placeholder="e.g. Robert Ian Bonnick: From Sydney's Nightlife to Bali Changemaker"
              className="mt-1"
            />
          </div>

          {/* Raw text */}
          <div>
            <Label className="text-xs">Article text — paste from Google Doc</Label>
            <Textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Paste the entire article body here. Don't worry about formatting — AI will handle subheadings, quotes, bold, and paragraph spacing."
              className="mt-1 min-h-[240px] text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {rawText.trim().split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          {/* Images */}
          <div>
            <Label className="text-xs">Images — drop everything in. Smart layout picks the cover and places the rest.</Label>
            <div className="mt-1.5 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map(url => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground">Add</span>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            {images.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {images.length} image{images.length > 1 ? "s" : ""} ready — AI will pick the strongest as the cover.
              </p>
            )}
          </div>

          {/* Compose button */}
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={composing}>
              Cancel
            </Button>
            <Button onClick={handleCompose} disabled={composing || rawText.trim().length < 50} className="gap-1.5">
              {composing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {composing ? "Composing… (~20s)" : "Compose Article"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
