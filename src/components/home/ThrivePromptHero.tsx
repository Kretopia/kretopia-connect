import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, ArrowUp, Loader2, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { normalizeIntents, type PrimaryIntent } from "@/lib/intents";
import { KretoMark } from "@/components/brand/KretoMark";

interface RouteResponse {
  intent: "create_workspace" | "find_people" | "find_gigs" | "outreach" | "profile_epk" | "summarize" | "chat";
  workspace_type?: "podcast" | "event" | "masterclass" | "content" | "campaign" | "music" | "client" | "general" | null;
  title?: string | null;
  target_query?: string | null;
  preview: string;
}

type Chip = { label: string; prompt: string };

// Workspace-aware chip presets — what's most useful next given what you're working on.
const CHIPS_BY_WORKSPACE: Record<string, Chip[]> = {
  event: [
    { label: "Find sponsors", prompt: "Find sponsors for my event" },
    { label: "Draft run sheet", prompt: "Draft a run sheet for my event" },
    { label: "Invite vendors", prompt: "Draft vendor outreach for my event" },
    { label: "Plan promo", prompt: "Plan a 2-week promo calendar for my event" },
  ],
  campaign: [
    { label: "Draft proposal", prompt: "Draft a proposal for my brand campaign" },
    { label: "Find sponsors", prompt: "Find brand sponsors for my campaign" },
    { label: "Asset matrix", prompt: "Build a paid + organic asset matrix for my campaign" },
    { label: "Schedule posts", prompt: "Plan a posting calendar for my campaign" },
  ],
  podcast: [
    { label: "Draft questions", prompt: "Draft interview questions for my next podcast guest" },
    { label: "Find guests", prompt: "Find podcast guests for my show" },
    { label: "Pitch sponsors", prompt: "Draft a sponsor pitch for my podcast" },
    { label: "Plan clips", prompt: "Plan clip drops for my latest episode" },
  ],
  music: [
    { label: "Plan release", prompt: "Plan a release rollout for my next song" },
    { label: "Set splits", prompt: "Help me set up splits with my collaborators" },
    { label: "Pitch playlists", prompt: "Draft a playlist pitch for my new release" },
    { label: "Find collaborators", prompt: "Find collaborators for my music project" },
  ],
  content: [
    { label: "Build shot list", prompt: "Build a shot list for my next content shoot" },
    { label: "Find a videographer", prompt: "Find a videographer in my city" },
    { label: "Plan calendar", prompt: "Plan a 4-week content calendar" },
    { label: "Draft script", prompt: "Draft a script for my next video" },
  ],
  client: [
    { label: "Draft proposal", prompt: "Draft a client proposal" },
    { label: "Send invoice", prompt: "Draft an invoice for my client" },
    { label: "Plan kickoff", prompt: "Plan a client kickoff agenda" },
    { label: "Update brief", prompt: "Update the brief for my client project" },
  ],
};

// Intent-led chips — one warm starter per onboarding intent.
const INTENT_LEAD_CHIP: Record<PrimaryIntent, Chip> = {
  gigs: { label: "Find paid gigs", prompt: "Find paid gigs that match my skills" },
  collaborate: { label: "Find collaborators", prompt: "Find collaborators near me" },
  hire: { label: "Find talent", prompt: "Find verified creatives for a project" },
  fund: { label: "Plan a campaign", prompt: "Help me plan a fundraising campaign" },
  manage: { label: "Draft an invoice", prompt: "Draft an invoice for a recent project" },
};

// Fallback chips when there's no active workspace — driven by intent + profile gaps.
function profileChips(opts: {
  hasBio: boolean;
  hasAvatar: boolean;
  creditsCount: number;
  connectionsCount: number;
  intents: PrimaryIntent[];
}): Chip[] {
  const chips: Chip[] = [];
  // Lead with the user's primary intent (if set) so the first chip feels personal.
  opts.intents.slice(0, 2).forEach((id) => {
    const c = INTENT_LEAD_CHIP[id];
    if (c && !chips.find((x) => x.label === c.label)) chips.push(c);
  });
  if (!opts.hasBio || !opts.hasAvatar) chips.push({ label: "Update Press Kit", prompt: "Help me update my Press Kit" });
  if (opts.creditsCount < 3) chips.push({ label: "Add a credit", prompt: "Help me add a credit to my profile" });
  // Always offer a draft action as a safe fallback.
  if (chips.length < 4) chips.push({ label: "Draft outreach", prompt: "Draft outreach to a sponsor or brand" });
  return chips.slice(0, 4);
}


/**
 * Fast-path: catch deck/proposal/treatment/rate-card/moodboard/one-pager intents
 * client-side and skip the LLM router — these always go straight to the
 * Executive Producer surface.
 */
