import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Square } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { BRAND } from "@/lib/brandLexicon";
import {
  streamCopilot, loadConversationMessages, createConversation, extractActions, autocompleteKreto,
  type CopilotMessage,
} from "@/lib/thriveCopilot";
import { KretoComposerAttach, type ComposerAttachment } from "@/components/kreto/KretoComposerAttach";
import { KretoQuotaIndicator } from "@/components/kreto/KretoQuotaIndicator";

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

// Memoised so a streamed token re-renders only the bubble that changed, not the whole thread.
const MessageBubble = memo(function MessageBubble({ role, content }: CopilotMessage) {
  return (
    <div
      className={
        role === "user"
          ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[hsl(var(--energy)/0.15)] border border-[hsl(var(--energy)/0.25)] px-3.5 py-2 text-sm text-white break-words"
          : "mr-auto max-w-[92%] rounded-2xl rounded-bl-sm bg-white/[0.05] border border-white/10 px-3.5 py-2 text-sm text-white/90 whitespace-pre-wrap break-words"
      }
    >
      {content || (
        <span className="inline-flex h-5 items-center gap-1.5 text-white/50">
          <KretopiaSpinner className="h-3 w-3" /> {BRAND.agentName} is thinking…
        </span>
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
  const ghostTimerRef = useRef<number | undefined>(undefined);
  const ghostAbortRef = useRef<AbortController | null>(null);

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

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming) return;

    // A new send aborts any in-flight request and any pending autocomplete.
    abortRef.current?.abort();
    ghostAbortRef.current?.abort();
    window.clearTimeout(ghostTimerRef.current);
    setGhost("");
    setLastError(null);

    // Only fully parsed attachments travel with the message — a failed one
    // keeps its chip (with retry) and never blocks sending the text.
    const readyAttachments = attachments
      .filter((a) => a.status === "ready" && a.text)
      .map((a) => ({ name: a.name, text: a.text! }));

    setInput("");
    followRef.current = true;
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
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
    // Chunks can arrive far faster than a screen can show them. Collect them and paint at most
    // once per frame; the final flush below guarantees the full text lands even if the tab
    // was in the background (animation frames pause there).
    let frame = 0;
    const flush = () => {
      frame = 0;
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
        onConversationId: (id) => { conversationIdRef.current = id; },
        onDelta: appendDelta,
        onDone: () => {},
        onError: (err) => {
          if (controller.signal.aborted) return; // the user pressed Stop; that is not an error
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

      // The model proposed an action/plan (tags were stripped from the
      // visible text above). This page has no approval-card UI yet — never
      // pretend the action happened; point the user at the surface that
      // actually can execute and approve it.
      const { actions, plans } = extractActions(assistantSoFar);
      if (actions.length > 0 || plans.length > 0) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: "I've got a suggested action ready — open Kreto from the bottom navigation to review and approve it.",
          },
        ]);
      }
    } catch (e) {
      flushNow();
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (!aborted) {
        console.error("InlineKretoChat stream failed:", e);
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
  }, [streaming, conversationId, onConversationCreated]);

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

  return (
    // One fixed height from the first paint to the last token: the thread scrolls inside the
    // card, so streaming text can never push the page (or the cards below it) around. The
    // height comes from KretoTab (--kreto-h) so the history rail can match it.
    <div className="flex h-[var(--kreto-h,32rem)] flex-col overflow-hidden rounded-2xl border border-[hsl(var(--energy)/0.3)] bg-white/[0.03] backdrop-blur-sm">
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
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <KretopiaSpinner className="h-3 w-3" /> Loading your conversation…
            </div>
          ) : messages.length === 0 ? (
            emptyState ?? (
              <p className="py-6 text-center text-sm text-white/50">Ask {BRAND.agentName} anything to get started.</p>
            )
          ) : (
            messages.map((m, i) => <MessageBubble key={i} role={m.role} content={m.content} />)
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

      <form
        onSubmit={(e) => { e.preventDefault(); send(input).catch((err) => console.error(err)); }}
        className="flex shrink-0 items-end gap-2 border-t border-white/10 bg-white/[0.02] p-3"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input).catch((err) => console.error(err));
            }
          }}
          rows={1}
          placeholder={`Ask ${BRAND.agentName} anything…`}
          className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/40 outline-none py-2 max-h-32"
        />
        {streaming ? (
          <button
            type="button"
            onClick={stop}
            className="h-9 w-9 shrink-0 rounded-full bg-white/10 text-white flex items-center justify-center"
            aria-label="Stop"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-glass btn-glass-primary h-9 w-9 shrink-0 rounded-full text-white flex items-center justify-center disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}

export default InlineKretoChat;
