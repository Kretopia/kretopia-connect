import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, Send, Loader2, Trash2, HelpCircle, Mic, Square, Volume2, VolumeX, Crown, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  startRecording,
  stopAndSend,
  cancelRecording,
  synthesizeReply,
  stopPlayback,
} from "@/lib/thriveVoice";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { KretoMark } from "@/components/brand/KretoMark";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  streamCopilot,
  loadCopilotHistory,
  inferSurface,
  SURFACE_LABEL,
  extractActions,
  type CopilotMessage,
  type CopilotSurface,
} from "@/lib/thriveCopilot";
import { sendAgentIntent, type OrchAction } from "@/lib/agentOrchestrator";
import { AgentApprovalCard } from "@/components/agent/AgentApprovalCard";
import { AgentResultCard, type AgentResultCardData } from "@/components/agent/AgentResultCard";
import { CopilotPlanCard, type CopilotPlan } from "@/components/agent/CopilotPlanCard";
import { CopilotCapabilities } from "@/components/agent/CopilotCapabilities";
import { resultCardForAction } from "@/lib/agentActionPresentation";

/**
 * Thrive Copilot — the SINGLE assistant for the whole platform.
 *
 * - Persistent thread across surfaces (Desk, Pay, Match, Credits, Events, Profile…)
 *   — server stores both turns in ai_messages so reopening anywhere shows full history.
 * - Surface chip tells the model where the user opened it from, so replies stay
 *   relevant to the page in front of them ("On: KrePay · Invoice #1042").
 * - Greets the user by first name on every reply (server-side prompt).
 *
 * Hidden on auth, landing, and other unauthenticated/full-screen surfaces.
 */

const QUICK_PROMPTS_BY_SURFACE: Partial<Record<CopilotSurface, string[]>> = {
  desk: [
    "Where does my main project stand?",
    "What's overdue?",
    "Draft tomorrow's first task for me",
  ],
  pay: [
    "How much am I owed right now?",
    "Draft a payment-due reminder",
    "Summarize this week's money",
  ],
  match: [
    "Find me a videographer in my city",
    "Draft an outreach DM",
  ],
  gigs: [
    "Find gigs that match my skills",
    "Help me write a strong application",
  ],
  home: [
    "What's the most useful thing I can do today?",
    "Catch me up since yesterday",
  ],
  profile: [
    "What's missing from my profile?",
    "Suggest a stronger bio for me",
  ],
  credit: [
    "Which credits should I verify next?",
    "Tag collaborators on my latest credit",
  ],
  event: [
    "Help me write a kickoff post for my next event",
    "Recap my last event for me",
  ],
};

type AgentActivity = {
  id: string;
  status: "running" | "done" | "failed";
  title: string;
  body?: string;
};

