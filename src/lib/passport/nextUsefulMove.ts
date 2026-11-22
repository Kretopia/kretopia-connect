// One deterministic "next useful move" for the owner's Passport, from real state only (no model call, no score):
//   usable Passport -> genuine proof (a credit) -> ask a collaborator to confirm it -> see the confirmation.
// The three steps people see are Passport Live, First Proof and Co-Signed. They are derived from the record each time and are
// NOT awards: nothing is stored, granted or shown publicly here. A sent request is not "Co-Signed"; only an accepted
// confirmation from the person asked is. Authenticated confirmation is not independent verification of talent.

export interface MoveInput {
  profile: { full_name?: string | null; role?: string | null; bio?: string | null } | null;
  /** The owner's credits (portfolio items excluded by the caller). */
  creditCount: number;
  /** States of the co-sign requests the owner sent (credit_endorsements.status). */
  cosignStates: readonly string[];
}

export type MilestoneId = "passport_live" | "first_proof" | "co_signed";
export type MoveId = "finish_passport" | "add_proof" | "request_cosign" | "await_cosign" | "view_confirmation";

export interface Move {
  id: MoveId;
  label: string;
  why: string;
  to: string;
  /** The person takes the step themselves; external actions (asking someone) only happen on the page this opens. */
  cta: string;
}

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;

/** Usable Passport: a name, a role and a short bio, enough for someone to understand who this is. */
export const passportUsable = (p: MoveInput["profile"]) => !!p && filled(p.full_name) && filled(p.role) && filled(p.bio);

export function milestones(input: MoveInput): Record<MilestoneId, boolean> {
  return {
    passport_live: passportUsable(input.profile),
    first_proof: input.creditCount > 0,
    co_signed: input.cosignStates.includes("accepted"),
  };
}

const MOVES: Record<MoveId, Move> = {
  finish_passport: { id: "finish_passport", label: "Finish your Passport basics", why: "Your name, role and a short bio make your Passport usable.", to: "/profile?edit=true", cta: "Edit Passport" },
  add_proof: { id: "add_proof", label: "Add your first credit", why: "A credit is proof of work you did. Add it by hand or from a link.", to: "/profile?add=credit", cta: "Add credit" },
  request_cosign: { id: "request_cosign", label: "Ask a collaborator to confirm a credit", why: "Someone who worked with you confirms it. You choose who, and nothing is sent until you do.", to: "/credits?action=co_sign", cta: "Choose a credit" },
  await_cosign: { id: "await_cosign", label: "Your co-sign request is waiting", why: "You'll be notified when they answer. You can remind them or ask someone else.", to: "/credits?action=co_sign", cta: "See request" },
  view_confirmation: { id: "view_confirmation", label: "A collaborator confirmed your credit", why: "Their confirmation now shows on that credit.", to: "/credits", cta: "View credit" },
};

/**
 * The single next move, or null when there is nothing useful to suggest. `hidden` holds moves the person put aside ("Later" or
 * "Not relevant"): a hidden move is skipped, never replaced by a louder one, and later steps are not offered before earlier ones.
 */
export function nextUsefulMove(input: MoveInput, hidden: ReadonlySet<MoveId> = new Set()): Move | null {
  const m = milestones(input);
  const pick = (id: MoveId) => (hidden.has(id) ? null : MOVES[id]);
  if (!m.passport_live) return pick("finish_passport");
  if (!m.first_proof) return pick("add_proof");
  if (m.co_signed) return pick("view_confirmation");
  if (input.cosignStates.includes("pending")) return pick("await_cosign");
  return pick("request_cosign");
}

/** "Later" hides a move for a week, "Not relevant" until the person's state changes past it. Per viewer, in this browser. */
export const LATER_MS = 7 * 86_400_000;
export type HiddenMoves = Partial<Record<MoveId, { until: number | null }>>;

export function activeHidden(hidden: HiddenMoves, now = Date.now()): Set<MoveId> {
  return new Set(
    (Object.entries(hidden) as Array<[MoveId, { until: number | null } | undefined]>)
      .filter(([, v]) => v && (v.until === null || v.until > now))
      .map(([k]) => k),
  );
}
