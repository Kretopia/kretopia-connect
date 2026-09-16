import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, ExternalLink, Trash2, Eye, Play, Lock, Crown, Music, Video, Image as ImageIcon, Mic2, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MediaPlayerModal } from "./MediaPlayerModal";
import { useNavigate } from "react-router-dom";
import { TIER_LIMITS, canAddPortfolioItem, SubscriptionTier } from "@/lib/subscriptionLimits";
import { getMediaThumbnail, parseMediaUrl } from "@/lib/mediaUtils";
import { VideoThumbnailPicker } from "./VideoThumbnailPicker";

// Platform color and icon mapping
const PLATFORM_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  spotify: { bg: 'bg-green-500', text: 'text-white', icon: '' },
  youtube: { bg: 'bg-red-500', text: 'text-white', icon: '▶' },
  vimeo: { bg: 'bg-primary', text: 'text-white', icon: '' },
  soundcloud: { bg: 'bg-orange-500', text: 'text-white', icon: '' },
  tiktok: { bg: 'bg-black', text: 'text-white', icon: '' },
  instagram: { bg: 'bg-gradient-to-r from-primary to-primary', text: 'text-white', icon: '' },
  behance: { bg: 'bg-primary', text: 'text-white', icon: '' },
};

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string;
  tags: string[];
  category: string;
  view_count: number;
}

interface PortfolioSectionProps {
  items: PortfolioItem[];
  isOwnProfile: boolean;
  onRefresh: () => void;
  subscriptionTier?: SubscriptionTier;
}

