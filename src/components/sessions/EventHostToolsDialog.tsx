import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Sparkles, Users, MessageSquare, ArmchairIcon, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EventHostToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
}

interface RsvpQuestion {
  id: string;
  question: string;
  required: boolean;
  position: number;
}

export const EventHostToolsDialog = ({
  open,
  onOpenChange,
  eventId,
  eventTitle,
}: EventHostToolsDialogProps) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"questions" | "matchmaker" | "seating">("questions");

  // RSVP Questions
  const [questions, setQuestions] = useState<RsvpQuestion[]>([]);
  const [newQ, setNewQ] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [savingQ, setSavingQ] = useState(false);

  // Matchmaker
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [runningMatch, setRunningMatch] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState<number>(0);

  // Seating
  const [seatCount, setSeatCount] = useState<number | null>(null);
  const [runningSeat, setRunningSeat] = useState(false);
  const [tableCount, setTableCount] = useState(8);
  const [perTable, setPerTable] = useState(8);

  useEffect(() => {
    if (!open || !eventId) return;
    loadAll();
  }, [open, eventId]);

  const loadAll = async () => {
    const [{ data: q }, { count: m }, { count: s }, { count: a }] = await Promise.all([
      supabase.from("event_rsvp_questions").select("id, question, required, position").eq("event_id", eventId).order("position"),
      supabase.from("event_guest_matches").select("id", { count: "exact", head: true }).eq("event_id", eventId),
      supabase.from("event_seating_assignments").select("id", { count: "exact", head: true }).eq("event_id", eventId),
      supabase.from("jam_participants").select("id", { count: "exact", head: true }).eq("jam_id", eventId).in("status", ["going", "confirmed", "checked_in"]),
    ]);
    setQuestions((q || []) as RsvpQuestion[]);
    setMatchCount(m ?? 0);
    setSeatCount(s ?? 0);
    setAttendeeCount(a ?? 0);
  };

  const addQuestion = async () => {
    if (!newQ.trim()) return;
    if (questions.length >= 5) {
      toast({ title: "Max 5 questions", description: "Remove one to add another." });
      return;
    }
    setSavingQ(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("event_rsvp_questions").insert({
      event_id: eventId,
      question: newQ.trim(),
      question_type: "short_text",
      required: newRequired,
      position: questions.length,
      created_by: user?.id,
    });
    setSavingQ(false);
    if (error) {
      toast({ title: "Couldn't save question", description: error.message, variant: "destructive" });
      return;
    }
    setNewQ("");
    setNewRequired(false);
    loadAll();
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from("event_rsvp_questions").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    setQuestions(qs => qs.filter(q => q.id !== id));
  };

  const runMatchmaker = async () => {
    if (attendeeCount < 2) {
      toast({
        title: "Need at least 2 RSVPs",
        description: "Wait for more guests to RSVP, then run the matchmaker.",
        variant: "destructive",
      });
      return;
    }
    setRunningMatch(true);
    try {
      const { data, error } = await supabase.functions.invoke("match-event-guests", {
        body: { event_id: eventId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Smart Matchmaker done",
        description: `Generated ${data?.matches_created ?? "new"} guest pairings. Each guest will see them on the event page.`,
      });
      loadAll();
    } catch (err: any) {
      toast({
        title: "Matchmaker failed",
        description: err?.message || "Try again in a moment",
        variant: "destructive",
      });
    } finally {
      setRunningMatch(false);
    }
  };

  const runSeating = async () => {
    if (attendeeCount < 2) {
      toast({
        title: "Need at least 2 RSVPs",
        description: "Wait for more guests to RSVP, then arrange seating.",
        variant: "destructive",
      });
      return;
    }
    setRunningSeat(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimize-event-seating", {
        body: {
          event_id: eventId,
          table_count: tableCount,
          seats_per_table: perTable,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Seating arranged",
        description: `Assigned ${data?.assigned ?? "guests"} across ${tableCount} tables.`,
      });
      loadAll();
    } catch (err: any) {
      toast({
        title: "Seating failed",
        description: err?.message || "Try again in a moment",
        variant: "destructive",
      });
    } finally {
      setRunningSeat(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Host Tools
          </DialogTitle>
          <DialogDescription className="truncate">{eventTitle}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="questions" className="flex-1 gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Questions
            </TabsTrigger>
            <TabsTrigger value="matchmaker" className="flex-1 gap-1.5">
              <Users className="h-3.5 w-3.5" /> Matchmaker
            </TabsTrigger>
            <TabsTrigger value="seating" className="flex-1 gap-1.5">
              <ArmchairIcon className="h-3.5 w-3.5" /> Seating
            </TabsTrigger>
          </TabsList>

          {/* RSVP Questions */}
          <TabsContent value="questions" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-1">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> RSVP Questions
              </h3>
              <p className="text-xs text-muted-foreground">
                Ask up to 5 short questions when guests RSVP — what they create, what they hope to find, dietary needs, etc.
                Answers feed the matchmaker and seating tool.
              </p>
            </div>

            {questions.length > 0 && (
              <div className="space-y-2">
                {questions.map((q) => (
                  <div key={q.id} className="flex items-start gap-2 rounded-md border border-border/60 bg-background p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{q.question}</p>
                      {q.required && <Badge variant="secondary" className="mt-1 text-[10px]">Required</Badge>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteQuestion(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {questions.length < 5 ? (
              <div className="space-y-2 rounded-md border border-dashed border-border/60 p-3">
                <Label className="text-xs">Add a question</Label>
                <Input
                  placeholder="e.g. What do you create?"
                  value={newQ}
                  onChange={(e) => setNewQ(e.target.value)}
                  maxLength={140}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={newRequired} onCheckedChange={setNewRequired} />
                    Required
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="gradient"
                    className="gap-1.5"
                    onClick={addQuestion}
                    disabled={!newQ.trim() || savingQ}
                  >
                    {savingQ ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {questions.length}/5 questions added.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center">
                Maximum 5 questions reached. Delete one to add another.
              </p>
            )}
          </TabsContent>

          {/* Smart Matchmaker */}
          <TabsContent value="matchmaker" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Smart Matchmaker
              </h3>
              <p className="text-xs text-muted-foreground">
                Auto-pair guests who'd benefit from meeting based on their roles, skills and interests.
                Each guest sees their top picks on the event page and on their confirmation.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="text-[10px]">{attendeeCount} RSVPs</Badge>
                {matchCount !== null && (
                  <Badge variant="secondary" className="text-[10px]">{matchCount} pairings</Badge>
                )}
              </div>
            </div>

            {attendeeCount < 2 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Need at least 2 RSVPs before the matchmaker can run.</span>
              </div>
            )}

            <Button
              variant="gradient"
              className="w-full gap-2"
              onClick={runMatchmaker}
              disabled={runningMatch || attendeeCount < 2}
            >
              {runningMatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {matchCount && matchCount > 0 ? "Re-run matchmaker" : "Run matchmaker"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Best run 24h before the event, once most guests have RSVP'd.
            </p>
          </TabsContent>

          {/* Seating */}
          <TabsContent value="seating" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ArmchairIcon className="h-4 w-4 text-primary" /> Seating Tool
              </h3>
              <p className="text-xs text-muted-foreground">
                Auto-arrange guests across tables to mix interests and roles for great conversations.
                We'll create a default layout for you — no setup needed.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="text-[10px]">{attendeeCount} RSVPs</Badge>
                {seatCount !== null && (
                  <Badge variant="secondary" className="text-[10px]">{seatCount} seats assigned</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tables</Label>
                <Input type="number" min={1} max={50} value={tableCount}
                  onChange={(e) => setTableCount(parseInt(e.target.value) || 8)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Seats per table</Label>
                <Input type="number" min={2} max={20} value={perTable}
                  onChange={(e) => setPerTable(parseInt(e.target.value) || 8)} />
              </div>
            </div>

            {attendeeCount < 2 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Need at least 2 RSVPs before seating can be arranged.</span>
              </div>
            )}

            <Button
              variant="gradient"
              className="w-full gap-2"
              onClick={runSeating}
              disabled={runningSeat || attendeeCount < 2}
            >
              {runningSeat ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArmchairIcon className="h-4 w-4" />}
              {seatCount && seatCount > 0 ? "Re-arrange seats" : "Generate seating"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
