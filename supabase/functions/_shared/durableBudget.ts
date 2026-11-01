// Client of the durable budgets (docs/security/phase5/manual-sql/A_durable_budgets): reserve BEFORE the limited or paid action,
// commit when it happened, release when it did not. Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Fail closed, by design: if the database cannot answer (the functions are not installed yet, an outage, a malformed answer) NOTHING
// is reserved and the caller must not run the action. There is no in-memory fallback: an isolate-local counter is not a limit.

interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

export type BudgetRequest = {
  /** What is limited and for whom, e.g. `invoice-mail:actor:<uuid>`. 1 to 200 characters. */
  bucket: string;
  /** Length of the fixed window, in seconds (a day is 86400). */
  windowSeconds: number;
  /** The limit of the window. The first call of a window fixes it. */
  limit: number;
  units?: number;
  /** A reservation not settled within this time is given back by the next reserver. */
  ttlSeconds?: number;
};

export type Reservation =
  | { ok: true; reservationId: string; used: number; reserved: number; remaining: number }
  | { ok: false; status: 429 | 503; reason: "exhausted" | "unavailable" };

const UNAVAILABLE: Reservation = { ok: false, status: 503, reason: "unavailable" };
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reserveBudget(db: RpcClient, req: BudgetRequest): Promise<Reservation> {
  try {
    const { data, error } = await db.rpc("reserve_budget", {
      p_bucket: req.bucket,
      p_window_seconds: req.windowSeconds,
      p_limit: req.limit,
      p_units: req.units ?? 1,
      p_ttl_seconds: req.ttlSeconds ?? 300,
    });
    if (error) return UNAVAILABLE; // including "the function does not exist yet"
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return UNAVAILABLE;
    const r = row as Record<string, unknown>;
    if (r.allowed === false) return { ok: false, status: 429, reason: "exhausted" };
    if (r.allowed !== true || typeof r.reservation_id !== "string" || !UUID_RE.test(r.reservation_id)) return UNAVAILABLE;
    if (!isCount(r.used) || !isCount(r.reserved) || !isCount(r.remaining)) return UNAVAILABLE;
    return { ok: true, reservationId: r.reservation_id, used: r.used, reserved: r.reserved, remaining: r.remaining };
  } catch {
    return UNAVAILABLE;
  }
}

async function settle(db: RpcClient, fn: "commit_budget" | "release_budget", reservationId: string): Promise<boolean> {
  try {
    const { data, error } = await db.rpc(fn, { p_reservation: reservationId });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** True when this call turned the reservation into usage; false when it was already settled, expired, or unknown. */
export const commitBudget = (db: RpcClient, reservationId: string) => settle(db, "commit_budget", reservationId);
/** True when this call gave the units back. */
export const releaseBudget = (db: RpcClient, reservationId: string) => settle(db, "release_budget", reservationId);

/**
 * Reserve, run `action`, then commit if it returned and release if it threw. The action is never started without a reservation.
 * A failed commit is not an error of the action (it ran); the reservation then expires by itself and the units come back.
 */
export async function withBudget<T>(db: RpcClient, req: BudgetRequest, action: () => Promise<T>): Promise<
  { ok: true; value: T } | { ok: false; status: 429 | 503; reason: "exhausted" | "unavailable" }
> {
  const reservation = await reserveBudget(db, req);
  if (!reservation.ok) return reservation;
  let value: T;
  try {
    value = await action();
  } catch (error) {
    await releaseBudget(db, reservation.reservationId);
    throw error;
  }
  await commitBudget(db, reservation.reservationId);
  return { ok: true, value };
}
