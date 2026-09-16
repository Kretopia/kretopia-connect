import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  X,
  Mic,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Person {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface Props {
  projectId: string;
  currentUserId: string;
  collaborators: Person[];
}

/**
 * Drop Zone — visual skydive-style target. Drop anything (link, image, voice,
 * thought) and Copilot scatters it to Moodboard / Tasks / Pad / Vault.
 * No inline feed — routed items appear in their destination section.
 */
export const StudioPulseFeed = ({ projectId, currentUserId }: Props) => {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickImages = () => fileRef.current?.click();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).slice(0, 4);
    setFiles((cur) => [...cur, ...picked].slice(0, 4));
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (idx: number) =>
    setFiles((cur) => cur.filter((_, i) => i !== idx));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files || []).slice(0, 4);
    if (dropped.length) {
      setFiles((cur) => [...cur, ...dropped].slice(0, 4));
      setOpen(true);
    }
  };

  const submit = async () => {
    if (!draft.trim() && files.length === 0) return;
    setPosting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${projectId}/pulse-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, f, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        uploadedUrls.push(path);
      }

      const { data: inserted, error } = await supabase
        .from("studio_pulse_posts")
        .insert({
          project_id: projectId,
          author_id: currentUserId,
          content: draft.trim() || null,
          image_urls: uploadedUrls,
          kind: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      setDraft("");
      setFiles([]);
      setOpen(false);

      toast({
        title: "Dropped 🎯",
        description: "Copilot is sorting it into the right section…",
      });

      supabase.functions
        .invoke("route-studio-post", { body: { post_id: inserted.id } })
        .catch((e) => console.warn("[dropzone] route failed:", e?.message));
    } catch (e: any) {
      toast({
        title: "Couldn't drop",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="px-4 pt-5 pb-5 space-y-3">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
          Drop Zone
        </p>
        <h2 className="text-lg font-black leading-none tracking-tight">
          Feed the Kretopia Brain
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Links · images · voice notes · thoughts. Kreto sorts it to Moodboard, Tasks, Pad or Vault.
        </p>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.zip"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "relative w-full aspect-[16/10] rounded-2xl overflow-hidden",
            "bg-gradient-to-br from-primary/5 via-background to-[hsl(var(--energy)/0.08)]",
            "ring-1 ring-border hover:ring-[hsl(var(--energy))] transition-all",
            "group",
            dragOver && "ring-2 ring-[hsl(var(--energy))] scale-[1.01]",
          )}
          aria-label="Open Drop Zone"
        >
          {/* Skydive target rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Ring 4 (outermost) */}
              <div
                className={cn(
                  "absolute inset-0 m-auto rounded-full border-2 border-primary/15",
                  "h-56 w-56 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2",
                  "group-hover:border-primary/30 transition-colors",
                  dragOver && "animate-ping border-[hsl(var(--energy))]/40",
                )}
              />
              {/* Ring 3 */}
              <div
                className="absolute inset-0 m-auto rounded-full border-2 border-primary/25 h-44 w-44 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 group-hover:border-primary/45 transition-colors"
              />
              {/* Ring 2 */}
              <div
                className="absolute inset-0 m-auto rounded-full border-2 border-[hsl(var(--energy)/0.4)] h-32 w-32 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 group-hover:border-[hsl(var(--energy)/0.7)] transition-colors"
              />
              {/* Ring 1 */}
              <div
                className="absolute inset-0 m-auto rounded-full border-2 border-[hsl(var(--energy)/0.6)] h-20 w-20 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 transition-colors"
              />
              {/* Bullseye */}
              <div className="absolute inset-0 m-auto h-10 w-10 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full bg-[hsl(var(--energy))] shadow-[0_0_30px_hsl(var(--energy)/0.6)] flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-background" />
              </div>
            </div>
          </div>

          {/* Floating hint icons */}
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Link2 className="h-3 w-3" /> Link
          </div>
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <ImagePlus className="h-3 w-3" /> Image
          </div>
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Mic className="h-3 w-3" /> Voice
          </div>
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            💭 Idea
          </div>

          {/* Center caption */}
          <div className="absolute inset-x-0 bottom-10 text-center pointer-events-none">
            <p className="text-[11px] font-semibold text-foreground/80">
              {dragOver ? "Drop to land 🎯" : "Tap or drop anything"}
            </p>
          </div>
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-[hsl(var(--energy)/0.4)] p-3 space-y-2.5 bg-card shadow-[0_0_30px_hsl(var(--energy)/0.15)]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[hsl(var(--energy))] flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-background" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--energy))]">
              Landing zone armed
            </p>
          </div>

          <textarea
            autoFocus
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a link, write a thought, drop the brief… Copilot will sort it."
            className="w-full resize-none bg-transparent text-sm border-0 focus-visible:outline-none px-1"
          />

          {files.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {files.map((f, i) => {
                const isImg = f.type.startsWith("image/");
                const isVid = f.type.startsWith("video/");
                const isAud = f.type.startsWith("audio/");
                return (
                  <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden ring-1 ring-border bg-muted/40 flex items-center justify-center">
                    {isImg ? (
                      <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                    ) : isVid ? (
                      <span className="text-[10px] font-bold text-muted-foreground">🎬 VID</span>
                    ) : isAud ? (
                      <span className="text-[10px] font-bold text-muted-foreground">🎙️ AUD</span>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground text-center px-1 break-all line-clamp-2">{f.name.split(".").pop()?.toUpperCase()}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-background/90 ring-1 ring-border flex items-center justify-center"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1.5"
              onClick={pickImages}
              disabled={files.length >= 4}
            >
              <ImagePlus className="h-4 w-4" />
              Add files
            </Button>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  setOpen(false);
                  setDraft("");
                  setFiles([]);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-[hsl(var(--energy))] hover:bg-[hsl(var(--energy)/0.9)] text-background font-bold"
                onClick={submit}
                disabled={posting || (!draft.trim() && files.length === 0)}
              >
                {posting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Drop 🎯
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
