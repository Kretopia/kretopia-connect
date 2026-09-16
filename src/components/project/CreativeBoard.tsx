import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Image, StickyNote, Sparkles, Plus, Trash2, ExternalLink,
  Loader2, X, Upload, Palette, Search, LayoutGrid, List, Pencil, RefreshCw, MoreVertical
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface BoardItem {
  id: string;
  project_id: string;
  created_by: string;
  type: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  color: string | null;
  tags: string[];
  created_at: string;
}

interface CreativeBoardProps {
  projectId: string;
  currentUserId: string;
}

const STICKY_COLORS = [
  { label: "Yellow", value: "#FACC15" },
  { label: "Pink", value: "#F472B6" },
  { label: "Blue", value: "#60A5FA" },
  { label: "Green", value: "#34D399" },
  { label: "Purple", value: "#A78BFA" },
  { label: "Orange", value: "#FB923C" },
];

export function CreativeBoard({ projectId, currentUserId }: CreativeBoardProps) {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"all" | "pins" | "notes" | "ai">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialog states
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Form states
  const [pinTitle, setPinTitle] = useState("");
  const [pinFile, setPinFile] = useState<File | null>(null);
  const [pinUrl, setPinUrl] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState("#FEF3C7");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel(`board:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_items", filter: `project_id=eq.${projectId}` }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("board_items")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (!error) setItems((data as BoardItem[]) || []);
    setLoading(false);
  };

  const handleAddPin = async () => {
    if (!pinFile && !pinUrl) {
      toast({ title: "Add an image file or URL", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      let imageUrl = pinUrl;
      if (pinFile) {
        const ext = pinFile.name.split(".").pop();
        const path = `${currentUserId}/${projectId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("board-assets").upload(path, pinFile);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("board-assets").getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }
      const { error } = await supabase.from("board_items").insert({
        project_id: projectId,
        created_by: currentUserId,
        type: "pin",
        title: pinTitle || null,
        image_url: imageUrl,
      });
      if (error) throw error;
      toast({ title: "Pin added!" });
      setPinTitle(""); setPinFile(null); setPinUrl(""); setPinDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      toast({ title: "Write something on your sticky note", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("board_items").insert({
      project_id: projectId,
      created_by: currentUserId,
      type: "note",
      title: noteTitle || null,
      content: noteContent,
      color: noteColor,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sticky note added!" });
      setNoteTitle(""); setNoteContent(""); setNoteColor("#FEF3C7"); setNoteDialogOpen(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Describe what you want to generate", variant: "destructive" });
      return;
    }
    setAiGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in");

      const { data, error } = await supabase.functions.invoke("generate-board-image", {
        body: { prompt: aiPrompt, projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        const { error: insertErr } = await supabase.from("board_items").insert({
          project_id: projectId,
          created_by: currentUserId,
          type: "ai_image",
          title: aiPrompt.slice(0, 100),
          content: aiPrompt,
          image_url: data.imageUrl,
        });
        if (insertErr) throw insertErr;
        toast({ title: "Image generated!" });
        setAiPrompt(""); setAiDialogOpen(false);
      } else {
        toast({ title: "No image returned", description: data?.text || "Try a different prompt", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const { error } = await supabase.from("board_items").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      fetchItems();
    } else {
      toast({ title: "Removed" });
    }
  };

  const handleEditNote = async (id: string, title: string | null, content: string, color: string) => {
    const { error } = await supabase.from("board_items").update({ title, content, color }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Updated" });
  };

  const handleReplaceImage = async (id: string, file: File) => {
    try {
      const ext = file.name.split(".").pop();
      const path = `${currentUserId}/${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("board-assets").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("board-assets").getPublicUrl(path);
      const { error } = await supabase.from("board_items").update({ image_url: pub.publicUrl }).eq("id", id);
      if (error) throw error;
      toast({ title: "Image replaced" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filtered = items.filter((item) => {
    if (activeSection === "pins" && item.type !== "pin") return false;
    if (activeSection === "notes" && item.type !== "note") return false;
    if (activeSection === "ai" && item.type !== "ai_image") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (item.title?.toLowerCase().includes(q) || item.content?.toLowerCase().includes(q));
    }
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Creative Board</h3>
          <p className="text-sm text-muted-foreground">Pin references, brainstorm with sticky notes, generate ideas with AI</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2"><Image className="h-4 w-4" />Pin</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Mood Pin</DialogTitle>
                <DialogDescription>Upload an image or paste a URL for your mood board</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input value={pinTitle} onChange={(e) => setPinTitle(e.target.value)} placeholder="Pin title" />
                </div>
                <div className="space-y-2">
                  <Label>Image File</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setPinFile(e.target.files?.[0] || null)} />
                </div>
                <div className="text-center text-xs text-muted-foreground">— or —</div>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input value={pinUrl} onChange={(e) => setPinUrl(e.target.value)} placeholder="https://..." />
                </div>
                <Button onClick={handleAddPin} disabled={uploading} className="w-full gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Add Pin
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2"><StickyNote className="h-4 w-4" />Note</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Sticky Note</DialogTitle>
                <DialogDescription>Jot down ideas, thoughts, or reminders</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title" />
                </div>
                <div className="space-y-2">
                  <Label>Content *</Label>
                  <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write your idea..." rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    {STICKY_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setNoteColor(c.value)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          noteColor === c.value ? "border-foreground scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
                <Button onClick={handleAddNote} className="w-full">Add Note</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Sparkles className="h-4 w-4" />AI Generate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Image</DialogTitle>
                <DialogDescription>Describe the visual concept you want to explore</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="E.g. A dreamy pastel color palette with abstract organic shapes for a wellness brand..."
                    rows={4}
                  />
                </div>
                <Button onClick={handleAIGenerate} disabled={aiGenerating} className="w-full gap-2">
                  {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiGenerating ? "Generating..." : "Generate Image"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {[
            { id: "all", label: "All", icon: LayoutGrid },
            { id: "pins", label: "Pins", icon: Image },
            { id: "notes", label: "Notes", icon: StickyNote },
            { id: "ai", label: "Generate", icon: Sparkles },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id as any)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeSection === s.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search board..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Board Grid (Masonry-like) */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Palette className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">Your creative board is empty</p>
          <p className="text-sm text-muted-foreground mt-1">Pin references, add sticky notes, or generate ideas with AI</p>
        </Card>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {filtered.map((item) => (
            <BoardItemCard key={item.id} item={item} onDelete={handleDelete} onEditNote={handleEditNote} onReplaceImage={handleReplaceImage} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardItemCard({ item, onDelete, onEditNote, onReplaceImage }: { 
  item: BoardItem; 
  onDelete: (id: string) => void;
  onEditNote: (id: string, title: string | null, content: string, color: string) => void;
  onReplaceImage: (id: string, file: File) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title || "");
  const [editContent, setEditContent] = useState(item.content || "");
  const [editColor, setEditColor] = useState(item.color || "#FEF3C7");
  const replaceRef = useRef<HTMLInputElement>(null);

  if (item.type === "note") {
    if (editing) {
      return (
        <div
          className="break-inside-avoid rounded-lg p-4 shadow-sm border border-border/50 space-y-2"
          style={{ backgroundColor: editColor }}
        >
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title (optional)" className="h-8 text-sm bg-white/50" />
          <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="Content..." rows={4} className="text-sm bg-white/50" />
          <div className="flex gap-1.5">
            {STICKY_COLORS.map((c) => (
              <button key={c.value} onClick={() => setEditColor(c.value)} className={cn("w-6 h-6 rounded-full border-2 transition-all", editColor === c.value ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c.value }} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs" onClick={() => { onEditNote(item.id, editTitle || null, editContent, editColor); setEditing(false); }}>Save</Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="break-inside-avoid rounded-lg p-4 shadow-sm border border-border/50 group relative cursor-pointer transition-transform hover:scale-[1.02]"
        style={{ backgroundColor: item.color || "#FEF3C7" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="p-1 rounded-full bg-black/10 hover:bg-black/20" style={{ color: "#333" }}>
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {item.title && <p className="font-semibold text-sm mb-1" style={{ color: "#1a1a1a" }}>{item.title}</p>}
        <p className={cn("text-sm whitespace-pre-wrap", !expanded && "line-clamp-6")} style={{ color: "#333" }}>{item.content}</p>
        <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: "#666" }}>
          <StickyNote className="h-3 w-3" />
          {new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>
    );
  }

  // Pin or AI image
  return (
    <div className="break-inside-avoid rounded-lg overflow-hidden border border-border bg-card group relative transition-transform hover:scale-[1.02]">
      <input ref={replaceRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplaceImage(item.id, f); }} />
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white">
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => replaceRef.current?.click()}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Replace Image
            </DropdownMenuItem>
            {item.image_url && (
              <DropdownMenuItem onClick={() => window.open(item.image_url!, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open Full Size
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item.id)}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {item.type === "ai_image" && (
        <Badge className="absolute top-2 left-2 z-10 bg-primary/80 text-primary-foreground text-xs gap-1">
          <Sparkles className="h-3 w-3" /> AI
        </Badge>
      )}
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.title || "Board pin"}
          className="w-full object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {(item.title || item.content) && (
        <div className="p-3 space-y-1">
          {item.title && <p className="font-medium text-sm">{item.title}</p>}
          {item.content && item.type === "ai_image" && (
            <p className="text-xs text-muted-foreground line-clamp-2 italic">"{item.content}"</p>
          )}
        </div>
      )}
    </div>
  );
}
