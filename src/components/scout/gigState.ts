import type { ScoutActionRow } from "./scout.types";

/**
 * Where a gig stands for this person, from what they actually did with it.
 *
 * Every state is a statement about the person's own action, never about the
 * employer or the board: Scout has no receipt from any source and cannot see
 * an application land, so nothing here says "submitted", "sent" or "accepted".
 * "Applied" and the outcomes are what the person themselves marked.
 */
export type GigStateId = "saved" | "preparing" | "handed_off" | "marked_applied" | "marked_won" | "marked_lost" | "no_reply";

export interface GigState {
  id: GigStateId;
  label: string;
  /** What the state means, in the person's terms. */
  hint: string;
}

const STATES: Record<GigStateId, GigState> = {
  saved: { id: "saved", label: "Saved", hint: "In your shortlist" },
  preparing: { id: "preparing", label: "Preparing", hint: "You drafted a cover letter" },
  handed_off: { id: "handed_off", label: "Handed off", hint: "You opened the application on the source" },
  marked_applied: { id: "marked_applied", label: "Marked applied", hint: "You marked it applied. Scout has no receipt." },
  marked_won: { id: "marked_won", label: "Marked won", hint: "You marked this one booked" },
  marked_lost: { id: "marked_lost", label: "Marked lost", hint: "You marked this one lost" },
  no_reply: { id: "no_reply", label: "No reply", hint: "You marked it as never answered" },
};

/** The state for one gig from that gig's own actions, or null when the person did nothing with it. */
export function gigStateFor(actions: ScoutActionRow[]): GigState | null {
  const applied = actions.find((a) => a.action === "applied");
  if (applied) {
    if (applied.outcome === "won") return STATES.marked_won;
    if (applied.outcome === "lost") return STATES.marked_lost;
    if (applied.outcome === "ghosted") return STATES.no_reply;
    return STATES.marked_applied;
  }
  if (actions.some((a) => a.action === "apply_clicked")) return STATES.handed_off;
  if (actions.some((a) => a.action === "drafted")) return STATES.preparing;
  if (actions.some((a) => a.action === "saved")) return STATES.saved;
  return null;
}

/** A state per gig id, for the gigs the person has done something with. */
export function gigStatesById(actions: ScoutActionRow[]): Map<string, GigState> {
  const byGig = new Map<string, ScoutActionRow[]>();
  for (const a of actions) {
    const list = byGig.get(a.scouted_gig_id);
    if (list) list.push(a);
    else byGig.set(a.scouted_gig_id, [a]);
  }
  const out = new Map<string, GigState>();
  for (const [id, list] of byGig) {
    const state = gigStateFor(list);
    if (state) out.set(id, state);
  }
  return out;
}
