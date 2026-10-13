// Pure, dependency-free decision for "may this caller attach a meeting to this
// Circle". Imported by edge functions (Deno) and by tests (Vite).
//
// Rule (code-only, no schema): the room must exist, and the caller must have
// created it or hold a spark_room_members row for it. A failed lookup is
// not "no": it answers 503 and grants nothing. Project context is decided by
// requireProjectAccess (_shared/projectAccess.ts), not here.
//
// Caveat recorded for the approver: joining a Circle is self-service today
// ("Users can join rooms"), so membership is the canonical record but not a
// strong boundary on its own. This gate makes the association provable; it
// does not make Circle membership itself restrictive.

export type ContextDecision =
  | { ok: true }
  | { ok: false; status: 403 | 503; error: string };

export interface CircleContextFacts {
  userId: string;
  /** The spark_rooms row was found. */
  roomFound: boolean;
  createdBy?: string | null;
  /** A spark_room_members row exists for this user and room. */
  isMember: boolean;
  /** Any lookup feeding this decision failed. */
  lookupFailed?: boolean;
}

export function decideCircleContext(f: CircleContextFacts): ContextDecision {
  if (f.lookupFailed) return { ok: false, status: 503, error: "Could not verify access to that Circle" };
  if (!f.roomFound) return { ok: false, status: 403, error: "You do not have access to that Circle" };
  if (f.createdBy && f.createdBy === f.userId) return { ok: true };
  if (f.isMember) return { ok: true };
  return { ok: false, status: 403, error: "You do not have access to that Circle" };
}