function detectDocIntent(prompt: string):
  | "sponsor_deck" | "pitch_deck" | "business_plan" | "client_proposal"
  | "treatment" | "rate_card" | "moodboard_deck" | "one_pager" | null {
  const p = prompt.toLowerCase();
  if (/\b(sponsor(ship)?\s+deck|sponsor\s+pitch)\b/.test(p)) return "sponsor_deck";
  if (/\b(business\s+plan)\b/.test(p)) return "business_plan";
  if (/\b(pitch\s+deck|investor\s+deck|product\s+deck|app\s+deck)\b/.test(p)) return "pitch_deck";
  if (/\b(client\s+proposal|proposal\s+for\s+(a\s+)?client|project\s+proposal)\b/.test(p)) return "client_proposal";
  if (/\b(treatment|director'?s\s+treatment)\b/.test(p)) return "treatment";
  if (/\b(rate\s+card|service\s+packages?)\b/.test(p)) return "rate_card";
  if (/\b(moodboard|mood\s+board)\b/.test(p)) return "moodboard_deck";
  if (/\b(one[-\s]?pager)\b/.test(p)) return "one_pager";
  if (/\b(make|build|create|draft|generate)\s+(me\s+)?(a\s+)?(deck|slides|presentation)\b/.test(p)) return "pitch_deck";
  return null;
}


/**
 * ThrivePromptHero — the conversational entry point on Home.
 * Smart "For You" chips replace the static dropdown — driven by the user's
 * most recent active workspace and profile completeness.
 */
export function ThrivePromptHero({ firstName }: { firstName?: string } = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [activeWorkspaceType, setActiveWorkspaceType] = useState<string | null>(null);
  const [activeProjectTitle, setActiveProjectTitle] = useState<string | null>(null);
  const [profileSignals, setProfileSignals] = useState<{
    hasBio: boolean; hasAvatar: boolean; creditsCount: number; connectionsCount: number; intents: PrimaryIntent[];
  }>({ hasBio: true, hasAvatar: true, creditsCount: 3, connectionsCount: 5, intents: [] });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Listen for external prompt fill (Recent Intents, suggestion chips elsewhere)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string; submit?: boolean }>).detail;
      if (!detail?.prompt) return;
      setText(detail.prompt);
      if (detail.submit) void submit(detail.prompt);
    };
    window.addEventListener("thrive-prompt:fill", handler);
    return () => window.removeEventListener("thrive-prompt:fill", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pull smart-chip signals: most recent active project + profile completeness.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [proj, prof, credits, conns] = await Promise.all([
          supabase
            .from("projects")
            .select("workspace_type,title,updated_at")
            .eq("created_by", user.id)
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("profiles").select("bio,avatar_url,primary_intent,primary_intents").eq("user_id", user.id).maybeSingle(),
          supabase.from("credits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("connections").select("id", { count: "exact", head: true }).or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`).eq("status", "accepted"),
        ]);
        if (cancelled) return;
        setActiveWorkspaceType((proj.data as any)?.workspace_type || null);
        setActiveProjectTitle((proj.data as any)?.title || null);
        setProfileSignals({
          hasBio: !!(prof.data as any)?.bio,
          hasAvatar: !!(prof.data as any)?.avatar_url,
          creditsCount: credits.count ?? 0,
          connectionsCount: conns.count ?? 0,
          intents: normalizeIntents((prof.data as any)?.primary_intents ?? (prof.data as any)?.primary_intent),
        });
      } catch {
        /* non-fatal — fall back to default chips */
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const chips: Chip[] = useMemo(() => {
    if (activeWorkspaceType && CHIPS_BY_WORKSPACE[activeWorkspaceType]) {
      return CHIPS_BY_WORKSPACE[activeWorkspaceType];
    }
    return profileChips(profileSignals);
  }, [activeWorkspaceType, profileSignals]);

  const chipContextLabel = activeWorkspaceType && activeProjectTitle
    ? `For ${activeProjectTitle}`
    : "For you";

  async function submit(raw: string) {
    const prompt = raw.trim();
    if (!prompt || busy) return;
    if (!user) { navigate(`/auth?next=/?prompt=${encodeURIComponent(prompt)}`); return; }

    if (planMode) {
      window.dispatchEvent(
        new CustomEvent("thrive-copilot:open", { detail: { prompt, mode: "plan" } }),
      );
      void (supabase as any).from("thrive_intent_logs").insert({
        user_id: user.id, prompt, intent: "plan", routed_to: "copilot_planner",
      });
      setText("");
      return;
    }

    setBusy(true);
    try {
      // Fast-path: document/deck requests skip the LLM router entirely.
      const docIntent = detectDocIntent(prompt);
      if (docIntent) {
        navigate(`/thrive/generate?intent=${docIntent}&brief=${encodeURIComponent(prompt)}`);
        setText("");
        return;
      }
      // Client-side safety timeout — if routing stalls, fall back to opening chat.
      const routePromise = supabase.functions.invoke<RouteResponse>("route-thrive-intent", {
        body: { prompt },
      });
      const timeoutPromise = new Promise<{ data: RouteResponse; error: null }>((resolve) =>
        setTimeout(() => resolve({
          data: { intent: "chat", preview: "Let's talk it through." } as RouteResponse,
          error: null,
        }), 18000),
      );
      const { data, error } = await Promise.race([routePromise, timeoutPromise]) as any;
      if (error || !data) throw error || new Error("No response");

      void (supabase as any).from("thrive_intent_logs").insert({
        user_id: user.id,
        prompt,
        intent: data.intent,
        workspace_type: data.workspace_type || null,
        routed_to: data.intent === "create_workspace" ? "desk" : data.intent,
      });

      switch (data.intent) {
        case "create_workspace": {
          const wt = data.workspace_type || "general";
          const title = (data.title || prompt).slice(0, 80);
          const { data: proj, error: pErr } = await supabase
            .from("projects")
            .insert({
              title, created_by: user.id, workspace_type: wt,
              status: "active", setup_completed: false, description: prompt,
            } as any)
            .select("id")
            .single();
          if (pErr || !proj) throw pErr || new Error("Could not create");
          toast({ title: data.preview });
          navigate(`/desk/${proj.id}`);
          break;
        }
        case "find_people":
          navigate(`/scout?tab=match&q=${encodeURIComponent(data.target_query || prompt)}`);
          break;
        case "find_gigs":
          navigate(`/scout?tab=gigs&q=${encodeURIComponent(data.target_query || prompt)}`);
          break;
        case "outreach":
        case "summarize":
        case "chat":
          window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: { prompt } }));
          break;
        case "profile_epk":
          toast({ title: data.preview || "Opening your Press Kit…" });
          navigate("/profile");
          break;
      }
      setText("");
    } catch (e: any) {
      console.error(e);
      toast({ title: "Kreto couldn't read that", description: e?.message || "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function startVoice() {
    if (recording) { recorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) return;
        const buf = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        try {
          const { data, error } = await supabase.functions.invoke<{ transcript?: string; text?: string }>(
            "transcribe-voice-note",
            { body: { audio_base64: b64, mime_type: "audio/webm" } },
          );
          if (error) throw error;
          const transcript = (data?.transcript || data?.text || "").trim();
          if (transcript) { setText(transcript); void submit(transcript); }
        } catch (e: any) {
          toast({ title: "Couldn't transcribe", description: e?.message || "Try typing instead", variant: "destructive" });
        }
      };
      rec.start();
      setRecording(true);
    } catch {
      toast({ title: "Mic blocked", description: "Allow microphone access to speak to Kreto.", variant: "destructive" });
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <div aria-hidden className="absolute -top-24 -right-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-energy/10 blur-3xl" />

      <div className="relative">
        {/* h2, not h1: FeaturePageHeader owns the page's one <h1> (the
            personalized greeting, via UnifiedHome.tsx) — this is
            deliberately a *different*, shorter prompt so the two never read
            as a duplicate. font-display matches the h1's own font-family
            (--font-family-brand, via .landing-h1) instead of the previous
            unrelated serif — only the name is pink, matching the h1's own
            accent color; the "?" stays the same white as the rest of the
            line. */}
        <h2 className="font-display font-semibold leading-[1.05] tracking-tight text-[28px] sm:text-[34px] text-foreground">
          {firstName ? (
            <>What's next, <span className="text-[hsl(var(--energy))]">{firstName}</span></>
          ) : (
            "What's on your mind"
          )}
          ?
        </h2>

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); void submit(text); }}
          className="mt-5 group relative flex items-center gap-2 rounded-2xl border border-border/80 bg-background/80 px-2 py-1.5 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 transition-all"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(text); }
            }}
            placeholder="Ask Kreto anything…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-muted-foreground/70 max-h-32 leading-snug"
            disabled={busy}
          />
          <button
            type="button"
            onClick={startVoice}
            aria-label={recording ? "Stop recording" : "Speak to Kreto"}
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-xl transition-colors shrink-0",
              recording ? "bg-destructive text-destructive-foreground animate-pulse" : "text-foreground/70 hover:bg-foreground/5",
            )}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Send to Kreto"
            className="h-9 w-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-105 shrink-0"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
          </button>
        </form>

        {/* Smart "For You" chips — workspace-aware, no dropdown */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => { setText(c.prompt); void submit(c.prompt); }}
              disabled={busy}
              className="text-[12px] px-3 py-1.5 rounded-full bg-foreground/[0.06] hover:bg-foreground/10 text-foreground/85 transition-colors disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPlanMode((v) => !v)}
            aria-pressed={planMode}
            title="Plan mode — Kreto drafts an ordered plan you approve before anything runs."
            className={cn(
              "ml-auto inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border transition-colors",
              planMode
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-transparent hover:bg-foreground/5 text-muted-foreground border-border/70",
            )}
          >
            <ListChecks className="h-3 w-3" />
            {planMode ? "Plan: on" : "Plan"}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/70">{chipContextLabel}</span>
          {planMode && <span className="ml-1.5">· Thrive will wait for your approval before each step.</span>}
        </p>

        <AnimatePresence>
          {busy && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1.5"
            >
              <KretoMark size="xs" state="active" /> Kreto is figuring out the right move…
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
