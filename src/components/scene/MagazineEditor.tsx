import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, ImagePlus, Sparkles, Upload, Plus, Type, Image, Quote, Trash2, GripVertical, MoveUp, MoveDown, Eye, Wand2, Wand, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { CoverImageEditor, coverImageStyle } from "./CoverImageEditor";
import { MagicComposeDialog } from "./MagicComposeDialog";

interface Props {
  onClose: () => void;
  onPublished: () => void;
  articleId?: string | null;
}

type BlockType = "text" | "image" | "quote";

interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  imageUrl?: string;
  caption?: string;
}

const CATEGORIES = ["fashion", "art-culture", "music", "film", "events-festivals", "impact", "community", "web3-ai", "taste-of-bali", "photography", "business", "lifestyle-wellness", "bali-developments", "inspiration", "how-to", "spotlight"];

const genId = () => Math.random().toString(36).slice(2, 9);

// Parse a markdown article string into editable blocks
const parseMarkdownToBlocks = (md: string): ContentBlock[] => {
  const sections = md.split(/\n\n+/);
  const result: ContentBlock[] = [];
  for (const raw of sections) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("> ")) {
      result.push({ id: genId(), type: "quote", content: trimmed.replace(/^> /gm, "") });
    } else {
      // Detect a pure image markdown line: ![cap](url)
      const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*\n?\*?([^*]*)\*?$/);
      if (imgMatch) {
        result.push({ id: genId(), type: "image", content: "", imageUrl: imgMatch[2], caption: imgMatch[3] || imgMatch[1] });
      } else {
        result.push({ id: genId(), type: "text", content: trimmed });
      }
    }
  }
  return result.length > 0 ? result : [{ id: genId(), type: "text", content: md }];
};

