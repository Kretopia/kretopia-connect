/**
 * AutopilotProjectGuide — the guided (not autonomous) "through Studio" setup
 * walkthrough. Kreto suggests at each step; the person reviews, edits and
 * explicitly confirms every write. Nothing here ever auto-submits,
 * auto-emails, auto-pays, auto-invites or auto-publishes: every action that
 * touches real data (an invite, a milestone, a saved brief, a created task,
 * a proposal) fires from its own explicit button click, not from advancing
 * a step or opening the panel.
 *
 * Four steps: project & brief -> team & milestones -> tasks & review ->
 * finish. Originally eight (define, collaborators, milestones, brief,
 * tasks, confirm, next_action, complete) -- consolidated because most of
 * those pairs were really one decision split across two screens for no
 * reason (a project's name and its AI brief are the same "what is this"
 * information; the suggested-tasks checklist and the confirm summary are
 * the same "what's about to happen" moment). The one deliberately deferred
 * action is still task creation -- AI-suggested tasks are reviewed and can
 * be unchecked in step 3, and only become real project_tasks rows on the
 * "Finish setup" click in step 4, together with a single proposed next
 * action inserted as a pending agent_proposals row -- never executed
 * automatically, and rendered through the same ProactiveCards "Kreto
 * Suggests" surface every other AI proposal in Studio goes through.
 *
 * Progress bar is sticky (its own non-scrolling row above a scrollable
 * body, same layout technique VoiceFirstCreateModal uses for its own top
 * bar) so it stays visible while scrolling a step's content and while
 * rolling back to an earlier step -- it previously lived inside SheetHeader
 * as part of the same scrolling flow as the content, so a long step (many
 * collaborators, many suggested tasks) could scroll it out of view.
 *
 * Each step's own primary action is a single "Continue" button (compact,
 * not stretched full-width) that validates the step's required fields,
 * persists whatever's pending, and advances to the next step in one click
 * -- previously "Save" (persist) and "Continue" (advance) were two separate
 * actions in steps 1, requiring two clicks for what is really one decision.
 */
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Sparkles, UserPlus, Flag,
  FileText, ListChecks, Rocket, PauseCircle, X,
} from "lucide-react";

type StepId = "project" | "team" | "tasks" | "finish";

const STEPS: { id: StepId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "project", label: "Project & brief", icon: FileText },
  { id: "team", label: "Team & milestones", icon: UserPlus },
  { id: "tasks", label: "Tasks & review", icon: ListChecks },
  { id: "finish", label: "Finish setup", icon: Rocket },
];

interface SuggestedTask {
  title: string;
  description?: string | null;
  accepted: boolean;
}

interface Props {
  project: { id: string; title: string; description: string | null; created_by: string; client_user_id?: string | null; client_name?: string | null };
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function AutopilotProjectGuide({ project, currentUserId, open, onOpenChange, onUpdated }: Props) {
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex].id;
  // Synchronous guard against a double-click firing two writes for the same
  // "Continue" -- the async advancing state below still updates on the next
  // render, same reasoning as New Room's own duplicate-submit fix.
  const [advancing, setAdvancing] = useState(false);

