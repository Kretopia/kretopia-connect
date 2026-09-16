import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, Link, Upload, Video, Image as ImageIcon, Music, 
  ExternalLink, X, Sparkles, Search, FileUp, Plus
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  media_url: string;
  media_type: string;
  thumbnail_url?: string;
  category?: string;
}

interface AddPortfolioStepProps {
  userId: string;
  onComplete: (items: PortfolioItem[]) => void;
  onSkip?: () => void;
}

const CATEGORIES = [
  "Music Video", "Short Film", "Commercial", "Animation", "Photography",
  "Design", "Audio Production", "Dance & Choreography", "Singing & Vocals",
  "Rap & Hip-Hop", "Instrument Performance", "DJing & Live Set",
  "Acting & Theatre", "Fashion & Styling", "Podcast", "Other"
];

const ACCEPTED_FILE_TYPES = "image/*,video/*,audio/*";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const AddPortfolioStep = ({ userId, onComplete, onSkip }: AddPortfolioStepProps) => {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // URL input
  const [urlInput, setUrlInput] = useState("");
  
  // Manual/edit form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "", description: "", category: "", media_url: "", media_type: "video"
  });
  
  // AI Import
  const [showAIImport, setShowAIImport] = useState(false);
  const [aiSearchUrl, setAiSearchUrl] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  
  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FREE_PORTFOLIO = 5;

  const detectMediaType = (file: File): string => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    if (items.length >= MAX_FREE_PORTFOLIO) {
      toast.error(`Free accounts can add up to ${MAX_FREE_PORTFOLIO} items.`);
      return;
    }

    const fileArray = Array.from(files);
    const remainingSlots = MAX_FREE_PORTFOLIO - items.length;
    const filesToUpload = fileArray.slice(0, remainingSlots);

    setUploading(true);
    const newItems: PortfolioItem[] = [];

    for (const file of filesToUpload) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 25MB limit`);
        continue;
      }

      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("portfolio")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("portfolio")
          .getPublicUrl(filePath);

        const mediaType = detectMediaType(file);
        const title = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

        newItems.push({
          id: crypto.randomUUID(),
          title,
          description: "",
          media_url: publicUrl,
          media_type: mediaType,
          category: "Other"
        });
      } catch (error: any) {
        console.error("Upload error:", error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newItems.length > 0) {
      setItems(prev => [...prev, ...newItems]);
      toast.success(`${newItems.length} file${newItems.length > 1 ? "s" : ""} uploaded!`);
    }
    setUploading(false);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [items.length]);

  const fetchFromUrl = async (url: string) => {
    if (items.length >= MAX_FREE_PORTFOLIO) {
      toast.error(`Free accounts can add up to ${MAX_FREE_PORTFOLIO} portfolio items.`);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-portfolio-data", {
        body: { url }
      });

      if (error) throw error;

      const newItem: PortfolioItem = {
        id: crypto.randomUUID(),
        title: data.title || "Untitled Work",
        description: data.description || "",
        media_url: url,
        media_type: data.type || "video",
        thumbnail_url: data.thumbnail,
        category: data.category || "Other"
      };

      setItems(prev => [...prev, newItem]);
      setUrlInput("");
      toast.success("Portfolio item added!");
    } catch (error: any) {
      console.error("Error fetching portfolio data:", error);
      // Fall back to manual add with URL pre-filled
      setFormData(prev => ({ ...prev, media_url: url, title: "" }));
      setShowForm(true);
      toast.info("Couldn't auto-detect — fill in details manually.");
    } finally {
      setIsLoading(false);
    }
  };

  const addManualItem = () => {
    if (items.length >= MAX_FREE_PORTFOLIO) {
      toast.error(`Free accounts can add up to ${MAX_FREE_PORTFOLIO} portfolio items.`);
      return;
    }
    if (!formData.title || !formData.media_url) {
      toast.error("Title and URL are required");
      return;
    }

    const newItem: PortfolioItem = {
      id: crypto.randomUUID(),
      title: formData.title,
      description: formData.description,
      media_url: formData.media_url,
      media_type: formData.media_type,
      category: formData.category || "Other"
    };

    setItems(prev => [...prev, newItem]);
    setFormData({ title: "", description: "", category: "", media_url: "", media_type: "video" });
    setShowForm(false);
    toast.success("Portfolio item added!");
  };

  const handleAIImport = async () => {
    if (!aiSearchUrl.trim()) {
      toast.error("Enter a platform URL (YouTube, SoundCloud, Behance, etc.)");
      return;
    }
    setAiSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding-discover", {
        body: { name: "", platformUrl: aiSearchUrl.trim() }
      });

      if (error) throw error;

      if (data?.profiles?.[0]) {
        const profile = data.profiles[0];
        let imported = 0;

        // Import credits as portfolio items
        if (profile.credits && profile.credits.length > 0) {
          const creditsToInsert = profile.credits.slice(0, MAX_FREE_PORTFOLIO - items.length).map((c: any) => ({
            user_id: userId,
            project_name: c.project,
            role: c.role,
            year: c.year || null,
            verification_status: "ai_imported"
          }));
          
          const { error: credErr } = await supabase.from("credits").insert(creditsToInsert);
          if (!credErr) imported += creditsToInsert.length;
        }

        // Import press links as portfolio items too
        if (profile.pressLinks && profile.pressLinks.length > 0) {
          const pressItems: PortfolioItem[] = profile.pressLinks
            .slice(0, MAX_FREE_PORTFOLIO - items.length)
            .map((p: any) => ({
              id: crypto.randomUUID(),
              title: p.title || "Press Feature",
              description: `Featured on ${p.source || "media"}`,
              media_url: p.url,
              media_type: "video",
              category: "Other"
            }));
          setItems(prev => [...prev, ...pressItems]);
          imported += pressItems.length;
        }

        if (imported > 0) {
          toast.success(`Imported ${imported} items from your profile!`);
        } else {
          toast.info("No portfolio items found at that URL. Try uploading directly.");
        }
      } else {
        toast.info("No results found. Try a different URL or upload directly.");
      }
    } catch (error) {
      console.error("AI import error:", error);
      toast.error("Import failed. Try uploading files directly.");
    } finally {
      setAiSearching(false);
      setShowAIImport(false);
      setAiSearchUrl("");
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const saveAndContinue = async () => {
    if (items.length === 0) {
      await onComplete([]);
      return;
    }

    setIsLoading(true);
    try {
      const insertPromises = items.map(item =>
        supabase.from("credits").insert({
          user_id: userId,
          project_name: item.title,
          role: 'Creator',
          source: 'portfolio',
          description: item.description,
          primary_media_url: item.media_url,
          media_type: item.media_type,
          thumbnail_url: item.thumbnail_url,
          credit_category: item.category || 'Other',
          tags: []
        })
      );

      const results = await Promise.all(insertPromises);
      const hasErrors = results.some(result => result.error);
      if (hasErrors) throw new Error("Failed to save some portfolio items");

      toast.success("Portfolio saved!");
      await onComplete(items);
    } catch (error: any) {
      console.error("Error saving portfolio:", error);
      toast.error("Failed to save portfolio. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "image": return <ImageIcon className="w-4 h-4" />;
      case "video": return <Video className="w-4 h-4" />;
      case "audio": return <Music className="w-4 h-4" />;
      default: return <FileUp className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${isDragging 
            ? "border-primary bg-primary/5 scale-[1.01]" 
            : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-sm">Drop files or tap to upload</p>
            <p className="text-xs text-muted-foreground">Images, videos, audio — up to 25MB each</p>
          </div>
        )}
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Paste a YouTube, Vimeo, SoundCloud link..."
          disabled={isLoading}
          onKeyDown={(e) => e.key === "Enter" && urlInput && fetchFromUrl(urlInput)}
          className="text-sm"
        />
        <Button
          size="sm"
          onClick={() => fetchFromUrl(urlInput)}
          disabled={isLoading || !urlInput}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
        </Button>
      </div>

      {/* Action Row: AI Import + Manual Add */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAIImport(!showAIImport)}
          className="flex-1 text-xs"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Import from Platform
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="flex-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Manually
        </Button>
      </div>

      {/* AI Import Panel */}
      {showAIImport && (
        <Card className="p-4 space-y-3 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">AI Platform Import</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAIImport(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste your YouTube channel, SoundCloud, Behance, or portfolio site URL
          </p>
          <div className="flex gap-2">
            <Input
              value={aiSearchUrl}
              onChange={(e) => setAiSearchUrl(e.target.value)}
              placeholder="https://youtube.com/@yourchannel"
              className="text-sm"
              disabled={aiSearching}
              onKeyDown={(e) => e.key === "Enter" && handleAIImport()}
            />
            <Button size="sm" onClick={handleAIImport} disabled={aiSearching || !aiSearchUrl.trim()}>
              {aiSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </Card>
      )}

      {/* Manual Form */}
      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Add Manually</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div>
            <Label htmlFor="manual-title" className="text-xs">Title *</Label>
            <Input
              id="manual-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="My Awesome Project"
              className="text-sm"
            />
          </div>

          <div>
            <Label htmlFor="manual-url" className="text-xs">Media URL *</Label>
            <Input
              id="manual-url"
              value={formData.media_url}
              onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
              placeholder="https://..."
              className="text-sm"
            />
          </div>

          <div>
            <Label htmlFor="manual-description" className="text-xs">Description</Label>
            <Textarea
              id="manual-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your work..."
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={formData.media_type} onValueChange={(v) => setFormData({ ...formData, media_type: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={addManualItem} size="sm" className="w-full">Add Item</Button>
        </Card>
      )}

      {/* Portfolio Items List */}
      {items.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Your Portfolio ({items.length}/{MAX_FREE_PORTFOLIO})</h3>
          <div className="grid gap-2">
            {items.map((item) => (
              <Card key={item.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      {item.media_type === "image" && item.media_url ? (
                        <img src={item.media_url} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        getMediaIcon(item.media_type)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {item.category && <span>{item.category}</span>}
                        {item.media_url && !item.media_url.startsWith("blob:") && (
                          <a 
                            href={item.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-2 border-t">
        <span className="text-xs text-muted-foreground">
          {items.length === 0 ? "Optional — add later from your profile" : `${items.length} item${items.length > 1 ? "s" : ""}`}
        </span>
        <div className="flex gap-2">
          {items.length === 0 && onSkip && (
            <Button variant="ghost" size="sm" onClick={onSkip}>Skip</Button>
          )}
          <Button size="sm" onClick={saveAndContinue} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {items.length === 0 ? "Continue" : "Save & Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
};
