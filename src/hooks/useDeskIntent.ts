import { useEffect } from "react";

/**
 * Central listener for "thrivedesk:intent" window events.
 * Tab components subscribe with the tab id + intent string they care about.
 *
 * Pending queue: dispatchers can fire BEFORE the target tab mounts (common
 * when we switch tabs and immediately dispatch). The intent is buffered and
 * flushed when the matching listener mounts, so we never lose the action to
 * a race condition.
 */
export interface DeskIntentDetail {
  tab: string;
  intent: string;
  payload?: Record<string, any>;
}

const pending = new Map<string, DeskIntentDetail>();
const PENDING_TTL_MS = 8000;

export function useDeskIntent(
  tab: string,
  handler: (intent: string, payload?: Record<string, any>) => void
) {
  useEffect(() => {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent<DeskIntentDetail>).detail;
      if (!detail || detail.tab !== tab) return;
      handler(detail.intent, detail.payload);
    };
    window.addEventListener("thrivedesk:intent", listener);

    // Flush any pending intents queued for this tab before we mounted.
    for (const [key, detail] of pending.entries()) {
      if (detail.tab !== tab) continue;
      pending.delete(key);
      setTimeout(() => handler(detail.intent, detail.payload), 0);
    }

    return () => window.removeEventListener("thrivedesk:intent", listener);
  }, [tab, handler]);
}

/** Helper to dispatch an intent from anywhere (chat, AI, empty states, etc.) */
export function dispatchDeskIntent(tab: string, intent: string, payload?: Record<string, any>) {
  const detail: DeskIntentDetail = { tab, intent, payload };
  const key = `${tab}|${intent}`;
  pending.set(key, detail);
  setTimeout(() => pending.delete(key), PENDING_TTL_MS);
  window.dispatchEvent(
    new CustomEvent<DeskIntentDetail>("thrivedesk:intent", { detail }),
  );
}

/** Shortcut to navigate to a tab (used from chat/notes for cross-tab CTAs). */
export function navigateDeskTab(tab: string) {
  window.dispatchEvent(new CustomEvent("thrivedesk:set-tab", { detail: tab }));
}