export const MagazineEditor = ({ onClose, onPublished, articleId }: Props) => {
  const { user } = useAuth();
  const { isEditorOrAdmin } = useUserRole();
  const isEditing = !!articleId;
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);
  const [category, setCategory] = useState("inspiration");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPosX, setCoverPosX] = useState(50);
  const [coverPosY, setCoverPosY] = useState(50);
  const [coverZoom, setCoverZoom] = useState(1);
  const [isFeatured, setIsFeatured] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(isEditing);
  const [preview, setPreview] = useState(false);
  const [blocks, setBlocks] = useState<ContentBlock[]>([
    { id: genId(), type: "text", content: "" },
  ]);
  const fileRef = useRef<HTMLInputElement>(null);
  const blockFileRef = useRef<HTMLInputElement>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [magicOpen, setMagicOpen] = useState(false);

  // Load existing article when editing
  useEffect(() => {
    if (!articleId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("magazine_articles")
        .select("*")
        .eq("id", articleId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Could not load article");
        setLoadingArticle(false);
        return;
      }
      setTitle(data.title || "");
      setSubtitle(data.subtitle || "");
      setCategory(data.category || "inspiration");
      setCoverUrl(data.cover_image_url || "");
      setCoverPosX(Number(data.cover_position_x) || 50);
      setCoverPosY(Number(data.cover_position_y) || 50);
      setCoverZoom(Number(data.cover_zoom) || 1);
      setIsFeatured(!!data.is_featured);
      setBlocks(parseMarkdownToBlocks(data.content || ""));
      setAuthorName(data.author_name || "");
      setAuthorAvatarUrl(data.author_avatar_url || null);
      setLoadingArticle(false);
    })();
    return () => { cancelled = true; };
  }, [articleId]);

  // New article — prefill the byline. Admin/writer keep the institutional
  // "Kretopia Magazine" byline every existing published piece already
  // uses (still editable); anyone else defaults straight to their own
  // name, since a user-submitted story with no real byline defeats the
  // point of publishing under your own name in the first place.
  useEffect(() => {
    if (articleId || !user) return;
    if (isEditorOrAdmin) {
      setAuthorName("Kretopia Magazine");
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAuthorName(data?.full_name || "A Kretopia creator");
        setAuthorAvatarUrl(data?.avatar_url || null);
      });
    return () => { cancelled = true; };
  }, [articleId, user, isEditorOrAdmin]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `magazine/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
    setCoverUrl(publicUrl);
    toast.success("Cover uploaded!");
  };

  const handleBlockImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeBlockId) return;
    const ext = file.name.split(".").pop();
    const path = `magazine/${user.id}-${Date.now()}-block.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
    updateBlock(activeBlockId, { imageUrl: publicUrl });
    toast.success("Image added!");
  };

  const addBlock = (type: BlockType) => {
    setBlocks(prev => [...prev, { id: genId(), type, content: "" }]);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) return;
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const blocksToMarkdown = (): string => {
    return blocks.map(b => {
      if (b.type === "text") return b.content;
      if (b.type === "image") return `![${b.caption || ""}](${b.imageUrl || ""})\n${b.caption ? `*${b.caption}*` : ""}`;
      if (b.type === "quote") return `> ${b.content}`;
      return b.content;
    }).join("\n\n");
  };

  const handleAIGenerate = async () => {
    if (!title.trim()) { toast.error("Add a title first"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-magazine-article", {
        body: { title, category },
      });
      if (error) throw error;
      if (data?.subtitle) setSubtitle(data.subtitle);
      if (data?.content) setBlocks(parseMarkdownToBlocks(data.content));
      toast.success("Article generated! Review, add images, and edit before publishing.");
    } catch {
      toast.error("Generation failed, try again");
    } finally {
      setGenerating(false);
    }
  };

  const handlePolish = async () => {
    const currentMd = blocksToMarkdown().trim();
    if (!currentMd) { toast.error("Write some content first"); return; }
    setPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("polish-magazine-article", {
        body: { content: currentMd, title, subtitle },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.content) {
        setBlocks(parseMarkdownToBlocks(data.content));
        toast.success("Polished! Review the new formatting before publishing.");
      } else {
        throw new Error("No polished content returned");
      }
    } catch (e: any) {
      toast.error(e?.message || "Polish failed, try again");
    } finally {
      setPolishing(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || blocks.every(b => !b.content.trim() && !b.imageUrl) || !user) {
      toast.error("Title and content are required");
      return;
    }
    setPublishing(true);
    const content = blocksToMarkdown();
    const wordCount = content.split(/\s+/).length;
    const readTime = Math.max(1, Math.round(wordCount / 200));

    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      content: content.trim(),
      cover_image_url: coverUrl || null,
      cover_position_x: coverPosX,
      cover_position_y: coverPosY,
      cover_zoom: coverZoom,
      category,
      is_featured: isFeatured,
      read_time_minutes: readTime,
      author_name: authorName.trim() || "A Kretopia creator",
      author_avatar_url: authorAvatarUrl,
    };

    const { error } = isEditing
      ? await supabase.from("magazine_articles").update(payload).eq("id", articleId!)
      : await supabase.from("magazine_articles").insert({
          ...payload,
          author_user_id: user.id,
        });

    if (error) {
      toast.error(isEditing ? "Failed to save changes" : "Failed to publish");
      setPublishing(false);
      return;
    }
    toast.success(
      isEditing ? "Changes saved!" : isEditorOrAdmin ? "Article published!" : "Story submitted — we'll review it and let you know.",
    );
    onPublished();
  };

  if (preview) {
    const md = blocksToMarkdown();
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setPreview(false)} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to editor
          </Button>
        </div>
        {coverUrl && (
          <div className="rounded-xl overflow-hidden aspect-[16/9]">
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" style={coverImageStyle(coverPosX, coverPosY, coverZoom)} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{title || "Untitled"}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="border-t border-border" />
        <article className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{md}</ReactMarkdown>
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {loadingArticle && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loadingArticle && (
      <>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          {isEditing ? "Cancel" : "Back"}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePolish} disabled={polishing}>
            {polishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 text-primary" />}
            <span className="hidden sm:inline">Polish</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setPreview(true)}>
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button onClick={handlePublish} disabled={publishing || !title.trim()} size="sm" className="gap-1.5">
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {isEditing ? "Save" : isEditorOrAdmin ? "Publish" : "Submit for review"}
          </Button>
        </div>
      </div>

      {!isEditing && !isEditorOrAdmin && (
        <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--energy)/0.25)] bg-[hsl(var(--energy)/0.06)] p-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[hsl(var(--energy))]" />
          <span>Your story goes to the Kretopia team for a quick review before it appears in the Magazine — it won't publish itself.</span>
        </div>
      )}

      {/* Cover Image */}
      <div>
        <Label className="text-xs font-medium">Cover Image</Label>
        {coverUrl ? (
          <div className="mt-1.5">
            <CoverImageEditor
              src={coverUrl}
              positionX={coverPosX}
              positionY={coverPosY}
              zoom={coverZoom}
              onChange={({ positionX, positionY, zoom }) => {
                setCoverPosX(positionX);
                setCoverPosY(positionY);
                setCoverZoom(zoom);
              }}
              onReplace={() => {
                setCoverUrl("");
                setCoverPosX(50);
                setCoverPosY(50);
                setCoverZoom(1);
              }}
            />
          </div>
        ) : (
          <label className="mt-1.5 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 transition-colors">
            <ImagePlus className="h-8 w-8 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Upload cover image</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} ref={fileRef} />
          </label>
        )}
      </div>

      {/* Title & Subtitle */}
      <div>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Article title..."
          className="text-lg font-bold border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
        />
        <Input
          value={subtitle}
          onChange={e => setSubtitle(e.target.value)}
          placeholder="Subtitle (optional)..."
          className="text-sm border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground/30 -mt-1"
        />
      </div>

      {/* Byline — editable so a real contributor gets proper credit instead
          of the article always reading "Kretopia Magazine". */}
      <div>
        <Label className="text-xs">Byline</Label>
        <Input
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          placeholder="Your name, as it should appear on the story"
          className="mt-1 h-8 text-sm"
        />
      </div>

      {/* Category + Featured */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c} className="capitalize text-xs">
                  {{"art-culture":"Art & Culture","events-festivals":"Events & Festivals","web3-ai":"Web3 & AI","taste-of-bali":"Taste of Bali","lifestyle-wellness":"Lifestyle & Wellness","bali-developments":"Bali Developments","how-to":"How-To"}[c] || c.charAt(0).toUpperCase() + c.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-0.5">
          <Switch checked={isFeatured} onCheckedChange={setIsFeatured} id="featured" />
          <Label htmlFor="featured" className="text-xs">Featured</Label>
        </div>
      </div>

      {/* Magic Compose — paste doc + drop images, AI lays it all out */}
      <Button
        className="w-full gap-2 text-xs h-10 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90"
        onClick={() => setMagicOpen(true)}
      >
        <Wand2 className="h-4 w-4" />
        Magic Compose — paste doc + drop images
      </Button>

      {/* AI Generate (from title only) */}
      <Button
        variant="outline"
        className="w-full gap-2 text-xs h-9 border-dashed"
        onClick={handleAIGenerate}
        disabled={generating || !title.trim()}
      >
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
        {generating ? "Generating article..." : "AI Generate from title only"}
      </Button>

      {/* Content Blocks */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Content Blocks</Label>
        {blocks.map((block, idx) => (
          <Card key={block.id} className="relative rounded-xl border-border/50 overflow-hidden group">
            {/* Block controls */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/30 border-b border-border/30">
              <GripVertical className="h-3 w-3 text-muted-foreground/40" />
              <span className="text-[10px] text-muted-foreground font-medium capitalize flex-1">
                {block.type === "text" ? "Text" : block.type === "image" ? "Image" : "Quote"}
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(block.id, "up")} disabled={idx === 0}>
                <MoveUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(block.id, "down")} disabled={idx === blocks.length - 1}>
                <MoveDown className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive/60 hover:text-destructive" onClick={() => removeBlock(block.id)} disabled={blocks.length <= 1}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <div className="p-2.5">
              {block.type === "text" && (
                <Textarea
                  value={block.content}
                  onChange={e => updateBlock(block.id, { content: e.target.value })}
                  placeholder="Write your content here... (markdown supported)"
                  className="min-h-[100px] border-0 p-0 focus-visible:ring-0 text-sm resize-none"
                />
              )}
              {block.type === "image" && (
                <div className="space-y-2">
                  {block.imageUrl ? (
                    <div className="relative rounded-lg overflow-hidden">
                      <img src={block.imageUrl} alt={block.caption || ""} className="w-full rounded-lg" />
                      <Button variant="secondary" size="sm" className="absolute top-2 right-2 text-[10px] h-6" onClick={() => updateBlock(block.id, { imageUrl: "" })}>
                        Replace
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-border/50 p-8 cursor-pointer hover:border-primary/40 transition-colors">
                      <ImagePlus className="h-6 w-6 text-muted-foreground/30" />
                      <span className="text-[11px] text-muted-foreground">Click to upload image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          setActiveBlockId(block.id);
                          handleBlockImageUpload(e);
                        }}
                      />
                    </label>
                  )}
                  <Input
                    value={block.caption || ""}
                    onChange={e => updateBlock(block.id, { caption: e.target.value })}
                    placeholder="Image caption (optional)"
                    className="text-xs h-7 border-0 border-b border-border/30 rounded-none px-0 focus-visible:ring-0"
                  />
                </div>
              )}
              {block.type === "quote" && (
                <div className="border-l-2 border-primary/40 pl-3">
                  <Textarea
                    value={block.content}
                    onChange={e => updateBlock(block.id, { content: e.target.value })}
                    placeholder="Enter your quote..."
                    className="min-h-[60px] border-0 p-0 focus-visible:ring-0 text-sm italic resize-none"
                  />
                </div>
              )}
            </div>
          </Card>
        ))}

        {/* Add Block buttons */}
        <div className="flex gap-2 justify-center pt-1">
          <Button variant="outline" size="sm" className="gap-1.5 text-[11px] h-7 rounded-full" onClick={() => addBlock("text")}>
            <Type className="h-3 w-3" />
            Text
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-[11px] h-7 rounded-full" onClick={() => addBlock("image")}>
            <Image className="h-3 w-3" />
            Image
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-[11px] h-7 rounded-full" onClick={() => addBlock("quote")}>
            <Quote className="h-3 w-3" />
            Quote
          </Button>
        </div>
      </div>

      <input type="file" accept="image/*" className="hidden" ref={blockFileRef} onChange={handleBlockImageUpload} />
      </>
      )}

      <MagicComposeDialog
        open={magicOpen}
        onOpenChange={setMagicOpen}
        initialTitle={title}
        initialCategory={category}
        onComposed={(result) => {
          setTitle(result.title);
          setSubtitle(result.subtitle);
          setCategory(result.category);
          if (result.coverImageUrl) {
            setCoverUrl(result.coverImageUrl);
            setCoverPosX(50);
            setCoverPosY(50);
            setCoverZoom(1);
          }
          setBlocks(parseMarkdownToBlocks(result.content));
        }}
      />
    </div>
  );
};
