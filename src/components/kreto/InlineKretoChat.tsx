import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Square, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { BRAND } from "@/lib/brandLexicon";
import {
  streamCopilot, loadConversationMessages, createConversation, extractActions, autocompleteKreto,
  openKretoAttachment, deleteKretoAttachment, type CopilotMessage, type KretoActionNote, type KretoRouteInfo,
} from "@/lib/thriveCopilot";
import { KretoComposerAttach, type ComposerAttachment } from "@/components/kreto/KretoComposerAttach";
import { KretoQuotaIndicator, KRETO_ALLOWANCE_NOTICE_ID } from "@/components/kreto/KretoQuotaIndicator";
import { useAiAllowance } from "@/hooks/useAiAllowance";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { matchKretoRoute } from "@/lib/kretoInstantRoute";
import { KretoModelPicker, KretoRouteHints } from "@/components/kreto/KretoModelPicker";
import { cn } from "@/lib/utils";
import { kretoReplyText } from "@/lib/kretoReplyText";
import { AgentApprovalCard } from "@/components/agent/AgentApprovalCard";
import { sendAgentIntent, type OrchAction } from "@/lib/agentOrchestrator";
import { KretoContextPicker } from "@/components/kreto/KretoContextPicker";
import { KretoSettings } from "@/components/kreto/KretoSettings";
import { DEFAULT_CONTEXT_CHOICE, readContextChoice, sourcesLabel, writeContextChoice, type KretoContextChoice } from "@/lib/kretoContext";
import {
  DEFAULT_KRETO_CHOICE, kretoEffortLabel, kretoModelName, previewShare, readKretoChoice, sharePctLabel, writeKretoChoice, type KretoChoice, type KretoEffort,
} from "@/lib/kretoProfiles";

// Strip <action>/<plan> tags from the live-streaming buffer, same approach
// already proven in ThriveAgentFab.tsx — remove fully-closed tags, then hide
// any half-streamed opening tag and everything after it so partial JSON/XML
// never flashes on screen mid-stream.
function stripTagsLive(raw: string): string {
  let out = raw
    .replace(/<action>[\s\S]*?<\/action>/g, "")
    .replace(/<plan>[\s\S]*?<\/plan>/g, "");
  const openIdx = Math.min(
    ...["<action", "<plan"].map((t) => {
      const i = out.indexOf(t);
      return i === -1 ? Infinity : i;
    }),
  );
  if (openIdx !== Infinity) out = out.slice(0, openIdx);
  return out;
}

/** Close enough to the bottom that the reader is "following" the stream. */
const FOLLOW_THRESHOLD_PX = 48;

/** A plan needs the step-by-step approval flow, which this page does not have yet: say so instead of pointing elsewhere. */
const PLAN_NOTE: KretoActionNote = { tone: "info", title: "I've sketched a multi-step plan, but I can't run plans from this page yet, so nothing was started." };

/** What happened to an action that is not waiting for approval. Null for one that is. Only what the server recorded. */
function actionNote(a: OrchAction): KretoActionNote | null {
  const title = a.preview_title || "That";
  const result = (a.result ?? null) as { message?: string; outcome?: string } | null;
  if (a.status === "auto_executed" || a.status === "executed") return { tone: "done", title };
  if (a.status === "failed") return { tone: result?.outcome === "unknown" ? "unknown" : "failed", title, detail: result?.message ?? "This didn't go through." };
  if (a.status === "rejected") return { tone: "blocked", title, detail: a.preview_body || "I can't do this for you." };
  return null;
}

