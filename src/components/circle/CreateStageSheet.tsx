import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, Mic2, Loader2, Mic, Video, Globe, Lock, Link2 } from "lucide-react";
import { AIStageBriefGenerator } from "./AIStageBriefGenerator";

interface CreateStageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (stageId: string) => void;
}

type Mode = "audio" | "video";
type Visibility = "public" | "unlisted" | "private";

/**
 * Host-facing scheduler for a Scout or Showcase Stage.
 * Phase A: adds Mode (audio/video), Visibility (public/unlisted/private),
 * and "what I'm looking for" description so the use case (e.g. Grammy songwriter
 * running private auditions) is properly modeled end-to-end.
 */
export function CreateStageSheet({ open, onOpenChange, onCreated }: CreateStageSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState<"scout" | "showcase">("scout");
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [startsAt, setStartsAt] = useState(defaultStart());
  const [capacity, setCapacity] = useState("50");
  const [isPaid, setIsPaid] = useState(false);
  const [priceUsd, setPriceUsd] = useState("0");
  const [appRequired, setAppRequired] = useState(true);
  const [recording, setRecording] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) {
      toast({ title: "Sign in to host", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Give your stage a title", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-curated-stage", {
        body: {
          type,
          title: title.trim(),
          blurb: blurb.trim() || null,
          description: description.trim() || null,
          mode,
          visibility,
          starts_at: new Date(startsAt).toISOString(),
          capacity: Number(capacity),
          is_paid: isPaid,
          price_cents: isPaid ? Math.round(Number(priceUsd) * 100) : 0,
          currency: "USD",
          application_required: type === "scout" ? appRequired : false,
          recording_enabled: recording,
          turn_seconds: 300, // 5 min per slot (auditioning sweet spot; editable per artist in Phase C)
        },
      });
      if (error) throw error;
      toast({
        title: visibility === "private" ? "Private stage scheduled" : "Stage scheduled",
        description: visibility === "private" ? "Invite people from the stage page" : undefined,
      });
      onOpenChange(false);
      resetForm();
      onCreated?.(data?.stage?.id);
    } catch (e: any) {
      toast({ title: "Couldn't schedule", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle(""); setBlurb(""); setDescription(""); setStartsAt(defaultStart());
    setCapacity("50"); setIsPaid(false); setPriceUsd("0");
    setAppRequired(true); setRecording(true); setMode("video"); setVisibility("public");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto mx-auto w-full sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle>Schedule a stage</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 mt-4 pb-8">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            <TypeButton active={type === "scout"} onClick={() => setType("scout")}
              icon={<Search className="h-4 w-4" />} title="Scout Stage"
              hint="You're auditioning creators" />
            <TypeButton active={type === "showcase"} onClick={() => setType("showcase")}
              icon={<Mic2 className="h-4 w-4" />} title="Showcase"
              hint="You're performing / speaking" />
          </div>

          <AIStageBriefGenerator
            type={type}
            onGenerated={(data) => {
              setTitle(data.title);
              setBlurb(data.blurb);
              if (type === "scout" && data.description) setDescription(data.description);
            }}
          />

          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "scout" ? "Open call: looking for vocalists" : "Behind the scenes with [name]"} maxLength={120} />
          </Field>

          <Field label="What's it about? (optional)">
            <Textarea value={blurb} onChange={(e) => setBlurb(e.target.value)}
              placeholder="A short pitch so people know what to bring." rows={2} maxLength={600} />
          </Field>

          {type === "scout" && (
            <Field label="What you're looking for (for applicants)">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={`e.g. "Female vocalists 18–28, R&B/soul, comfortable with falsetto. Bring a 60-second a cappella sample and one full song."`}
                rows={3} maxLength={2000} />
            </Field>
          )}

          {/* Mode */}
          <Field label="Mode">
            <div className="grid grid-cols-2 gap-2">
              <ModeBtn active={mode === "video"} onClick={() => setMode("video")} icon={<Video className="h-4 w-4" />} label="Video" hint="Camera on" />
              <ModeBtn active={mode === "audio"} onClick={() => setMode("audio")} icon={<Mic className="h-4 w-4" />} label="Audio" hint="Voices only" />
            </div>
          </Field>

          {/* Visibility */}
          <Field label="Who can join">
            <div className="grid grid-cols-3 gap-2">
              <ModeBtn active={visibility === "public"} onClick={() => setVisibility("public")}
                icon={<Globe className="h-4 w-4" />} label="Public" hint="Listed on the lot" />
              <ModeBtn active={visibility === "unlisted"} onClick={() => setVisibility("unlisted")}
                icon={<Link2 className="h-4 w-4" />} label="Unlisted" hint="Anyone with link" />
              <ModeBtn active={visibility === "private"} onClick={() => setVisibility("private")}
                icon={<Lock className="h-4 w-4" />} label="Private" hint="Invite only" />
            </div>
            {visibility !== "public" && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                You'll get a shareable link {visibility === "private" ? "and can invite specific emails" : ""} after scheduling.
              </p>
            )}
          </Field>

          <Field label="Starts">
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity">
              <Input type="number" min={1} max={1000} value={capacity}
                onChange={(e) => setCapacity(e.target.value)} />
            </Field>
            <Field label="Ticket price (USD)">
              <Input type="number" min={0} step="1" value={priceUsd}
                onChange={(e) => { setPriceUsd(e.target.value); setIsPaid(Number(e.target.value) > 0); }}
                placeholder="0 = free" />
            </Field>
          </div>

          {type === "scout" && (
            <ToggleRow
              label="Require application"
              hint="Creators submit a pitch + audio/video sample before getting a slot"
              checked={appRequired} onChange={setAppRequired}
            />
          )}

          <ToggleRow
            label="Record this stage"
            hint={type === "scout" ? "Recommended — you'll get a per-artist recap after" : "Attendees get a recap link after"}
            checked={recording} onChange={setRecording}
          />

          <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scheduling…</> : "Schedule stage"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function defaultStart() {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function TypeButton({ active, onClick, icon, title, hint }: any) {
  return (
    <button onClick={onClick}
      className={`text-left p-3 rounded-xl border transition-colors ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 font-bold text-sm">{icon}{title}</div>
      <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
    </button>
  );
}

function ModeBtn({ active, onClick, icon, label, hint }: any) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
      <div className="flex items-center gap-1.5 text-sm font-semibold">{icon}{label}</div>
      <span className="text-[10px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: any) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
