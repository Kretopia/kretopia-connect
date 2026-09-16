import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GripVertical, Trash2, Plus, ChevronDown, ChevronRight,
  Image as ImageIcon, Loader2, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ContentBlock, BlockType, BLOCK_TYPES, createBlock } from "./BlockTypes";

interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}

export const BlockEditor = ({ blocks, onChange }: BlockEditorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addBlock = (type: BlockType) => {
    onChange([...blocks, createBlock(type)]);
    setShowAddMenu(false);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    onChange(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...blocks];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    onChange(updated);
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  const uploadImage = useCallback(async (blockId: string, file: File, field: 'imageUrl' | 'galleryUrls' = 'imageUrl') => {
    if (!user) return;
    setUploading(blockId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-site-${Date.now()}.${fileExt}`;
      const filePath = `site-blocks/${fileName}`;

      const { error } = await supabase.storage.from('media').upload(filePath, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

      if (field === 'galleryUrls') {
        const block = blocks.find(b => b.id === blockId);
        updateBlock(blockId, { galleryUrls: [...(block?.galleryUrls || []), publicUrl] });
      } else {
        updateBlock(blockId, { imageUrl: publicUrl });
      }
      toast({ title: "Image uploaded!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  }, [user, blocks, toast]);

  const renderBlockEditor = (block: ContentBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <Input placeholder="Heading (optional)" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })} className="text-xs h-8" />
            <Textarea placeholder="Write your content..." value={block.content || ''} onChange={e => updateBlock(block.id, { content: e.target.value })} rows={4} className="text-xs resize-none" />
          </div>
        );

      case 'image':
        return (
          <div className="space-y-2">
            {block.imageUrl ? (
              <div className="relative group">
                <img src={block.imageUrl} alt="" className="w-full h-40 object-cover rounded-md" />
                <button onClick={() => updateBlock(block.id, { imageUrl: '' })} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <UploadZone blockId={block.id} uploading={uploading === block.id} onUpload={(f) => uploadImage(block.id, f)} />
            )}
            <Input placeholder="Caption (optional)" value={block.imageCaption || ''} onChange={e => updateBlock(block.id, { imageCaption: e.target.value })} className="text-xs h-8" />
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <Input placeholder="YouTube or Vimeo URL" value={block.videoUrl || ''} onChange={e => updateBlock(block.id, { videoUrl: e.target.value })} className="text-xs h-8" />
            <Input placeholder="Title (optional)" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })} className="text-xs h-8" />
            {block.videoUrl && <VideoPreview url={block.videoUrl} />}
          </div>
        );

      case 'gallery':
        return (
          <div className="space-y-2">
            <Input placeholder="Gallery title (optional)" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })} className="text-xs h-8" />
            <div className="grid grid-cols-3 gap-1.5">
              {(block.galleryUrls || []).map((url, i) => (
                <div key={i} className="relative group aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-md" />
                  <button
                    onClick={() => updateBlock(block.id, { galleryUrls: block.galleryUrls?.filter((_, j) => j !== i) })}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <UploadZone blockId={block.id} uploading={uploading === block.id} onUpload={(f) => uploadImage(block.id, f, 'galleryUrls')} className="aspect-square" small />
            </div>
          </div>
        );

      case 'quote':
        return (
          <div className="space-y-2">
            <Textarea placeholder="Quote text..." value={block.content || ''} onChange={e => updateBlock(block.id, { content: e.target.value })} rows={3} className="text-xs resize-none italic" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Author name" value={block.quoteAuthor || ''} onChange={e => updateBlock(block.id, { quoteAuthor: e.target.value })} className="text-xs h-8" />
              <Input placeholder="Role / title" value={block.quoteRole || ''} onChange={e => updateBlock(block.id, { quoteRole: e.target.value })} className="text-xs h-8" />
            </div>
          </div>
        );

      case 'stats':
        return (
          <div className="space-y-2">
            <Input placeholder="Section title" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })} className="text-xs h-8" />
            {(block.stats || []).map((stat, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input placeholder="Value" value={stat.value} onChange={e => {
                  const stats = [...(block.stats || [])];
                  stats[i] = { ...stats[i], value: e.target.value };
                  updateBlock(block.id, { stats });
                }} className="text-xs h-8 w-24" />
                <Input placeholder="Label" value={stat.label} onChange={e => {
                  const stats = [...(block.stats || [])];
                  stats[i] = { ...stats[i], label: e.target.value };
                  updateBlock(block.id, { stats });
                }} className="text-xs h-8 flex-1" />
                <button onClick={() => {
                  const stats = (block.stats || []).filter((_, j) => j !== i);
                  updateBlock(block.id, { stats });
                }} className="p-1 rounded hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
              updateBlock(block.id, { stats: [...(block.stats || []), { label: '', value: '' }] });
            }}>
              <Plus className="h-3 w-3 mr-1" /> Add Stat
            </Button>
          </div>
        );

      case 'cta':
        return (
          <div className="space-y-2">
            <Input placeholder="Heading text" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })} className="text-xs h-8" />
            <Textarea placeholder="Description (optional)" value={block.content || ''} onChange={e => updateBlock(block.id, { content: e.target.value })} rows={2} className="text-xs resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Button text" value={block.buttonText || ''} onChange={e => updateBlock(block.id, { buttonText: e.target.value })} className="text-xs h-8" />
              <Input placeholder="Button URL" value={block.buttonUrl || ''} onChange={e => updateBlock(block.id, { buttonUrl: e.target.value })} className="text-xs h-8" />
            </div>
          </div>
        );

      case 'divider':
        return (
          <Select value={block.dividerStyle || 'line'} onValueChange={v => updateBlock(block.id, { dividerStyle: v as any })}>
            <SelectTrigger className="text-xs h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="dots">Dots</SelectItem>
              <SelectItem value="space">Spacer</SelectItem>
            </SelectContent>
          </Select>
        );

      case 'embed':
        return (
          <div className="space-y-2">
            <Input placeholder="Title (optional)" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })} className="text-xs h-8" />
            <Textarea placeholder="Paste embed code (iframe, etc.)" value={block.embedCode || ''} onChange={e => updateBlock(block.id, { embedCode: e.target.value })} rows={4} className="text-xs resize-none font-mono" />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Custom Content Blocks</Label>
          <p className="text-xs text-muted-foreground">Add custom sections beyond your profile data. Drag to reorder.</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddMenu(!showAddMenu)}>
          <Plus className="h-3 w-3 mr-1" /> Add Block
        </Button>
      </div>

      {/* Add block menu */}
      {showAddMenu && (
        <div className="grid grid-cols-3 gap-1.5 p-3 rounded-lg border border-primary/20 bg-primary/5">
          {BLOCK_TYPES.map(bt => (
            <button
              key={bt.type}
              onClick={() => addBlock(bt.type)}
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-background transition-colors text-center"
            >
              <span className="text-lg">{bt.icon}</span>
              <span className="text-[10px] font-medium">{bt.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Block list */}
      {blocks.map((block, index) => {
        const blockType = BLOCK_TYPES.find(bt => bt.type === block.type);
        const isExpanded = expandedBlock === block.id;

        return (
          <div key={block.id}>
            <div
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                dragIndex === index ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:bg-muted/50'
              }`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <button onClick={() => setExpandedBlock(isExpanded ? null : block.id)} className="flex items-center gap-2 flex-1 text-left">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-sm">{blockType?.icon}</span>
                <span className="text-sm font-medium truncate">{block.title || blockType?.label || block.type}</span>
              </button>
              <button onClick={() => removeBlock(block.id)} className="p-1 rounded hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>

            {isExpanded && (
              <div className="ml-8 mr-2 mt-1 mb-2 p-3 rounded-lg bg-muted/30 border border-border">
                {renderBlockEditor(block)}
              </div>
            )}
          </div>
        );
      })}

      {blocks.length === 0 && (
        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
          <p className="text-xs">No custom blocks yet. Click "Add Block" to get started.</p>
        </div>
      )}
    </div>
  );
};

// Sub-components

const UploadZone = ({ blockId, uploading, onUpload, className, small }: { blockId: string; uploading: boolean; onUpload: (f: File) => void; className?: string; small?: boolean }) => (
  <label className={`flex items-center justify-center border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 transition-colors ${small ? 'p-2' : 'h-24'} ${className || ''}`}>
    <div className="text-center">
      {uploading ? <Loader2 className={`${small ? 'h-4 w-4' : 'h-5 w-5'} animate-spin text-muted-foreground mx-auto`} /> : <ImageIcon className={`${small ? 'h-4 w-4' : 'h-5 w-5'} text-muted-foreground mx-auto`} />}
      {!small && <span className="text-xs text-muted-foreground block mt-1">{uploading ? 'Uploading...' : 'Upload'}</span>}
    </div>
    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} disabled={uploading} />
  </label>
);

const VideoPreview = ({ url }: { url: string }) => {
  const embedUrl = getVideoEmbedUrl(url);
  if (!embedUrl) return <p className="text-[10px] text-muted-foreground">Paste a YouTube or Vimeo URL to preview</p>;
  return <iframe src={embedUrl} className="w-full h-32 rounded-md" allowFullScreen />;
};

export const getVideoEmbedUrl = (url: string): string | null => {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
};