export const PortfolioSection = ({ items, isOwnProfile, onRefresh, subscriptionTier = "free" }: PortfolioSectionProps) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [uploadMode, setUploadMode] = useState<"link" | "upload">("link");
  const [linkUrl, setLinkUrl] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [existingCollections, setExistingCollections] = useState<string[]>([]);
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    media_type: "image",
    media_url: "",
    thumbnail_url: "",
    embed_code: "",
    category: "",
    tags: "",
    collection_name: ""
  });

  // Fetch existing collections
  useEffect(() => {
    const fetchCollections = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('credits')
        .select('metadata')
        .eq('user_id', user.id)
        .eq('source', 'portfolio')
      
      if (data) {
        const unique = [...new Set(data.map(d => (d.metadata as any)?.collection_name).filter(Boolean))];
        setExistingCollections(unique as string[]);
      }
    };
    fetchCollections();
  }, [items]);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const tierLimits = TIER_LIMITS[subscriptionTier];
  const canAddMore = canAddPortfolioItem(subscriptionTier, items.length);
  const isAtLimit = !canAddMore && tierLimits.maxPortfolioItems !== -1;

  const fetchPlatformData = async (url: string) => {
    if (!url.trim()) {
      setPreviewData(null);
      return;
    }

    setFetchingData(true);
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'fetch-portfolio-data',
        { body: { url } }
      );

      if (functionError) throw functionError;

      if (functionData?.success && functionData?.data) {
        const data = functionData.data;
        setPreviewData(data);
        setNewItem({
          ...newItem,
          media_url: data.mediaUrl || url,
          media_type: data.mediaType || "link",
          thumbnail_url: data.thumbnailUrl || "",
          embed_code: data.embedCode || "",
          title: data.title || "",
          description: data.description || "",
        });
      }
    } catch (error) {
      console.error("Error fetching platform data:", error);
      toast({
        title: "Could not analyze link",
        description: "Please try again or upload directly",
        variant: "destructive",
      });
    } finally {
      setFetchingData(false);
    }
  };

  const handleLinkChange = (value: string) => {
    setLinkUrl(value);
    if (value.trim() && value.startsWith("http")) {
      const debounce = setTimeout(() => {
        fetchPlatformData(value);
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      setPreviewData(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('portfolio')
      .upload(fileName, file);

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: uploadError.message,
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('portfolio').getPublicUrl(fileName);
    
    // Auto-detect media type
    let mediaType = "image";
    if (file.type.startsWith("video/")) mediaType = "video";
    else if (file.type.startsWith("audio/")) mediaType = "audio";
    
    // For videos, leave thumbnail blank — VideoThumbnailPicker will populate it
    // For images, the file IS the thumbnail
    const thumbForMedia =
      mediaType === "image" ? data.publicUrl :
      mediaType === "audio" ? "" :
      ""; // video → user will pick a frame

    setNewItem({ 
      ...newItem, 
      media_url: data.publicUrl,
      thumbnail_url: thumbForMedia,
      media_type: mediaType
    });
    setUploading(false);
  };

  const handleThumbnailCapture = async (blob: Blob, _dataUrl: string) => {
    // Upload the captured frame to storage so it persists
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const thumbName = `${user.id}/thumb-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('portfolio').upload(thumbName, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) {
      toast({ title: "Thumbnail save failed", description: error.message, variant: "destructive" });
      return;
    }
    const { data } = supabase.storage.from('portfolio').getPublicUrl(thumbName);
    setNewItem(prev => ({ ...prev, thumbnail_url: data.publicUrl }));
    toast({ title: "Cover frame set", description: "Thumbnail will be used in your portfolio grid" });
  };

  const handleAdd = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Enforce portfolio limit for free tier
    if (!canAddMore) {
      toast({
        title: "Portfolio limit reached",
        description: `Free accounts can have up to ${tierLimits.maxPortfolioItems} portfolio items. Upgrade to Pro for unlimited.`,
        variant: "destructive",
      });
      return;
    }

    if (!newItem.title || !newItem.media_url) {
      toast({
        title: "Missing information",
        description: "Please add a title and media",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from('credits').insert({
      user_id: user.id,
      project_name: newItem.title,
      role: 'Creator',
      source: 'portfolio',
      description: newItem.description,
      media_type: newItem.media_type,
      primary_media_url: newItem.media_url,
      thumbnail_url: newItem.thumbnail_url,
      credit_category: newItem.category || 'Other',
      tags: newItem.tags.split(',').map(t => t.trim()).filter(Boolean),
      metadata: {
        embed_code: newItem.embed_code,
        collection_name: newItem.collection_name || null
      }
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add portfolio item",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Portfolio item added" });
      setIsAddOpen(false);
      resetForm();
      onRefresh();
    }
  };

  const resetForm = () => {
    setLinkUrl("");
    setPreviewData(null);
    setUploadMode("link");
    setNewItem({ 
      title: "", 
      description: "", 
      media_type: "image", 
      media_url: "", 
      thumbnail_url: "",
      embed_code: "",
      category: "", 
      tags: "",
      collection_name: ""
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('credits').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Portfolio item deleted" });
      onRefresh();
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg md:text-xl font-semibold">Portfolio</h3>
          {tierLimits.maxPortfolioItems !== -1 && isOwnProfile && (
            <span className="text-xs text-muted-foreground">
              {items.length}/{tierLimits.maxPortfolioItems}
            </span>
          )}
        </div>
        {isOwnProfile && (
          isAtLimit ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs md:text-sm border-primary/50"
              onClick={() => navigate('/subscription')}
            >
              <Lock className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <Crown className="h-3 w-3 md:h-4 md:w-4 mr-1 text-primary" />
              <span className="hidden sm:inline">Upgrade for More</span>
              <span className="sm:hidden">Upgrade</span>
            </Button>
          ) : (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" size="sm" className="text-xs md:text-sm">
                <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Add Item</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add to Portfolio</DialogTitle>
                <DialogDescription>Paste a link or upload directly</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Toggle between link and upload */}
                <div className="flex gap-2">
                  <Button
                    variant={uploadMode === "link" ? "default" : "outline"}
                    onClick={() => setUploadMode("link")}
                    className="flex-1"
                  >
                    Paste Link
                  </Button>
                  <Button
                    variant={uploadMode === "upload" ? "default" : "outline"}
                    onClick={() => setUploadMode("upload")}
                    className="flex-1"
                  >
                    Upload File
                  </Button>
                </div>

                {uploadMode === "link" ? (
                  <div className="space-y-4">
                    {/* Platform suggestions */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground">Recommended:</span>
                      <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">Spotify</span>
                      <span className="text-xs bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full">SoundCloud</span>
                      <span className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full">YouTube</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Vimeo</span>
                    </div>
                    
                    {/* Link Input */}
                    <div className="space-y-2">
                      <Label>Paste Link</Label>
                      <Input
                        value={linkUrl}
                        onChange={(e) => handleLinkChange(e.target.value)}
                        placeholder="Spotify, SoundCloud, YouTube, Vimeo..."
                        disabled={fetchingData}
                      />
                      {fetchingData && (
                        <p className="text-xs text-muted-foreground animate-fade-in">Analyzing link...</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Tip: Streaming links embed better than direct uploads
                      </p>
                    </div>

                    {/* Preview Card - Fixed height container to prevent jumping */}
                    <div className="min-h-[140px]">
                      {previewData && (
                        <div className="rounded-lg border bg-card p-4 animate-fade-in">
                          <div className="flex items-start gap-3">
                            {previewData.thumbnailUrl && (
                              <img
                                src={previewData.thumbnailUrl}
                                alt="Preview"
                                loading="lazy"
                                className="w-20 h-20 object-cover rounded flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground capitalize mb-1">
                                {previewData.platform} • {previewData.mediaType}
                              </p>
                              {previewData.title && (
                                <p className="font-medium text-sm line-clamp-2 mb-1">{previewData.title}</p>
                              )}
                              {previewData.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{previewData.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Compact metadata fields */}
                    {previewData && (
                      <div className="space-y-3 animate-fade-in">
                        <Input
                          value={newItem.title}
                          onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                          placeholder="Title*"
                          className="text-sm"
                        />
                        <Textarea
                          value={newItem.description}
                          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                          rows={2}
                          placeholder="Description (optional)"
                          className="text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {["Music Video", "Short Film", "Commercial", "Animation", "Photography", "Design", "Audio Production", "Dance & Choreography", "Singing & Vocals", "Rap & Hip-Hop", "Instrument Performance", "DJing & Live Set", "Acting & Theatre", "Fashion & Styling", "Podcast", "Other"].map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={newItem.tags}
                            onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                            placeholder="Tags"
                            className="text-sm"
                          />
                        </div>
                        {/* Collection/Album field */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Album/Collection (optional)</Label>
                          <Input
                            value={newItem.collection_name}
                            onChange={(e) => setNewItem({ ...newItem, collection_name: e.target.value })}
                            placeholder="e.g., My EP, Photo Series..."
                            className="text-sm"
                            list="collections-list"
                          />
                          {existingCollections.length > 0 && (
                            <datalist id="collections-list">
                              {existingCollections.map(c => (
                                <option key={c} value={c} />
                              ))}
                            </datalist>
                          )}
                        </div>
                        <Button
                          onClick={handleAdd}
                          className="w-full"
                          variant="gradient"
                          disabled={!newItem.title}
                        >
                          Add to Portfolio
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upload File</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Supports images, videos, and audio files up to 100MB
                      </p>
                      <input
                        type="file"
                        id="portfolio-file-input"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        accept="image/*,video/*,audio/*"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-24 border-dashed border-2 flex flex-col items-center justify-center gap-2"
                        onClick={() => document.getElementById('portfolio-file-input')?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <span className="text-sm text-muted-foreground">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <span className="text-sm">Click to browse files</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Show compact fields after upload */}
                    {newItem.media_url && (
                      <div className="space-y-3 animate-fade-in">
                        {/* Video thumbnail picker — only for video uploads */}
                        {newItem.media_type === "video" && (
                          <VideoThumbnailPicker
                            videoUrl={newItem.media_url}
                            onCapture={handleThumbnailCapture}
                          />
                        )}
                        <Input
                          value={newItem.title}
                          onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                          placeholder="Title*"
                          className="text-sm"
                        />
                        <Textarea
                          value={newItem.description}
                          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                          rows={2}
                          placeholder="Description (optional)"
                          className="text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {["Music Video", "Short Film", "Commercial", "Animation", "Photography", "Design", "Audio Production", "Dance & Choreography", "Singing & Vocals", "Rap & Hip-Hop", "Instrument Performance", "DJing & Live Set", "Acting & Theatre", "Fashion & Styling", "Podcast", "Other"].map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={newItem.tags}
                            onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                            placeholder="Tags"
                            className="text-sm"
                          />
                        </div>
                        {/* Collection/Album field */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Album/Collection (optional)</Label>
                          <Input
                            value={newItem.collection_name}
                            onChange={(e) => setNewItem({ ...newItem, collection_name: e.target.value })}
                            placeholder="e.g., My EP, Photo Series..."
                            className="text-sm"
                            list="collections-list-upload"
                          />
                          {existingCollections.length > 0 && (
                            <datalist id="collections-list-upload">
                              {existingCollections.map(c => (
                                <option key={c} value={c} />
                              ))}
                            </datalist>
                          )}
                        </div>
                        <Button
                          onClick={handleAdd}
                          className="w-full"
                          variant="gradient"
                          disabled={!newItem.title}
                        >
                          Add to Portfolio
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          )
        )}
      </div>

      {items.length === 0 && !isOwnProfile ? null : items.length === 0 ? (
        <div className="rounded-xl md:rounded-2xl border border-border bg-card p-8 md:p-12 text-center">
          <Upload className="mx-auto mb-3 md:mb-4 h-12 w-12 md:h-16 md:w-16 text-muted-foreground" />
          <h3 className="mb-1 md:mb-2 text-lg md:text-xl font-semibold">No portfolio items yet</h3>
          <p className="text-sm md:text-base text-muted-foreground">Showcase your best work to stand out</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group items by collection */}
          {(() => {
            const collections = new Map<string, typeof items>();
            const uncategorized: typeof items = [];
            
            items.forEach(item => {
              const collectionName = (item as any).collection_name;
              if (collectionName) {
                if (!collections.has(collectionName)) {
                  collections.set(collectionName, []);
                }
                collections.get(collectionName)!.push(item);
              } else {
                uncategorized.push(item);
              }
            });
            
            const allGroups = [
              ...Array.from(collections.entries()).map(([name, groupItems]) => ({ name, items: groupItems })),
              ...(uncategorized.length > 0 ? [{ name: null, items: uncategorized }] : [])
            ];
            
            return allGroups.map((group, groupIndex) => (
              <div key={group.name || 'uncategorized'}>
                {group.name && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm font-medium text-muted-foreground px-2">{group.name}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {group.items.map((item) => {
            const thumbnail = getMediaThumbnail(item);
            const mediaInfo = parseMediaUrl(item.media_url);
            const isPlayable = mediaInfo || ['video', 'audio'].includes(item.media_type);
            const hasInAppPreview = mediaInfo || ['video', 'audio', 'image'].includes(item.media_type);

            return (
              <div key={item.id} className="group relative rounded-xl md:rounded-2xl border border-border bg-card overflow-hidden hover:shadow-card transition-all">
                <div 
                  className="aspect-video bg-muted relative cursor-pointer"
                  onClick={() => hasInAppPreview ? setSelectedItem(item) : window.open(item.media_url, '_blank')}
                >
                  <img
                    src={thumbnail}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&h=300&fit=crop';
                    }}
                  />
                  
                  {/* Preview overlay for all media types */}
                  {hasInAppPreview && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                        {item.media_type === 'image' ? (
                          <Eye className="h-8 w-8 text-primary-foreground" />
                        ) : (
                          <Play className="h-8 w-8 text-primary-foreground ml-1" fill="currentColor" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Platform badge with enhanced styling */}
                  {mediaInfo && (
                    <div className="absolute top-2 left-2">
                      <Badge 
                        className={`${PLATFORM_STYLES[mediaInfo.platform]?.bg || 'bg-black/60'} ${PLATFORM_STYLES[mediaInfo.platform]?.text || 'text-white'} text-xs border-0`}
                      >
                        {PLATFORM_STYLES[mediaInfo.platform]?.icon || ''} {mediaInfo.platform}
                      </Badge>
                    </div>
                  )}

                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="outline" className="h-8 w-8 bg-background/90" asChild>
                      <a href={item.media_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {isOwnProfile && (
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 bg-background/90" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="p-3 md:p-4 space-y-2">
                  <h4 className="font-semibold mb-0.5 md:mb-1 text-sm md:text-base">{item.title}</h4>
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="bg-primary/10 text-primary px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs">{item.category}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {item.view_count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Media Player Modal */}
      {selectedItem && (
        <MediaPlayerModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
        />
      )}
    </div>
  );
};