export const ThriveAgentFab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  // Map message index -> orchestrator actions proposed for that assistant turn.
  const [actionsByMsg, setActionsByMsg] = useState<Record<number, OrchAction[]>>({});
  // Map message index -> safe auto-executed result cards for that assistant turn.
  const [resultCardsByMsg, setResultCardsByMsg] = useState<Record<number, AgentResultCardData[]>>({});
  // Map message index -> visible "what Kreto is doing" activity rows.
  const [activityByMsg, setActivityByMsg] = useState<Record<number, AgentActivity[]>>({});
  // Map message index -> multi-step plans proposed for that assistant turn.
  const [plansByMsg, setPlansByMsg] = useState<Record<number, CopilotPlan[]>>({});
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [surfaceContext, setSurfaceContext] = useState<Record<string, unknown>>({});
  const [firstName, setFirstName] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [deskTab, setDeskTab] = useState<string>("today");
  const [capsOpen, setCapsOpen] = useState(false);
  // Voice state
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("thriveVoice:muted") === "1";
  });
  const recordTimerRef = useRef<number | null>(null);
  const [recordSec, setRecordSec] = useState(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Desktop (lg+, matches KretoLauncher's own breakpoint) renders as a
  // compact floating panel anchored above the launcher button instead of
  // the full-height bottom Sheet used on mobile.
  const [isDesktop, setIsDesktop] = useState(false);
  const desktopPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const surface: CopilotSurface = inferSurface(location.pathname);

  // Track Desk's active tab so we can hide the FAB when the chat tab is open.
  useEffect(() => {
    const onTab = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") setDeskTab(detail);
    };
    window.addEventListener("thrivedesk:set-tab", onTab);
    window.addEventListener("thrivedesk:tab-changed", onTab);
    return () => {
      window.removeEventListener("thrivedesk:set-tab", onTab);
      window.removeEventListener("thrivedesk:tab-changed", onTab);
    };
  }, []);

  // Reset deskTab when leaving /desk
  useEffect(() => {
    if (!location.pathname.startsWith("/desk")) setDeskTab("today");
  }, [location.pathname]);

  // Allow any surface to open the Copilot with a preset prompt:
  //   window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: { prompt: "..." } }))
  // Or open in explicit plan-and-execute mode:
  //   window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: { prompt: "...", mode: "plan" } }))
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { prompt?: string; mode?: "plan" | "chat" | "voice"; context?: Record<string, unknown> }
        | undefined;
      setOpen(true);

      // Merge in any handoff context (e.g. a selected Scout opportunity) so
      // it's available to the model via surface_context. Client-supplied
      // IDs only — the server re-resolves and authorizes ownership itself,
      // it never trusts these values for anything sensitive.
      if (detail?.context) {
        setSurfaceContext((prev) => ({ ...prev, ...detail.context }));
      }

      // Voice mode: open the drawer and auto-start recording.
      if (detail?.mode === "voice") {
        setTimeout(() => {
          handleStartVoice();
        }, 250);
        return;
      }

      if (!detail?.prompt) return;

      if (detail.mode === "plan") {
        // Skip free-form chat — go straight to the planner and render a PlanCard.
        const goal = detail.prompt;
        setTimeout(() => {
          setMessages((prev) => {
            const userMsg: CopilotMessage = { role: "user", content: `Plan & execute: ${goal}` };
            const assistantMsg: CopilotMessage = {
              role: "assistant",
              content: "Drafting a plan…",
            };
            const next = [...prev, userMsg, assistantMsg];
            const assistantIdx = next.length - 1;
            // Kick the planner asynchronously
            (async () => {
              try {
                const projectId =
                  (surfaceContext as any)?.project_id ??
                  (surfaceContext as any)?.active_project?.id ??
                  null;
                const { data, error } = await supabase.functions.invoke("copilot-planner", {
                  body: { goal, surface, project_id: projectId },
                });
                if (error) throw error;
                if (data?.plan_id) {
                  setPlansByMsg((p) => ({
                    ...p,
                    [assistantIdx]: [
                      ...(p[assistantIdx] ?? []),
                      {
                        id: data.plan_id,
                        goal,
                        summary: data.summary,
                        status: data.status ?? "proposed",
                        steps: data.steps ?? [],
                        autoRun: true,
                      },
                    ],
                  }));
                  setMessages((prev2) =>
                    prev2.map((m, i) =>
                      i === assistantIdx
                        ? { ...m, content: data.summary || "Here's the plan — review the steps below." }
                        : m,
                    ),
                  );
                } else {
                  setMessages((prev2) =>
                    prev2.map((m, i) =>
                      i === assistantIdx
                        ? { ...m, content: data?.summary || "Couldn't draft a plan for that. Try being more specific." }
                        : m,
                    ),
                  );
                }
              } catch (err) {
                console.warn("Plan-mode planner failed", err);
                toast.error("Couldn't draft that plan — try again.");
                setMessages((prev2) =>
                  prev2.map((m, i) =>
                    i === assistantIdx
                      ? { ...m, content: "Sorry — planning failed. Try again." }
                      : m,
                  ),
                );
              }
            })();
            return next;
          });
        }, 50);
        return;
      }

      // Default: just prefill the composer.
      setTimeout(() => setText(detail.prompt!), 50);
    };
    window.addEventListener("thrive-copilot:open", handler);
    return () => window.removeEventListener("thrive-copilot:open", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, surfaceContext]);

  // Resolve surface_context from the URL where helpful (project_id from /desk/:id)
  useEffect(() => {
    const ctx: Record<string, unknown> = { pathname: location.pathname };
    if (firstName) ctx.first_name_hint = firstName;
    const deskMatch = location.pathname.match(/^\/desk\/([0-9a-f-]{36})/i);
    if (deskMatch) ctx.project_id = deskMatch[1];
    const eventMatch = location.pathname.match(/^\/event\/([^/]+)/i);
    if (eventMatch) ctx.event_slug_or_id = eventMatch[1];
    setSurfaceContext(ctx);
  }, [location.pathname, firstName]);

  // Pull the user's first name for the personalized greeting + as a hint to
  // the model via surface_context (the server already loads this, but sending
  // it client-side guarantees the empty-state greeting is never "Hey —").
  useEffect(() => {
    if (!user) {
      setFirstName(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const fn = (data?.full_name ?? "").trim().split(/\s+/)[0] || null;
        setFirstName(fn);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // When the drawer opens for the first time, hydrate persisted history.
  useEffect(() => {
    if (!open || historyLoaded || !user) return;
    let cancelled = false;
    loadCopilotHistory()
      .then((rows) => {
        if (cancelled) return;
        setMessages(rows);
        setHistoryLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, historyLoaded, user]);

  // Auto-scroll on new content
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  // Desktop compact panel has no Radix overlay, so wire its own
  // click-outside / Escape dismissal. The launcher button is excluded so
  // clicking it doesn't immediately close what it just opened.
  useEffect(() => {
    if (!isDesktop || !open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (desktopPanelRef.current?.contains(target)) return;
      if ((e.target as HTMLElement)?.closest?.('[aria-label="Open Kreto"]')) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isDesktop, open]);

  const send = useCallback(
    async (msgText?: string): Promise<string> => {
      const content = (msgText ?? text).trim();
      if (!content || sending) return "";
      const userMsg: CopilotMessage = { role: "user", content };
      const next = [...messages, userMsg];
      setMessages(next);
      setText("");
      setSending(true);

      // Optimistic empty assistant placeholder so streaming can fill it.
      // Strip <action>/<plan> tags live so the user never sees raw XML/JSON
      // mid-stream — even partial/unclosed tags get hidden.
      let assistantSoFar = "";
      const stripTagsLive = (raw: string) => {
        // Remove fully-closed tags first
        let out = raw
          .replace(/<action>[\s\S]*?<\/action>/g, "")
          .replace(/<plan>[\s\S]*?<\/plan>/g, "");
        // Hide any half-streamed opening tag and everything after it
        const openIdx = Math.min(
          ...["<action", "<plan"].map((t) => {
            const i = out.indexOf(t);
            return i === -1 ? Infinity : i;
          }),
        );
        if (openIdx !== Infinity) out = out.slice(0, openIdx);
        return out;
      };
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        const visible = stripTagsLive(assistantSoFar);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: visible } : m,
            );
          }
          return [...prev, { role: "assistant", content: visible }];
        });
      };

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamCopilot({
          // Server already has prior history; send only the latest user turn
          messages: [userMsg],
          surface,
          surfaceContext,
          conversationId,
          onConversationId: setConversationId,
          onDelta: upsertAssistant,
          onDone: () => setSending(false),
          onError: (err) => {
            toast.error(err);
            // Roll back the optimistic user message if nothing came back
            if (!assistantSoFar) {
              setMessages((prev) => prev.filter((m) => m !== userMsg));
            }
            setSending(false);
          },
          signal: controller.signal,
        });

        // ---- Cross-surface action extraction ----
        // After streaming completes, scan the assistant text for <action> tags,
        // strip them from the visible bubble, and ask the orchestrator to
        // propose them as approval cards.
        const { visible, actions: parsed, plans: parsedPlans } = extractActions(assistantSoFar);
        if (parsed.length > 0 || parsedPlans.length > 0) {
          const assistantIdx = messages.length + 1;
          setMessages((prev) => {
            const idx = prev.length - 1;
            if (prev[idx]?.role === "assistant") {
              return prev.map((m, i) =>
                i === idx ? { ...m, content: visible || "On it." } : m,
              );
            }
            return prev;
          });

          // Fan out: each parsed action becomes a queued orchestrator run.
          for (const intentObj of parsed) {
            const activityId = `action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setActivityByMsg((prev) => ({
              ...prev,
              [assistantIdx]: [
                ...(prev[assistantIdx] ?? []),
                {
                  id: activityId,
                  status: "running",
                  title: "Finding the right tool",
                  body: intentObj.intent,
                },
              ],
            }));
            try {
              const run = await sendAgentIntent(intentObj.intent, {
                surface: intentObj.surface ?? surface,
                ...surfaceContext,
              });
              if (assistantIdx >= 0 && run.actions?.length) {
                const proposed = run.actions.filter((action) => action.status === "proposed");
                const resultCards = run.actions
                  .map(resultCardForAction)
                  .filter(Boolean) as AgentResultCardData[];
                if (proposed.length) {
                  setActionsByMsg((prev) => ({
                    ...prev,
                    [assistantIdx]: [...(prev[assistantIdx] ?? []), ...proposed],
                  }));
                }
                if (resultCards.length) {
                  setResultCardsByMsg((prev) => ({
                    ...prev,
                    [assistantIdx]: [...(prev[assistantIdx] ?? []), ...resultCards],
                  }));
                }
                setActivityByMsg((prev) => ({
                  ...prev,
                  [assistantIdx]: (prev[assistantIdx] ?? []).map((item) =>
                    item.id === activityId
                      ? {
                          ...item,
                          status: "done",
                          title: proposed.length
                            ? "Ready for your approval"
                            : resultCards.length
                              ? "Done — result ready"
                              : "Checked the available tools",
                          body: proposed.length
                            ? `${proposed.length} action${proposed.length === 1 ? "" : "s"} below need your approval.`
                            : resultCards.length
                              ? "Open the result card below to continue."
                              : run.reasoning,
                        }
                      : item,
                  ),
                }));
              }
            } catch (err) {
              console.warn("Copilot action propose failed", err);
              setActivityByMsg((prev) => ({
                ...prev,
                [assistantIdx]: (prev[assistantIdx] ?? []).map((item) =>
                  item.id === activityId
                    ? {
                        ...item,
                        status: "failed",
                        title: "Couldn't queue that action",
                        body: err instanceof Error ? err.message : "Try again.",
                      }
                    : item,
                ),
              }));
              toast.error("Couldn't queue that action — try again.");
            }
          }

          // Fan out: each parsed plan calls the planner directly and renders a PlanCard.
          for (const planReq of parsedPlans) {
            const activityId = `plan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setActivityByMsg((prev) => ({
              ...prev,
              [assistantIdx]: [
                ...(prev[assistantIdx] ?? []),
                {
                  id: activityId,
                  status: "running",
                  title: "Building the plan",
                  body: planReq.goal,
                },
              ],
            }));
            try {
              const { data, error } = await supabase.functions.invoke("copilot-planner", {
                body: {
                  goal: planReq.goal,
                  surface: planReq.surface ?? surface,
                  project_id: (surfaceContext as any)?.active_project?.id ?? null,
                },
              });
              if (error) throw error;
              if (assistantIdx >= 0 && data?.plan_id) {
                setPlansByMsg((prev) => ({
                  ...prev,
                  [assistantIdx]: [
                    ...(prev[assistantIdx] ?? []),
                    {
                      id: data.plan_id,
                      goal: planReq.goal,
                      summary: data.summary,
                      status: data.status ?? "proposed",
                      steps: data.steps ?? [],
                      autoRun: false,
                    },
                  ],
                }));
                setActivityByMsg((prev) => ({
                  ...prev,
                  [assistantIdx]: (prev[assistantIdx] ?? []).map((item) =>
                    item.id === activityId
                      ? {
                          ...item,
                          status: "done",
                          title: "Plan ready for approval",
                          body: `${data.steps?.length ?? 0} step${(data.steps?.length ?? 0) === 1 ? "" : "s"} prepared below.`,
                        }
                      : item,
                  ),
                }));
              } else if (data?.summary) {
                setActivityByMsg((prev) => ({
                  ...prev,
                  [assistantIdx]: (prev[assistantIdx] ?? []).map((item) =>
                    item.id === activityId
                      ? { ...item, status: "done", title: "No plan needed", body: data.summary }
                      : item,
                  ),
                }));
                toast.message(data.summary);
              }
            } catch (err) {
              console.warn("Copilot plan propose failed", err);
              setActivityByMsg((prev) => ({
                ...prev,
                [assistantIdx]: (prev[assistantIdx] ?? []).map((item) =>
                  item.id === activityId
                    ? {
                        ...item,
                        status: "failed",
                        title: "Couldn't build the plan",
                        body: err instanceof Error ? err.message : "Try again.",
                      }
                    : item,
                ),
              }));
              toast.error("Couldn't draft that plan — try again.");
            }
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
        setSending(false);
      } finally {
        abortRef.current = null;
      }
      return assistantSoFar;
    },
    [text, sending, messages, surface, surfaceContext, conversationId],
  );

  const clearHistory = useCallback(async () => {
    if (!user) return;
    // One-click reset — no confirm dialog. Wipe local state immediately so
    // the next prompt starts fresh, then clean up the server copy in the
    // background.
    setMessages([]);
    setActionsByMsg({});
    setResultCardsByMsg({});
    setActivityByMsg({});
    setPlansByMsg({});
    setConversationId(undefined);
    toast.success("Chat reset — next prompt starts fresh");
    try {
      const { data: convo } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", "__copilot__")
        .maybeSingle();
      if (convo?.id) {
        await supabase.from("ai_messages").delete().eq("conversation_id", convo.id);
      }
    } catch (e) {
      console.warn("Background history wipe failed", e);
    }
  }, [user]);

  // ===== Thrive Voice (push-to-talk) =====
  const handleStartVoice = useCallback(async () => {
    if (recording || voiceBusy) return;
    try {
      stopPlayback();
      setSpeaking(false);
      await startRecording();
      setRecording(true);
      setRecordSec(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSec((s) => {
          const next = s + 1;
          if (next >= 60) {
            // Hard cap a single utterance at 60s
            handleStopVoice();
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't access microphone");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, voiceBusy]);

  const handleCancelVoice = useCallback(() => {
    cancelRecording();
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
    setRecordSec(0);
  }, []);

  const handleStopVoice = useCallback(async () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
    setVoiceBusy(true);
    try {
      const result = await stopAndSend();
      if (result.ok === false) {
        if (result.code === "voice_daily_limit") {
          if (result.transcript) {
            setMessages((prev) => [...prev, { role: "user", content: `🎙️ ${result.transcript}` }]);
          }
          toast.error(
            result.tier === "free"
              ? "You've hit today's free voice limit (2 min/day). Upgrade for more."
              : "You've hit today's voice limit. Upgrade for more.",
            {
              action: { label: "Upgrade", onClick: () => navigate("/subscription") },
              duration: 8000,
            },
          );
        } else {
          toast.error(result.message);
        }
        return;
      }

      // Route the transcript through the SAME chat agent path so every tool
      // (find_talent, draft_quote, draft_invoice, start_video_call, memory…)
      // and every <action>/<plan> tag fires exactly like a typed message.
      const reply = await send(result.transcript);

      // Speak the assistant reply unless muted.
      if (reply && !voiceMuted) {
        setSpeaking(true);
        try {
          await synthesizeReply(reply);
          // SpeechSynthesis has no clean "ended" hook in fallback path; estimate.
          const ms = Math.max(1500, (reply.split(/\s+/).length / 3) * 1000);
          window.setTimeout(() => setSpeaking(false), ms);
        } catch {
          setSpeaking(false);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice turn failed");
    } finally {
      setVoiceBusy(false);
      setRecordSec(0);
    }
  }, [voiceMuted, navigate, send]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      cancelRecording();
      stopPlayback();
    };
  }, []);

  const toggleMute = useCallback(() => {
    setVoiceMuted((m) => {
      const next = !m;
      try { localStorage.setItem("thriveVoice:muted", next ? "1" : "0"); } catch { /* ignore */ }
      if (next) {
        stopPlayback();
        setSpeaking(false);
      }
      return next;
    });
  }, []);


  // If there's no user at all, don't mount anything (avoids flashing the drawer pre-auth).
  if (!user) return null;

  const quickPrompts = QUICK_PROMPTS_BY_SURFACE[surface] ?? QUICK_PROMPTS_BY_SURFACE.home!;
  const surfaceLabel = SURFACE_LABEL[surface];

  // showClose: the desktop panel has no other chrome around it, so it needs
  // its own close button. It's positioned absolutely (not dropped into the
  // action row below) because that row -- badge + "What can I do?" + Reset --
  // is already close to the panel's 380px width; a fourth item pushed it
  // past the panel's own right edge, clipped by its overflow-hidden. Fixed
  // width/inset instead, with the header's own padding widened on the right
  // so its content never runs under it. The mobile Sheet already renders its
  // own top-right close affordance, so this stays false there to avoid a
  // duplicate.
  const chatHeader = (showClose: boolean) => (
    <div className={cn("relative pl-5 pt-5 pb-3 border-b border-border shrink-0", showClose ? "pr-16" : "pr-5")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Kreto
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
            On: {surfaceLabel}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1 text-muted-foreground hover:text-foreground", showClose ? "w-7 px-0" : "px-2")}
            onClick={() => setCapsOpen(true)}
            aria-label="What can Copilot do?"
            title={showClose ? "What can I do?" : undefined}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {!showClose && <span className="text-[11px] font-medium">What can I do?</span>}
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 gap-1 text-muted-foreground hover:text-foreground", showClose ? "w-7 px-0" : "px-2")}
              onClick={clearHistory}
              aria-label="Reset chat memory"
              title="Reset chat memory — next prompt starts fresh"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {!showClose && <span className="text-[11px] font-medium">Reset</span>}
            </Button>
          )}
        </div>
      </div>
      {showClose && (
        <Button
          variant="ghost"
          size="icon"
          // Inline position, not the `absolute` utility class: every ghost
          // Button carries the global .btn-glass class (index.css), which
          // sets `position: relative` outside Tailwind's cascade layers --
          // unlayered CSS beats a plain utility class regardless of source
          // order, so `className="absolute ..."` here silently loses.
          style={{ position: "absolute" }}
          className="right-3 top-3 h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
          aria-label="Close Kreto"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  const messagesArea = (
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3"
          >
            {messages.length === 0 && historyLoaded && !sending && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {firstName ? `Hey ${firstName} — ` : "Hey — "}I'm Kreto, your Creative EP.
                  I know your profile, projects, money and events, and I follow you
                  across the platform. What's up?
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Try
                    </div>
                    <button
                      onClick={() => setCapsOpen(true)}
                      className="text-[10px] font-semibold text-primary hover:underline"
                    >
                      See everything →
                    </button>
                  </div>
                  {quickPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      disabled={sending}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/40 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-accent/60 text-foreground",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_pre]:my-1 [&_pre]:text-xs">
                      <ReactMarkdown>{extractActions(m.content).visible || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
                {/* Visible activity rows so users can see what Kreto is doing before a card appears */}
                {m.role === "assistant" && activityByMsg[i]?.length ? (
                  <div className="space-y-1.5 max-w-[95%]">
                    {activityByMsg[i].map((item) => {
                      const Icon = item.status === "running" ? Loader2 : item.status === "failed" ? AlertCircle : CheckCircle2;
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs"
                        >
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5",
                                item.status === "running" && "animate-spin text-primary",
                                item.status === "done" && "text-primary",
                                item.status === "failed" && "text-destructive",
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold leading-snug text-foreground">{item.title}</p>
                            {item.body && (
                              <p className="mt-0.5 line-clamp-2 text-muted-foreground">{item.body}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {/* Approval cards for any actions this assistant turn proposed */}
                {m.role === "assistant" && actionsByMsg[i]?.length ? (
                  <div className="space-y-2 max-w-[95%]">
                    {actionsByMsg[i].map((action) => (
                      <AgentApprovalCard
                        key={action.id}
                        action={action}
                        compact
                        onResolved={(decision, execResult) => {
                          // Mark the local copy as resolved so the card hides itself.
                          setActionsByMsg((prev) => ({
                            ...prev,
                            [i]: (prev[i] ?? []).map((a) =>
                              a.id === action.id
                                ? {
                                    ...a,
                                    status:
                                      decision === "approved"
                                        ? "executed"
                                        : "rejected",
                                    result: execResult ?? a.result,
                                  }
                                : a,
                            ),
                          }));
                          // On approval, surface a tappable result card so the
                          // user can jump straight to the thing Thrive made.
                          if (decision === "approved") {
                            const card = resultCardForAction({
                              ...action,
                              status: "executed",
                              result: execResult ?? action.result,
                            } as OrchAction);
                            if (card) {
                              setResultCardsByMsg((prev) => ({
                                ...prev,
                                [i]: [...(prev[i] ?? []), card],
                              }));
                            }
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : null}
                {/* Result cards for safe auto-runs (e.g. Sponsor Radar) */}
                {m.role === "assistant" && resultCardsByMsg[i]?.length ? (
                  <div className="space-y-2 max-w-[95%]">
                    {resultCardsByMsg[i].map((card) => (
                      <AgentResultCard key={card.id} card={card} compact onOpen={() => setOpen(false)} />
                    ))}
                  </div>
                ) : null}
                {/* Plan cards for multi-step plans this turn proposed */}
                {m.role === "assistant" && plansByMsg[i]?.length ? (
                  <div className="space-y-2 max-w-[95%]">
                    {plansByMsg[i].map((plan) => (
                      <CopilotPlanCard key={plan.id} plan={plan} />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {sending && messages[messages.length - 1]?.role === "user" && (
              <div className="mr-auto bg-accent/60 rounded-2xl px-3.5 py-2.5 text-sm text-muted-foreground inline-flex items-center gap-2">
                <KretoMark size="xs" state="active" />
                Thinking…
              </div>
            )}
            {voiceBusy && (
              <div className="mr-auto bg-primary/10 border border-primary/30 rounded-2xl px-3.5 py-2.5 text-sm text-foreground inline-flex items-center gap-2">
                <KretoMark size="xs" state="pending" />
                Hearing you out…
              </div>
            )}
            {speaking && !voiceMuted && (
              <div className="mr-auto bg-accent/60 rounded-2xl px-3.5 py-2.5 text-xs text-muted-foreground inline-flex items-center gap-2">
                <KretoMark size="xs" state="active" />
                Kreto is speaking…
                <button
                  className="ml-1 underline text-primary"
                  onClick={() => { stopPlayback(); setSpeaking(false); }}
                >
                  stop
                </button>
              </div>
            )}
          </div>
  );

  const composerArea = (
          <div className="border-t border-border bg-background p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shrink-0">
            {recording ? (
              <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2.5">
                <KretoMark size="xs" state="recording" className="shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="font-medium text-foreground">Listening…</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {Math.floor(recordSec / 60)}:{(recordSec % 60).toString().padStart(2, "0")} · max 60s
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-muted-foreground"
                  onClick={handleCancelVoice}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-9 px-3 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleStopVoice}
                >
                  <Square className="h-3.5 w-3.5 fill-current" /> Send
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Ask or tap mic to talk…`}
                  rows={2}
                  className="resize-none text-sm flex-1 min-h-[44px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={toggleMute}
                  aria-label={voiceMuted ? "Unmute Kreto's voice" : "Mute Kreto's voice"}
                  title={voiceMuted ? "Voice replies muted" : "Voice replies on"}
                >
                  {voiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-primary" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={handleStartVoice}
                  disabled={voiceBusy || sending}
                  aria-label="Talk to Kreto"
                  title="Tap to talk · 60s max"
                >
                  {voiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={() => send()}
                  disabled={!text.trim() || sending}
                  size="icon"
                  className="h-11 w-11 shrink-0"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            {!recording && messages.length === 0 && historyLoaded && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <Crown className="h-2.5 w-2.5" />
                <span>Free: 2 min/day voice · Creator: 15 min · Creator+: 60 min</span>
              </div>
            )}
          </div>
  );

  return (
    <>
      {/* Entry points: docked ThriveBar (mobile) and KretoLauncher (desktop).
          Desktop opens a compact panel anchored above the launcher button;
          mobile keeps the full-height bottom Sheet, which fits the platform's
          own drawer conventions. Both render the exact same chat content. */}

      {isDesktop ? (
        open && (
          <div
            ref={desktopPanelRef}
            role="dialog"
            aria-label="Kreto chat"
            className="hidden lg:flex fixed z-40 flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
            style={{
              right: "max(1.25rem, env(safe-area-inset-right))",
              bottom: "calc(max(1.25rem, env(safe-area-inset-bottom)) + 4.25rem)",
              width: "380px",
              height: "min(600px, 75vh)",
            }}
          >
            {chatHeader(true)}
            {messagesArea}
            {composerArea}
          </div>
        )
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl border-t border-border p-0 h-[85vh] flex flex-col"
          >
            {chatHeader(false)}
            {messagesArea}
            {composerArea}
          </SheetContent>
        </Sheet>
      )}

      <CopilotCapabilities
        open={capsOpen}
        onOpenChange={setCapsOpen}
        onPick={(prompt) => {
          setOpen(true);
          setTimeout(() => send(prompt), 60);
        }}
      />
    </>
  );
};