  // Step 1 — project name/description + AI brief
  const [title, setTitle] = useState(project.title || "");
  const [description, setDescription] = useState(project.description || "");
  const [briefDraft, setBriefDraft] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefSaved, setBriefSaved] = useState(false);

  // Step 2 — team & milestones
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [inviteInput, setInviteInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [msTitle, setMsTitle] = useState("");
  const [msAmount, setMsAmount] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);

  // Step 3 — suggested tasks (deferred — nothing written until step 4)
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);

  // Step 4 — finish (prepare next action + mark setup complete, together)
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState<{ tasksCreated: number; proposalTitle: string } | null>(null);
  const [pausing, setPausing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setBriefSaved(false);
    setFinished(null);
    void loadCollaborators();
    void loadMilestones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  const loadCollaborators = async () => {
    const { data } = await supabase
      .from("project_collaborators")
      .select("id, user_id, email, status, agent_role, profiles:user_id(full_name, avatar_url)")
      .eq("project_id", project.id);
    setCollaborators(data || []);
  };

  const loadMilestones = async () => {
    const { data } = await supabase
      .from("milestones")
      .select("id, title, amount, status")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true });
    setMilestones(data || []);
  };

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  // ---- Step 1: persist title/description + brief (if drafted), then advance ----
  const saveProjectStep = async (): Promise<boolean> => {
    if (!title.trim()) return false;
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          title: title.trim(),
          description: (briefDraft.trim() || description.trim()) || null,
        })
        .eq("id", project.id);
      if (error) throw error;
      if (briefDraft.trim()) {
        setDescription(briefDraft.trim());
        setBriefSaved(true);
      }
      onUpdated();
      return true;
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
      return false;
    }
  };

  // ---- Step 2: collaborators — each invite is its own explicit, immediate action ----
  const isEmail = inviteInput.includes("@") && inviteInput.includes(".");
  const sendInvite = async () => {
    if (!isEmail || inviting) return;
    setInviting(true);
    try {
      const email = inviteInput.trim().toLowerCase();
      const { error } = await supabase.from("project_collaborators").insert({
        project_id: project.id,
        email,
        invited_by: currentUserId,
        role: "member",
        status: "pending",
      });
      if (error) throw error;
      await supabase.functions.invoke("send-project-invitation", {
        body: { email, projectId: project.id },
      }).catch(() => {});
      setInviteInput("");
      await loadCollaborators();
      toast({ title: "Invite sent", description: email });
    } catch (e: any) {
      toast({ title: "Couldn't invite", description: e.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  // ---- Step 2: milestones — plain planning record, no escrow/payment triggered ----
  const addMilestone = async () => {
    if (!msTitle.trim() || addingMilestone) return;
    setAddingMilestone(true);
    try {
      const { error } = await supabase.from("milestones").insert({
        project_id: project.id,
        created_by: currentUserId,
        title: msTitle.trim(),
        amount: Number(msAmount) || 0,
        status: "pending",
        escrow_status: "none",
      });
      if (error) throw error;
      setMsTitle("");
      setMsAmount("");
      await loadMilestones();
    } catch (e: any) {
      toast({ title: "Couldn't add milestone", description: e.message, variant: "destructive" });
    } finally {
      setAddingMilestone(false);
    }
  };

  // ---- Step 1: AI brief — generate (no write) → edit → persisted by Continue ----
  const generateBrief = async () => {
    setBriefLoading(true);
    try {
      const source = [title, description].filter(Boolean).join(" — ");
      const { data, error } = await supabase.functions.invoke("extract-brief", {
        body: { source: "text", text: source || title },
      });
      if (error) throw error;
      const result: any = data ?? {};
      setBriefDraft(result?.project?.summary || "");
      setBriefSaved(false);
      if (Array.isArray(result?.deliverables) && result.deliverables.length) {
        setSuggestedTasks(
          result.deliverables.slice(0, 8).map((d: any) => ({
            title: String(d.title || "").slice(0, 200),
            description: d.description ?? null,
            accepted: true,
          })),
        );
      }
    } catch (e: any) {
      toast({ title: "Couldn't draft a brief", description: e.message, variant: "destructive" });
    } finally {
      setBriefLoading(false);
    }
  };

  // ---- Step 3: tasks stay local (accepted flags) until step 4 ----
  const toggleTask = (i: number) => {
    setSuggestedTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, accepted: !t.accepted } : t)));
  };

  // ---- Step 4: the one execution point — create accepted tasks + one
  // proposal + mark setup complete, all from a single "Finish setup" click ----
  const finishSetup = async () => {
    setFinishing(true);
    try {
      const accepted = suggestedTasks.filter((t) => t.accepted);
      if (accepted.length > 0) {
        const { error: taskError } = await supabase.from("project_tasks").insert(
          accepted.map((t) => ({
            project_id: project.id,
            title: t.title,
            description: t.description ?? null,
            status: "todo" as const,
            created_by: currentUserId,
          })),
        );
        if (taskError) throw taskError;
      }

      // Context-sensitive but simple: suggest whichever setup gap is most
      // useful next — never more than one proposal, never auto-executed.
      let kind: "collab_nudge" | "next_milestone" | "other" = "other";
      let proposalTitle = "Start on the first task";
      let body = "The plan is set — open Tasks and get moving on the first item.";
      if (collaborators.length === 0) {
        kind = "collab_nudge";
        proposalTitle = "Invite a collaborator";
        body = "This project doesn't have anyone else on it yet. Bring in a collaborator when you're ready.";
      } else if (milestones.length === 0) {
        kind = "next_milestone";
        proposalTitle = "Set your first milestone";
        body = "No milestones yet — adding one gives the project a clear next checkpoint.";
      }

      // agent_proposals has no client INSERT policy (service_role only, by
      // design — see create-agent-proposal) so this goes through the one
      // narrow, ownership-checked edge function rather than a direct write.
      const { error: proposalError } = await supabase.functions.invoke("create-agent-proposal", {
        body: {
          project_id: project.id,
          kind,
          title: proposalTitle,
          proposal_body: body,
          action_intent: { href: `/desk/${project.id}` },
          source_signal: { source: "autopilot_project_guide" },
        },
      });
      if (proposalError) throw proposalError;

      const { error: completeError } = await supabase
        .from("projects")
        .update({ setup_completed: true })
        .eq("id", project.id);
      if (completeError) throw completeError;

      setFinished({ tasksCreated: accepted.length, proposalTitle });
      onUpdated();
    } catch (e: any) {
      toast({ title: "Couldn't finish setup", description: e.message, variant: "destructive" });
    } finally {
      setFinishing(false);
    }
  };

  const pauseForLater = async () => {
    setPausing(true);
    try {
      onOpenChange(false);
    } finally {
      setPausing(false);
    }
  };

  // ---- One smart "Continue" per step: validates required fields, saves
  // what needs saving, and advances -- replacing the old two-click
  // Save-then-Continue pattern in step 1 specifically. ----
  const stepIsValid = step === "project" ? title.trim().length > 0 : true;

  const handleContinue = async () => {
    if (advancing || !stepIsValid) return;
    setAdvancing(true);
    try {
      if (step === "project") {
        const ok = await saveProjectStep();
        if (!ok) return;
      }
      setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        {/* Sticky header + progress -- its own non-scrolling row, not part
            of the scrollable body below, so it stays visible while
            scrolling a long step's content or rolling back to an earlier
            step, instead of scrolling away with the rest of the sheet. */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 pt-6 pb-4 shrink-0">
          <SheetHeader className="space-y-1.5">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> {STEPS[stepIndex].label}
            </SheetTitle>
            <SheetDescription>
              Step {stepIndex + 1} of {STEPS.length} · Kreto suggests, you confirm every step
            </SheetDescription>
          </SheetHeader>
          <div className="flex gap-1 pt-3">
            {STEPS.map((s, i) => (
              <div key={s.id} className={cn("h-1 flex-1 rounded-full transition-colors", i <= stepIndex ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
          {step === "project" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Project name</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" /> AI brief (optional)
                </Label>
                {!briefDraft ? (
                  <Button onClick={generateBrief} disabled={briefLoading || !title.trim()} size="sm" variant="secondary" className="gap-1.5">
                    {briefLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {briefLoading ? "Analyzing your project context…" : "Draft a brief with Kreto"}
                  </Button>
                ) : (
                  <>
                    <Textarea
                      rows={4}
                      value={briefDraft}
                      onChange={(e) => { setBriefDraft(e.target.value); setBriefSaved(false); }}
                      className="resize-none bg-background"
                    />
                    <div className="flex items-center gap-2">
                      <Button onClick={generateBrief} disabled={briefLoading} size="sm" variant="ghost">Regenerate</Button>
                      <p className="text-[11px] text-muted-foreground">Saved automatically when you continue.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {step === "team" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Collaborators — optional</Label>
                {collaborators.length > 0 && (
                  <div className="space-y-1.5">
                    {collaborators.map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5 rounded-lg border p-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={c.profiles?.avatar_url} />
                          <AvatarFallback className="text-xs">{(c.profiles?.full_name || c.email || "U")[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.profiles?.full_name || c.email}</p>
                          <p className="text-xs text-muted-foreground capitalize">{c.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Email to invite"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  />
                  <Button onClick={sendInvite} disabled={!isEmail || inviting} size="sm" className="shrink-0 gap-1.5">
                    {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    Invite
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Each invite sends immediately when you click Invite. Skip if no one else is on this yet.
                </p>
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Milestones — optional</Label>
                {milestones.length > 0 && (
                  <div className="space-y-1.5">
                    {milestones.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                        <span className="truncate">{m.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{m.amount ? `$${m.amount}` : "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Input placeholder="Milestone name" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} />
                  <div className="flex gap-2">
                    <Input placeholder="Amount (optional)" type="number" value={msAmount} onChange={(e) => setMsAmount(e.target.value)} />
                    <Button onClick={addMilestone} disabled={!msTitle.trim() || addingMilestone} size="sm" className="shrink-0 gap-1.5">
                      {addingMilestone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                      Add
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A planning record only — no escrow or payment is triggered here.
                </p>
              </div>
            </div>
          )}

          {step === "tasks" && (
            <div className="space-y-5">
              <div className="space-y-3">
                {suggestedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No suggested tasks yet — draft a brief in the previous step to generate some, or skip ahead.</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Kreto found {suggestedTasks.length} possible starter task{suggestedTasks.length === 1 ? "" : "s"} from the brief. Uncheck anything that doesn't belong — nothing is created until you finish setup.
                    </p>
                    <div className="space-y-1.5">
                      {suggestedTasks.map((t, i) => (
                        <label key={i} className="flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer">
                          <Checkbox checked={t.accepted} onCheckedChange={() => toggleTask(i)} className="mt-0.5" />
                          <span className="text-sm leading-snug">{t.title}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-3 border-t pt-4 text-sm">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ready to review</Label>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Project</p>
                  <p className="font-medium">{title || project.title}</p>
                  {(briefDraft || description) && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-3">{briefDraft || description}</p>}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <p><span className="font-semibold text-foreground">{collaborators.length}</span> collaborator{collaborators.length === 1 ? "" : "s"}</p>
                  <p><span className="font-semibold text-foreground">{milestones.length}</span> milestone{milestones.length === 1 ? "" : "s"}</p>
                  <p><span className="font-semibold text-foreground">{suggestedTasks.filter((t) => t.accepted).length}</span> task{suggestedTasks.filter((t) => t.accepted).length === 1 ? "" : "s"} to create</p>
                </div>
              </div>
            </div>
          )}

          {step === "finish" && (
            <div className="space-y-3">
              {!finished ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    This creates the tasks you accepted, prepares one suggested next step, and marks setup complete — it won't send, publish or execute anything beyond that on its own.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button onClick={finishSetup} disabled={finishing} size="sm" className="gap-1.5">
                      {finishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                      {finishing ? "Finishing…" : "Finish setup"}
                    </Button>
                    <Button onClick={pauseForLater} disabled={pausing || finishing} size="sm" variant="ghost" className="gap-1.5">
                      <PauseCircle className="h-3.5 w-3.5" /> Pause — continue later
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" /> Setup complete.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {finished.tasksCreated > 0 ? `${finished.tasksCreated} task${finished.tasksCreated === 1 ? "" : "s"} added. ` : ""}
                    A suggestion — "{finished.proposalTitle}" — is waiting in Studio for you to review.
                  </p>
                  <Button onClick={() => onOpenChange(false)} size="sm" className="mt-2">Done</Button>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {step !== "finish" && (
          <div className="flex items-center justify-between px-6 py-3 border-t shrink-0">
            <Button variant="ghost" size="sm" onClick={stepIndex === 0 ? () => onOpenChange(false) : goBack} className="gap-1">
              {stepIndex === 0 ? <><X className="h-3.5 w-3.5" /> Close</> : <><ArrowLeft className="h-3.5 w-3.5" /> Back</>}
            </Button>
            {/* One smart, compact button -- not stretched full-width --
                that validates this step's required fields (disabled until
                met), saves anything pending, and advances in one click. */}
            <Button size="sm" onClick={handleContinue} disabled={!stepIsValid || advancing} className="gap-1 w-fit">
              {advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Continue <ArrowRight className="h-3.5 w-3.5" /></>}
            </Button>
          </div>
        )}
        {step === "finish" && !finished && (
          <div className="flex items-center px-6 py-3 border-t shrink-0">
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default AutopilotProjectGuide;
