// Thrive Copilot — unified chat client.
// Talks to the upgraded `thrive-ai-chat` edge function with surface awareness
// + cross-surface persisted memory. Used by ThriveAgentFab everywhere.
//
// The edge function persists turns server-side when persist=true, so the
// client only needs to send the latest user message — server hydrates the
// rest from ai_messages.

import { supabase } from "@/integrations/supabase/client";

export type CopilotSurface =
  | "desk"
  | "pay"
  | "match"
  | "gigs"
  | "home"
  | "profile"
  | "credit"
  | "event";

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/thrive-ai-chat`;

interface StreamCopilotArgs {
  /** Latest turn(s) the client wants the model to see. Server hydrates prior history. */
  messages: CopilotMessage[];
  surface: CopilotSurface;
  surfaceContext?: Record<string, unknown>;
  /** Pin to a specific thread; omit to use the user's canonical Thrive Copilot thread. */
  conversationId?: string;
  onDelta: (text: string) => void;
  onConversationId?: (id: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream a Copilot reply. Server persists both the user's latest message
 * AND the assistant's full reply to ai_messages — so the next call from
 * any other surface picks up the conversation seamlessly.
 */
export async function streamCopilot({
  messages,
  surface,
  surfaceContext,
  conversationId,
  onDelta,
  onConversationId,
  onDone,
  onError,
  signal,
}: StreamCopilotArgs) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    onError("Please sign in to chat with Kreto.");
    return;
  }

  let resp: Response;
  try {
    resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        surface,
        surface_context: surfaceContext,
        conversation_id: conversationId,
        persist: true,
      }),
      signal,
    });
  } catch (e) {
    onError(e instanceof Error ? e.message : "Network error");
    return;
  }

  // Bump daily Copilot streak (fire-and-forget)
  supabase.rpc("bump_streak", { _streak_type: "copilot" }).then(() => {}, () => {});

  // Capture the canonical thread id from response headers
  const returnedConvId = resp.headers.get("X-Copilot-Conversation-Id");
  if (returnedConvId && onConversationId) onConversationId(returnedConvId);

  if (!resp.ok) {
    const data: any = await resp.json().catch(() => ({}));
    if (resp.status === 429 && data?.code === "COPILOT_DAILY_LIMIT") {
      onError(`You've used ${data.used}/${data.cap} Copilot messages today. Upgrade your plan for more — resets at midnight UTC.`);
    } else if (resp.status === 429) {
      onError("Slow down a sec — too many requests. Try again in a moment.");
    } else if (resp.status === 402) {
      onError("Out of Copilot credits this month. Top up in Settings → Workspace → Usage.");
    } else {
      onError(data?.error || `Request failed (${resp.status})`);
    }
    return;
  }
  if (!resp.body) {
    onError("No response stream");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        streamDone = true;
        break;
      }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (c) onDelta(c);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  onDone();
}

// ---------------------------------------------------------------------
// Kreto conversation sessions — list/create/rename/archive/delete, and
// load a SPECIFIC conversation's messages (as opposed to loadCopilotHistory
// below, which always resolves the one hidden cross-surface '__copilot__'
// thread ThriveAgentFab uses). These are additive; nothing above is
// changed, so ThriveAgentFab's existing single-thread behavior is
// untouched.
//
// ai_conversations/ai_messages RLS (20260211172225) already scopes every
// row to auth.uid() = user_id for SELECT/INSERT/UPDATE/DELETE, so all of
// these are safe as plain client-side queries — no RPC needed.
// ---------------------------------------------------------------------

export interface CopilotConversationSummary {
  id: string;
  title: string;
  updated_at: string;
  /** True for the one hidden cross-surface thread ThriveAgentFab also
   *  writes to — pinned first, not renamable/archivable/deletable here so
   *  renaming it can't silently fork history between this page and the
   *  global Copilot (which looks it up by the exact title '__copilot__'). */
  isPrimary: boolean;
}

const PRIMARY_THREAD_TITLE = "__copilot__";
const PRIMARY_THREAD_LABEL = "Kreto (main)";