/** Status chip words and colours (semantic tokens only). */
const NOTE_CHIP: Record<KretoActionNote["tone"], { label: string; className: string } | null> = {
  done: { label: "Done", className: "border-border bg-muted text-foreground" },
  failed: { label: "Didn't go through", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  unknown: { label: "Not confirmed", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  blocked: { label: "Not allowed", className: "border-border bg-muted text-muted-foreground" },
  dismissed: { label: "Dismissed", className: "border-border bg-muted text-muted-foreground" },
  info: null,
};

function ActionNoteLine({ note }: { note: KretoActionNote }) {
  const chip = NOTE_CHIP[note.tone];
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 whitespace-normal text-xs text-muted-foreground" data-testid="kreto-action-note">
      {chip && <span className={cn("rounded-full border px-1.5 py-px text-[10px] font-semibold", chip.className)}>{chip.label}</span>}
      <span className="text-foreground">{note.title}</span>
      {note.detail && <span>{note.detail}</span>}
    </p>
  );
}

type BubbleProps = CopilotMessage & {
  /** An approval card was decided: hide it and say what happened. */
  onActionResolved?: (actionId: string, status: "executed" | "failed" | "rejected", note: KretoActionNote) => void;
};

// Memoised so a streamed token re-renders only the bubble that changed, not the whole thread.

const MessageBubble = memo(function MessageBubble({ role, content, attachments, kreto, sources, actions, notes, preparing, onActionResolved }: BubbleProps) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const reply = role === "assistant" ? kretoReplyText(content) : content;
  return (
    <div
      className={
        role === "user"
          ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm border border-[hsl(var(--energy)/0.25)] bg-[hsl(var(--energy)/0.12)] px-3.5 py-2 text-sm text-foreground break-words"
          : "mr-auto max-w-[92%] rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-3.5 py-2 text-sm text-foreground whitespace-pre-wrap break-words"
      }
    >
      {reply || (!content && (
        <span className="inline-flex h-5 items-center gap-1.5 text-muted-foreground">
          <KretopiaSpinner className="h-3 w-3" /> {BRAND.agentName} is thinking…
        </span>
      ))}
      {role === "assistant" && content && (kreto || sources) && (
        // The answer first; what answered and what it drew on stay one quiet line, the sources one tap away.
        <div className="mt-1.5 whitespace-normal text-[10px] text-muted-foreground">
          {kreto && <span className="font-medium" data-testid="kreto-route-label">{kreto}</span>}
          {sources && (
            <details className="mt-0.5" data-testid="kreto-sources">
              <summary className="w-fit cursor-pointer select-none font-medium hover:text-foreground">Sources</summary>
              <p className="mt-0.5">From your Kretopia data: {sources}</p>
            </details>
          )}
        </div>
      )}
      {attachments?.filter(a => !removed.includes(a.id)).map(a => (
        <div key={a.id} className="mt-2 flex items-center gap-2 border-t border-border pt-2 text-foreground">
          <Button variant="ghost" size="sm" disabled={a.expired} className="min-w-0" onClick={() => openKretoAttachment(a.id).catch(e => setAttachmentError(e.message))}>
            <Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{a.name}{a.expired ? " · Expired" : ""}</span>
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${a.name}`} title={`Delete ${a.name}`} onClick={() => deleteKretoAttachment(a.id).then(() => setRemoved(ids => [...ids, a.id])).catch(e => setAttachmentError(e.message))}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      {attachmentError && <p role="alert" className="mt-2 text-xs text-destructive">{attachmentError}</p>}
      {role === "assistant" && (preparing ?? 0) > 0 && (
        <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <KretopiaSpinner className="h-3 w-3" /> Getting that ready for your approval
        </span>
      )}
      {role === "assistant" && notes?.map((n, i) => <ActionNoteLine key={i} note={n} />)}
      {role === "assistant" && actions?.some((a) => a.status === "proposed") && (
        <div className="mt-2 space-y-2 whitespace-normal">
          {actions.filter((a) => a.status === "proposed").map((a) => (
            <AgentApprovalCard
              key={a.id}
              action={a}
              compact
              onResolved={(decision, _result, outcome) => {
                const title = a.preview_title || "That";
                if (decision === "rejected") onActionResolved?.(a.id, "rejected", { tone: "dismissed", title });
                else if (outcome?.ok) onActionResolved?.(a.id, "executed", { tone: "done", title });
                else onActionResolved?.(a.id, "failed", { tone: outcome?.outcome === "unknown" ? "unknown" : "failed", title, detail: outcome?.message ?? "This didn't go through." });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface InlineKretoChatProps {
  seedPrompt?: string | null;
  /** Bump this any time seedPrompt should (re)send — including clicking the
   *  same quick action twice, which wouldn't otherwise re-fire the effect
   *  since the string value wouldn't change. */
  seedNonce?: number;
  /** The active conversation, or null for a fresh, not-yet-persisted draft —
   *  sending the first message in a draft lazily creates the real row. */
  conversationId: string | null;
  /** Fired once a draft becomes a real conversation (first send), and again
   *  any time the caller should know the list of conversations changed. */
  onConversationCreated?: (id: string) => void;
  /** Shown inside the thread while it has no messages, so the card keeps one fixed size
   *  instead of growing (and pushing the page) when the first message lands. */
  emptyState?: ReactNode;
}

/**
 * Inline Kreto thread — the chat lives on the page itself, not in the floating
 * bubble. Streams the first token straight into the thread so replies feel
 * instant, and keeps the composer pinned under the conversation.
 */
export function InlineKretoChat({ seedPrompt, seedNonce, conversationId, onConversationCreated, emptyState }: InlineKretoChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(conversationId);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Whether the reader is at the bottom (and so wants new text kept in view). Scrolling up to
  // read pauses it; sending a message or pressing "Latest" resumes it.
  const followRef = useRef(true);
  // Numbers the live replies (live-1, live-2…) so actions and notes attach to the right one.
  const liveSeqRef = useRef(0);
  // An approval card was decided: hide it and leave a plain note of what happened.
  const onActionResolved = useCallback((actionId: string, status: "executed" | "failed" | "rejected", note: KretoActionNote) => {
    setMessages((m) =>
      m.map((msg) =>
        msg.actions?.some((a) => a.id === actionId)
          ? { ...msg, actions: msg.actions.map((a) => (a.id === actionId ? { ...a, status } : a)), notes: [...(msg.notes ?? []), note] }
          : msg,
      ),
    );
  }, []);
  const [showLatest, setShowLatest] = useState(false);
  // The id of a conversation this component just created itself: its live messages are already
  // on screen, so the history effect must not wipe and reload them mid-stream.
  const createdHereRef = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  // Attachments (parsed server-side at upload), the last failed draft for
  // retry, the ghost-text autocomplete suggestion, and a counter that
  // re-reads the quota indicator after each send.
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [lastError, setLastError] = useState<{ message: string; draft: string } | null>(null);
  const [ghost, setGhost] = useState("");
  const [quotaRefresh, setQuotaRefresh] = useState(0);
  // The server's count of what is left today. When the next message would be refused, the composer says so and waits for the reset.
  const { allowance, now: allowanceNow } = useAiAllowance(quotaRefresh + (streaming ? 1 : 0) + attachments.filter((a) => a.status === "ready").length);
  const blocked = allowance?.blocked ?? null;
  const ghostTimerRef = useRef<number | undefined>(undefined);
  const ghostAbortRef = useRef<AbortController | null>(null);
  // The Kreto model and effort for the next message (remembered on this device), what answered the last one, and a
  // request the server wanted to ask about first (nothing was counted or saved for it).
  const [choice, setChoiceState] = useState<KretoChoice>(readKretoChoice);
  const [lastRoute, setLastRoute] = useState<KretoRouteInfo | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; draft: string; effort: KretoEffort } | null>(null);
  // What Kreto can see for the next messages, and whether it uses memory (remembered on this device).
  const [contextChoice, setContextChoiceState] = useState<KretoContextChoice>(readContextChoice);
  const setContextChoice = useCallback((next: KretoContextChoice) => {
    setContextChoiceState(next);
    writeContextChoice(next);
  }, []);
  const setChoice = useCallback((next: KretoChoice) => {
    setChoiceState(next);
    writeKretoChoice(next);
    setPendingConfirm(null);
  }, []);
  // The deepest tier (Kreto Oracle) is on for admins and Premium accounts for now; the server decides either way.
  const { isAdmin } = useUserRole();
  const { subscriptionInfo } = useAuth();
  const deepTier = isAdmin || (subscriptionInfo.subscribed && subscriptionInfo.tier !== "free");
  const tokensLeft = allowance?.tokens?.left ?? null;
  // A rough "about N% of what's left today" for the draft; the server's own estimate decides whether to ask.
  const preview = useMemo(
    () => (blocked || !input.trim() ? null : previewShare({ draft: input, history: messages, effort: choice.effort, tokensLeft })),
    [blocked, input, messages, choice.effort, tokensLeft],
  );

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Load (or clear) messages whenever the active conversation changes — a
  // draft (null) starts empty; a real id rehydrates its persisted history.
  // The server already saves every turn to ai_messages; this just asks for
  // it back, so switching conversations (or refreshing the page) never
  // silently loses the visible thread.
  useEffect(() => {
    let cancelled = false;
    if (conversationId && conversationId === createdHereRef.current) {
      // We created this one ourselves a moment ago; what's on screen is the truth.
      setHistoryLoaded(true);
      return;
    }
    followRef.current = true;
    setMessages([]);
    setHistoryLoaded(false);
    if (!conversationId) {
      setHistoryLoaded(true);
      return;
    }
    loadConversationMessages(conversationId)
      .then((rows) => {
        if (cancelled) return;
        setMessages(rows);
      })
      .catch((e) => console.error("InlineKretoChat history load failed:", e))
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => { cancelled = true; };
  }, [conversationId]);

  // Keep the newest text in view only while the reader is following along, and do it on the
  // thread itself (scrollIntoView would also scroll the whole page) and without easing (a
  // smooth scroll restarted on every token lags behind the text and reads as jitter).
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (el && followRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onThreadScroll = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    const following = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX;
    followRef.current = following;
    setShowLatest((prev) => (prev === !following ? prev : !following));
  }, []);

  const jumpToLatest = () => {
    const el = threadRef.current;
    if (!el) return;
    followRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  };

  // `confirmed`: the person accepted the estimate the server asked about. `effort`: this send only (Use Quick).
  const send = useCallback(async (raw: string, opts: { confirmed?: boolean; effort?: KretoEffort } = {}) => {
    const text = raw.trim();
    if (!text || streaming) return;
    setPendingConfirm(null);
    const effort = opts.effort ?? choice.effort;

    // A new send aborts any in-flight request and any pending autocomplete.
    abortRef.current?.abort();
    ghostAbortRef.current?.abort();
    window.clearTimeout(ghostTimerRef.current);
    setGhost("");
    setLastError(null);

    // Navigation needs neither a model call nor a persisted conversation.
    // Attachment-bearing requests remain on the normal grounded chat path.
    const instant = attachments.length === 0 ? matchKretoRoute(text) : null;
    if (instant) {
      setInput("");
      setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: instant.reply }]);
      navigate(instant.path);
      return;
    }

    // Navigation above needs no model; everything below does, and the server would refuse it. Say so here rather than send it.
    if (blocked) return;

    // Only fully parsed attachments travel with the message — a failed one
    // keeps its chip (with retry) and never blocks sending the text.
    const readyAttachments = attachments
      .flatMap(a => a.status === "ready" && a.text && a.referenceId ? [{ id: a.referenceId, name: a.name, text: a.text, expires_at: a.expires_at }] : []);

    setInput("");
    followRef.current = true;
    // A local id for this reply, so its approval cards and notes find it after later messages arrive.
    const liveId = `live-${++liveSeqRef.current}`;
    setMessages((m) => [...m, { role: "user", content: text, attachments: readyAttachments }, { role: "assistant", content: "", id: liveId }]);
    setStreaming(true);

    // A draft conversation doesn't exist server-side until the first
    // message actually sends — this keeps "New conversation" from littering
    // the list with abandoned empty rows if the user changes their mind.
    let activeId = conversationIdRef.current;
    if (!activeId) {
      activeId = await createConversation();
      if (activeId) {
        conversationIdRef.current = activeId;
        createdHereRef.current = activeId;
        onConversationCreated?.(activeId);
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Strip <action>/<plan> tags live so raw JSON/XML never renders in the
    // bubble, even mid-stream — matches ThriveAgentFab's stripTagsLive.
    let assistantSoFar = "";
    // The server asked first: the optimistic bubbles are gone and nothing should be painted into an earlier reply.
    let asked = false;
    // Chunks can arrive far faster than a screen can show them. Collect them and paint at most
    // once per frame; the final flush below guarantees the full text lands even if the tab
    // was in the background (animation frames pause there).
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (asked) return;
      const visible = stripTagsLive(assistantSoFar);
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last?.role !== "assistant" || last.content === visible) return m;
        const next = m.slice();
        next[next.length - 1] = { ...last, content: visible };
        return next;
      });
    };
    const appendDelta = (delta: string) => {
      assistantSoFar += delta;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const flushNow = () => {
      if (frame) cancelAnimationFrame(frame);
      flush();
    };

    try {
      await streamCopilot({
        messages: [{ role: "user", content: text }],
        surface: "home",
        conversationId: activeId ?? undefined,
        attachments: readyAttachments,
        profile: choice.profile,
        effort,
        confirmSupported: true,
        confirmEstimate: opts.confirmed === true,
        context: contextChoice.context,
        memory: contextChoice.memory,
        onRoute: (route) => {
          setLastRoute(route);
          const label = `${kretoModelName(route.profile)} · ${kretoEffortLabel(route.effort)}`;
          const sources = sourcesLabel(route.sources) ?? undefined;
          setMessages((m) => {
            const last = m[m.length - 1];
            if (last?.role !== "assistant") return m;
            const next = m.slice();
            next[next.length - 1] = { ...last, kreto: label, sources };
            return next;
          });
        },
        onNeedsConfirm: (request) => {
          // Not an error and not sent: take the draft back and ask, with the server's own estimate.
          asked = true;
          setMessages((m) => {
            const last = m[m.length - 1];
            const prev = m[m.length - 2];
            return last?.role === "assistant" && !last.content && prev?.role === "user" ? m.slice(0, -2) : m;
          });
          setInput(text);
          setPendingConfirm({ message: request.message, draft: text, effort });
        },
        onConversationId: (id) => { conversationIdRef.current = id; },
        onDelta: appendDelta,
        onDone: () => {
          // Sent and answered — the attachments' job is done.
          if (readyAttachments.length) {
            setAttachments((list) => list.filter((a) => a.status !== "ready"));
          }
        },
        onError: (err) => {
          if (controller.signal.aborted) return; // the user pressed Stop; that is not an error
          // A failed call never clears the draft: restore the text, show the
          // real error, and offer a retry.
          setInput(text);
          setLastError({ message: err, draft: text });
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === "assistant" && !last.content) next[next.length - 1] = { ...last, content: err };
            return next;
          });
        },
        signal: controller.signal,
      });
      flushNow();

      // The reply proposed actions (tags were stripped from the visible text above). Each goes to the orchestrator, which
      // applies the tool policy: what needs approval comes back as a card under this reply; anything that ran, failed or
      // is not allowed comes back as a plain note. Nothing is claimed that the server did not report.
      const { actions, plans } = extractActions(assistantSoFar);
      if (actions.length > 0 || plans.length > 0) {
        const patch = (fn: (msg: CopilotMessage) => CopilotMessage) => setMessages((m) => m.map((msg) => (msg.id === liveId ? fn(msg) : msg)));
        patch((msg) => ({ ...msg, preparing: actions.length, notes: plans.length ? [...(msg.notes ?? []), PLAN_NOTE] : msg.notes }));
        for (const parsed of actions) {
          let proposed: OrchAction[] = [];
          let notes: KretoActionNote[] = [];
          try {
            const run = await sendAgentIntent(parsed.intent, { surface: parsed.surface ?? "home" });
            proposed = (run.actions ?? []).filter((a) => a.status === "proposed");
            notes = (run.actions ?? []).map(actionNote).filter((n): n is KretoActionNote => Boolean(n));
            if (!run.actions?.length) notes.push({ tone: "info", title: "I looked, but there was nothing for me to do there." });
          } catch (err) {
            const reason = err instanceof Error && err.message ? err.message.replace(/\.$/, "") : "Try again";
            notes = [{ tone: "failed", title: "I couldn't set that up", detail: `${reason}.` }];
          }
          patch((msg) => ({
            ...msg,
            preparing: Math.max(0, (msg.preparing ?? 1) - 1),
            actions: [...(msg.actions ?? []), ...proposed],
            notes: [...(msg.notes ?? []), ...notes],
          }));
        }
      }
    } catch (e) {
      flushNow();
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (!aborted) {
        console.error("InlineKretoChat stream failed:", e);
        // Same contract as onError: keep the draft, show the error, offer retry.
        setInput(text);
        setLastError({ message: "Something went wrong on my end. Try again?", draft: text });
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.content) {
            next[next.length - 1] = { ...last, content: "Something went wrong on my end. Try again?" };
          }
          return next;
        });
      }
    } finally {
      setQuotaRefresh((k) => k + 1);
      if (frame) cancelAnimationFrame(frame);
      // Stopped before a single token arrived: drop the empty "thinking" bubble instead of
      // leaving it spinning forever.
      if (controller.signal.aborted) {
        setMessages((m) => {
          const last = m[m.length - 1];
          return last?.role === "assistant" && !last.content ? m.slice(0, -1) : m;
        });
      }
      setStreaming(false);
    }
  }, [streaming, conversationId, onConversationCreated, attachments, navigate, blocked, choice, contextChoice]);

  // A quick-action click seeds the thread and sends immediately. Keyed on
  // seedNonce (not seedPrompt itself) so clicking the same quick action
  // twice in a row still re-sends — the string value alone wouldn't change.
  useEffect(() => {
    if (seedPrompt && seedNonce) send(seedPrompt).catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedNonce]);

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  // Ghost-text autocomplete: 250ms debounce, 2s hard timeout, cancelled on
  // every keystroke, never under 4 characters, silent on any failure.
  const onInputChange = (value: string) => {
    setInput(value);
    // The question was about the draft as it was; an edited draft gets a fresh estimate when it is sent.
    setPendingConfirm(null);
    ghostAbortRef.current?.abort();
    window.clearTimeout(ghostTimerRef.current);
    setGhost("");
    if (streaming || value.trim().length < 4) return;
    ghostTimerRef.current = window.setTimeout(() => {
      const ctrl = new AbortController();
      ghostAbortRef.current = ctrl;
      const hardTimeout = window.setTimeout(() => ctrl.abort(), 2000);
      autocompleteKreto(value, ctrl.signal)
        .then((suggestion) => {
          window.clearTimeout(hardTimeout);
          if (ctrl.signal.aborted || !suggestion) return;
          setGhost(value.endsWith(" ") || suggestion.startsWith(" ") ? suggestion : ` ${suggestion}`);
        })
        .catch(() => {});
    }, 250);
  };

  const acceptGhost = (): boolean => {
    if (!ghost) return false;
    setInput((v) => v + ghost);
    setGhost("");
    return true;
  };

  return (
    // One fixed height from the first paint to the last token: the thread scrolls inside the
    // card, so streaming text can never push the page (or the cards below it) around. The
    // height comes from KretoTab (--kreto-h) so the history rail can match it.
    <div className="flex h-[var(--kreto-h,32rem)] flex-col overflow-hidden rounded-2xl border border-[hsl(var(--energy)/0.3)] bg-card text-card-foreground">
      <div className="relative min-h-0 flex-1">
        <div
          ref={threadRef}
          onScroll={onThreadScroll}
          role="log"
          aria-label={`Conversation with ${BRAND.agentName}`}
          aria-busy={streaming}
          className="h-full space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {!historyLoaded && messages.length === 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <KretopiaSpinner className="h-3 w-3" /> Loading your conversation…
            </div>
          ) : messages.length === 0 ? (
            emptyState ?? (
              <p className="py-6 text-center text-sm text-muted-foreground">Ask {BRAND.agentName} anything to get started.</p>
            )
          ) : (
            messages.map((m, i) => <MessageBubble key={m.id ?? i} {...m} onActionResolved={onActionResolved} />)
          )}
        </div>

        {showLatest && messages.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="btn-glass btn-glass-outline absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden /> Latest
          </button>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border px-3 pb-2.5 pt-2.5">
        {/* What needs a decision comes first: a failed send to retry, or a big request to confirm. */}
        {lastError && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">That didn't go through. Your draft is back in the composer.</p>
            <button
              type="button"
              onClick={() => send(lastError.draft).catch((err) => console.error(err))}
              className="btn-glass btn-glass-outline rounded-full px-3 py-1 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {pendingConfirm && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2" data-testid="kreto-confirm">
            <p className="text-xs text-foreground">{pendingConfirm.message}</p>
            <div className="flex items-center gap-2">
              {pendingConfirm.effort > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const draft = pendingConfirm.draft;
                    setChoice({ ...choice, effort: 1 });
                    send(draft, { effort: 1 }).catch((err) => console.error(err));
                  }}
                  className="btn-glass btn-glass-outline rounded-full px-3 py-1 text-xs font-semibold"
                >
                  Use Quick
                </button>
              )}
              <button
                type="button"
                onClick={() => send(pendingConfirm.draft, { confirmed: true, effort: pendingConfirm.effort }).catch((err) => console.error(err))}
                className="btn-glass btn-glass-primary rounded-full px-3 py-1 text-xs font-semibold"
              >
                Run it
              </button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(input).catch((err) => console.error(err)); }}>
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Tab" || (e.key === "ArrowRight" && e.currentTarget.selectionStart === input.length)) && acceptGhost()) {
                  e.preventDefault();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input).catch((err) => console.error(err));
                }
              }}
              rows={1}
              placeholder={blocked ? `${BRAND.agentName} is paused until the allowance resets` : `Ask ${BRAND.agentName} anything…`}
              aria-describedby={blocked ? KRETO_ALLOWANCE_NOTICE_ID : undefined}
              className="relative z-10 max-h-32 w-full resize-none bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {ghost && (
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre py-1.5 text-sm">
                <span className="invisible">{input}</span>
                <span className="text-muted-foreground/70">{ghost}</span>
                <span className="ml-1 rounded border border-border px-1 text-[9px] uppercase tracking-wider text-muted-foreground">Tab</span>
              </div>
            )}
          </div>

          {/* One quiet control row: what to attach, which Kreto, what it may see, then the cost and Send. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <KretoComposerAttach attachments={attachments} onChange={setAttachments} disabled={streaming} />
            <KretoModelPicker choice={choice} onChange={setChoice} disabled={streaming} deepTier={deepTier} />
            <KretoContextPicker choice={contextChoice} onChange={setContextChoice} disabled={streaming} />
            <KretoSettings
              disabled={streaming}
              onResetDefaults={() => {
                setChoice(DEFAULT_KRETO_CHOICE);
                setContextChoice(DEFAULT_CONTEXT_CHOICE);
              }}
            />
            <div className="ml-auto flex items-center gap-2">
              {preview !== null && (
                <span className="text-[11px] text-muted-foreground" data-testid="kreto-estimate">
                  About {sharePctLabel(preview)} of today
                </span>
              )}
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground"
                  aria-label="Stop"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || !!blocked}
                  aria-describedby={blocked ? KRETO_ALLOWANCE_NOTICE_ID : undefined}
                  className="btn-glass btn-glass-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        <KretoRouteHints choice={choice} onChange={setChoice} lastRoute={lastRoute} />
        <KretoQuotaIndicator allowance={allowance} now={allowanceNow} />
      </div>
    </div>
  );
}

export default InlineKretoChat;
