import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Video, Users, User, Theater, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const VIBES = [
  "Open mic",
  "Beat-making",
  "Songwriting",
  "Color grading",
  "Editing",
  "Casting chat",
  "Writers room",
  "Brainstorm",
];

type Mode = "video" | "audio";
type Format = "open_1to1" | "open_group" | "audience";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (data: {
    stage_id: string;
    room_url: string;
    room_name: string;
    token: string;
    title: string;
    mode: Mode;
    format: Format;
    backstage: boolean;
  }) => void;
}

export function GoLiveSheet({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [vibe, setVibe] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("video");
  const [format, setFormat] = useState<Format>("open_group");
  // Default ON — soundcheck before the doors open. Hosts can flip off for
  // truly spontaneous "open the doors now" rooms.
  const [backstage, setBackstage] = useState(true);
  const [busy, setBusy] = useState(false);

  const myName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Host";

  const submit = async () => {
    if (!title.trim()) {
      toast({
        title: "Give your stage a title",
        description: "What's everyone walking into?",
      });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-sound-stage",
        {
          body: {
            title: title.trim(),
            vibe_tag: vibe,
            mode,
            format,
            user_name: myName,
            backstage,
          },
        },
      );
      if (error) throw error;
      if (!data?.room_url) throw new Error("No room");
      onCreated({ ...data, title: title.trim(), mode, format, backstage });
      onOpenChange(false);
      setTitle("");
      setVibe(null);
    } catch (e: unknown) {
      console.error("[GoLiveSheet]", e);
      toast({
        title: "Couldn't open the stage",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[92vh] overflow-y-auto mx-auto w-full sm:max-w-xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Theater className="h-5 w-5 text-primary" /> Open a Sound Stage
          </SheetTitle>
          <SheetDescription>
            Spin up a live room on the lot. Anyone signed in can walk on.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="stage-title">Title</Label>
            <Input
              id="stage-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tuesday writers room"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label>Vibe (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {VIBES.map((v) => (
                <button
                  key={v}
                  onClick={() => setVibe(vibe === v ? null : v)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    vibe === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/40",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <ModeBtn
                icon={Video}
                label="Video"
                active={mode === "video"}
                onClick={() => setMode("video")}
              />
              <ModeBtn
                icon={Mic}
                label="Audio"
                active={mode === "audio"}
                onClick={() => setMode("audio")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-3 gap-2">
              <ModeBtn
                icon={User}
                label="1:1"
                active={format === "open_1to1"}
                onClick={() => setFormat("open_1to1")}
                sub="2 max"
              />
              <ModeBtn
                icon={Users}
                label="Group"
                active={format === "open_group"}
                onClick={() => setFormat("open_group")}
                sub="up to 50"
              />
              <ModeBtn
                icon={Theater}
                label="Audience"
                active={format === "audience"}
                onClick={() => setFormat("audience")}
                sub="up to 200"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBackstage((b) => !b)}
            className={cn(
              "w-full flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
              backstage
                ? "border-[hsl(var(--signal-amber))]/60 bg-[hsl(var(--signal-amber))]/10"
                : "border-border bg-background hover:border-primary/40",
            )}
          >
            <div
              className={cn(
                "h-5 w-5 rounded-md border-2 flex items-center justify-center mt-0.5 shrink-0",
                backstage
                  ? "bg-[hsl(var(--signal-amber))] border-[hsl(var(--signal-amber))]"
                  : "border-muted-foreground/40",
              )}
            >
              {backstage && (
                <svg className="h-3 w-3 text-background" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.5 5 9l4.5-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Soundcheck first (backstage)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                You'll enter alone to check camera + mic. The stage stays hidden until you tap <span className="font-semibold">Open the doors</span>.
              </p>
            </div>
          </button>

          <Button
            onClick={submit}
            disabled={busy}
            size="lg"
            variant="lime"
            className="w-full rounded-full"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : backstage ? "Enter backstage" : "Go live now"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ModeBtn({
  icon: Icon,
  label,
  sub,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/40",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-semibold">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </button>
  );
}