export async function listConversations(): Promise<CopilotConversationSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];

  const mapped = data.map((c: { id: string; title: string; updated_at: string }) => ({
    id: c.id,
    title: c.title === PRIMARY_THREAD_TITLE ? PRIMARY_THREAD_LABEL : c.title,
    updated_at: c.updated_at,
    isPrimary: c.title === PRIMARY_THREAD_TITLE,
  }));
  // Pin the shared cross-surface thread first; everything else stays in the
  // already-fetched updated_at desc order.
  mapped.sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
  return mapped;
}

/** Create a new, empty conversation. Call this lazily — only once the user
 *  actually sends a first message — so navigating to "New conversation"
 *  and changing your mind never leaves an abandoned empty row behind. */
export async function createConversation(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: user.id })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id;
}

export async function renameConversation(conversationId: string, title: string): Promise<boolean> {
  const trimmed = title.trim().slice(0, 120);
  if (!trimmed) return false;
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: trimmed })
    .eq("id", conversationId);
  return !error;
}

export async function archiveConversation(conversationId: string): Promise<boolean> {
  // archived_at isn't in the generated types yet — it ships in
  // 20260905130000_kreto_conversation_sessions.sql, applied alongside this
  // feature; types.ts regenerates once that migration runs.
  const { error } = await supabase
    .from("ai_conversations")
    .update({ archived_at: new Date().toISOString() } as never)
    .eq("id", conversationId);
  return !error;
}

/** Deletes the conversation and, via ON DELETE CASCADE, every message in it. */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId);
  return !error;
}

/** Load a specific conversation's messages (any conversation the caller owns —
 *  RLS enforces that), most-recent 60 turns, chronological order. */
export async function loadConversationMessages(conversationId: string): Promise<CopilotMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !data) return [];
  return [...data].reverse().map((r: { role: string; content: string }) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
  }));
}

/** Load the canonical Copilot thread's messages so a fresh open shows full history. */
export async function loadCopilotHistory(): Promise<CopilotMessage[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: convo } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("title", "__copilot__")
    .maybeSingle();
  if (!convo?.id) return [];

  const { data: rows } = await supabase
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", convo.id)
    .order("created_at", { ascending: false })
    .limit(60);
  return [...(rows ?? [])].reverse().map((r: { role: string; content: string }) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
  }));
}

/** Best-effort surface inference from current pathname. */
export function inferSurface(pathname: string): CopilotSurface {
  if (pathname.startsWith("/desk")) return "desk";
  if (pathname.startsWith("/thrivepay") || pathname.startsWith("/pay") || pathname.startsWith("/accounting")) return "pay";
  if (pathname.startsWith("/circle") || pathname.startsWith("/match")) return "match";
  if (pathname.startsWith("/opportunities") || pathname.startsWith("/gigs")) return "gigs";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/event") || pathname.startsWith("/sessions")) return "event";
  if (pathname.startsWith("/credits") || pathname.startsWith("/icdb")) return "credit";
  return "home";
}

export const SURFACE_LABEL: Record<CopilotSurface, string> = {
  desk: "Studios",
  pay: "ThrivePay",
  match: "Match",
  gigs: "Gigs",
  home: "Home",
  profile: "Profile",
  credit: "Credits",
  event: "Events",
};

/**
 * Pull <action>{...}</action> and <plan>{...}</plan> tags out of an assistant message.
 * Returns the cleaned visible text + parsed action/plan payloads.
 */
const ACTION_TAG_RE = /<action>\s*([\s\S]*?)\s*<\/action>/g;
const PLAN_TAG_RE = /<plan>\s*([\s\S]*?)\s*<\/plan>/g;

export interface ParsedAction {
  intent: string;
  surface?: string;
  [k: string]: unknown;
}

export interface ParsedPlan {
  goal: string;
  surface?: string;
}

export function extractActions(raw: string): {
  visible: string;
  actions: ParsedAction[];
  plans: ParsedPlan[];
} {
  const actions: ParsedAction[] = [];
  const plans: ParsedPlan[] = [];
  let visible = raw
    .replace(ACTION_TAG_RE, (_, json) => {
      try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed.intent === "string") actions.push(parsed);
      } catch { /* ignore */ }
      return "";
    })
    .replace(PLAN_TAG_RE, (_, json) => {
      try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed.goal === "string") plans.push(parsed);
      } catch { /* ignore */ }
      return "";
    });
  visible = visible.replace(/\n{3,}/g, "\n\n").trim();
  return { visible, actions, plans };
}
