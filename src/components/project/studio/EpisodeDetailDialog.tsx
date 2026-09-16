import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, DollarSign, Plus, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Sponsor {
  id: string;
  sponsor_name: string;
  contact_email: string | null;
  amount: number | null;
  currency: string;
  status: string;
  notes: string | null;
}

interface Clip {
  id: string;
  title: string;
  transcript_excerpt: string | null;
  captions: any;
  hashtags: string[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  episode: any;
  projectId: string;
  currentUserId: string;
  onUpdated: () => void;
}

const SPONSOR_TONES: Record<string, string> = {
  pitched: "bg-muted text-muted-foreground",
  negotiating: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
  booked: "bg-primary/15 text-primary",
  paid: "bg-white/15 text-white font-semibold",
  declined: "bg-muted text-muted-foreground",
};

export function EpisodeDetailDialog({ open, onOpenChange, episode, projectId, currentUserId, onUpdated }: Props) {
  const { toast } = useToast();
  const [showNotes, setShowNotes] = useState(episode?.show_notes || "");
  const [transcript, setTranscript] = useState(episode?.transcript || "");
  const [saving, setSaving] = useState(false);

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [genClipsBusy, setGenClipsBusy] = useState(false);
  const [sponsorSuggestions, setSponsorSuggestions] = useState<{ label: string; why: string }[]>([]);

  const [sponsorName, setSponsorName] = useState("");
  const [sponsorAmount, setSponsorAmount] = useState("");

  useEffect(() => {
    if (!open || !episode?.id) return;
    setShowNotes(episode.show_notes || "");
    setTranscript(episode.transcript || "");
    void (async () => {
      const [{ data: sp }, { data: cl }] = await Promise.all([
        (supabase as any).from("episode_sponsors").select("*").eq("episode_id", episode.id),
        (supabase as any).from("episode_clips").select("*").eq("episode_id", episode.id).order("created_at", { ascending: false }),
      ]);
      setSponsors((sp || []) as Sponsor[]);
      setClips((cl || []) as Clip[]);
    })();
  }, [open, episode?.id]);

  if (!episode) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("podcast_episodes")
        .update({ show_notes: showNotes, transcript })
        .eq("id", episode.id);
      if (error) throw error;
      toast({ title: "Saved" });
      onUpdated();
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const addSponsor = async () => {
    if (!sponsorName.trim()) return;
    try {
      const { data, error } = await (supabase as any).from("episode_sponsors").insert({
        episode_id: episode.id,
        project_id: projectId,
        sponsor_name: sponsorName.trim(),
        amount: sponsorAmount ? Number(sponsorAmount) : null,
        created_by: currentUserId,
      }).select().single();
      if (error) throw error;
      setSponsors((prev) => [...prev, data as Sponsor]);
      setSponsorName(""); setSponsorAmount("");
    } catch (e: any) {
      toast({ title: "Couldn't add sponsor", description: e?.message, variant: "destructive" });
    }
  };

  const setSponsorStatus = async (s: Sponsor, status: string) => {
    await (supabase as any).from("episode_sponsors").update({ status }).eq("id", s.id);
    setSponsors((prev) => prev.map((x) => x.id === s.id ? { ...x, status } : x));
  };

  const generateClips = async () => {
    if (!transcript.trim() || transcript.length < 200) {
      toast({ title: "Need a transcript", description: "Paste at least a few paragraphs first.", variant: "destructive" });
      return;
    }
    setGenClipsBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ clips: Array<any>; sponsors?: Array<{ label: string; why: string }> }>("generate-clips", {
        body: {
          transcript,
          transcript_excerpt: transcript,
          episode_title: episode.title,
          guest_names: episode.guest_names || [],
        },
      });
      if (error) throw error;
      const drafts = data?.clips || [];
      if (!drafts.length) throw new Error("No clips returned");
      const rows = drafts.map((c: any) => ({
        episode_id: episode.id,
        project_id: projectId,
        title: c.title,
        transcript_excerpt: c.excerpt,
        captions: c.captions,
        hashtags: c.hashtags || [],
        created_by: currentUserId,
      }));
      const { data: inserted, error: insErr } = await (supabase as any).from("episode_clips").insert(rows).select();
      if (insErr) throw insErr;
      setClips((prev) => [...((inserted || []) as Clip[]), ...prev]);
      setSponsorSuggestions(data?.sponsors || []);
      toast({ title: `${rows.length} clips ready${data?.sponsors?.length ? ` · ${data.sponsors.length} sponsor ideas` : ""}` });
    } catch (e: any) {
      toast({ title: "Couldn't generate clips", description: e?.message, variant: "destructive" });
    } finally { setGenClipsBusy(false); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied" }), () => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>EP{episode.episode_number ?? "—"} · {episode.title}</DialogTitle>
          <DialogDescription>
            Show notes, transcript, sponsors and clips — all for this episode.
          </DialogDescription>
        </DialogHeader>

        {/* Show notes + transcript */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Show notes</label>
            <Textarea rows={3} value={showNotes} onChange={(e) => setShowNotes(e.target.value)} placeholder="What did this episode cover?" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transcript</label>
            <Textarea rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste or upload your transcript here. Thrive uses this to make clips." />
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
          </Button>
        </div>

        {/* Clips */}
        <div className="border-t border-border/60 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold">Clips</h4>
            <Button size="sm" variant="outline" onClick={generateClips} disabled={genClipsBusy}>
              {genClipsBusy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Make clips
            </Button>
          </div>
          {clips.length === 0 ? (
            <p className="text-xs text-muted-foreground">Paste a transcript above, then tap Make clips.</p>
          ) : (
            <div className="space-y-2">
              {clips.map((c) => (
                <div key={c.id} className="rounded-xl border border-border/60 p-3">
                  <p className="text-sm font-semibold">{c.title}</p>
                  {c.transcript_excerpt && <p className="text-xs text-muted-foreground mt-1 italic">"{c.transcript_excerpt}"</p>}
                  {c.captions && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(c.captions).map(([platform, caption]) => (
                        <div key={platform} className="flex items-start gap-2 text-[11px]">
                          <Badge variant="outline" className="text-[9px] uppercase">{platform}</Badge>
                          <p className="flex-1 text-foreground/80">{String(caption)}</p>
                          <button onClick={() => copy(String(caption))} className="text-muted-foreground hover:text-foreground">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.hashtags && c.hashtags.length > 0 && (
                    <p className="mt-2 text-[10px] text-primary">{c.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sponsors */}
        <div className="border-t border-border/60 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Sponsors</h4>
          </div>
          {sponsorSuggestions.length > 0 && (
            <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1.5">Producer · Sponsor ideas</p>
              <ul className="space-y-1.5">
                {sponsorSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{s.why}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 shrink-0"
                      onClick={() => { setSponsorName(s.label); }}
                    >
                      <Plus className="h-3 w-3 mr-1" />Add
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2 mb-3">
            <Input placeholder="Sponsor name" value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} className="flex-1" />
            <Input placeholder="Amount" type="number" value={sponsorAmount} onChange={(e) => setSponsorAmount(e.target.value)} className="w-24" />
            <Button size="sm" onClick={addSponsor}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          {sponsors.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sponsors yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {sponsors.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.sponsor_name}</p>
                    {s.amount && <p className="text-[11px] text-muted-foreground">{s.currency} {s.amount}</p>}
                  </div>
                  <select
                    value={s.status}
                    onChange={(e) => setSponsorStatus(s, e.target.value)}
                    className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border-0 ${SPONSOR_TONES[s.status]}`}
                  >
                    <option value="pitched">Pitched</option>
                    <option value="negotiating">Negotiating</option>
                    <option value="booked">Booked</option>
                    <option value="paid">Paid</option>
                    <option value="declined">Declined</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
