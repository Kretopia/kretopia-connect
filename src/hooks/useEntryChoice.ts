import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionState } from "@/hooks/useSessionState";
import { AUTH_WAIT_MS, entryChoiceKey, type EntryChoice } from "@/lib/entryChoice";

/**
 * Whether a join link / invitation must open on the sign-in-or-guest choice. `target` names the entry (a meeting, a call link, an
 * invitation), so a choice made for one is never reused for another.
 *
 * - `pending`: the account question is not settled yet; render a spinner, not the choice (a signed-in person must never see it flash).
 * - `needsChoice`: nobody is signed in and nothing was chosen: render the choice, before any other UI.
 * - `isGuest`: the person chose to continue as a guest in this session.
 *
 * The choice screen needs no session: if the account check takes longer than AUTH_WAIT_MS it is shown anyway.
 */
export function useEntryChoice(target: string) {
  const { user, loading } = useAuth();
  const [choice, setChoice] = useSessionState<EntryChoice | null>(entryChoiceKey(target), null);
  const [waitedLong, setWaitedLong] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setWaitedLong(true), AUTH_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const settled = !loading || waitedLong;
  return {
    user,
    pending: !settled,
    needsChoice: settled && !user && choice === null,
    isGuest: !user && choice === "guest",
    continueAsGuest: () => setChoice("guest"),
  };
}
