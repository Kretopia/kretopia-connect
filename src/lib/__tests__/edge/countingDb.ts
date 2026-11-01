// MemoryDb with `select(..., { count, head })` answered the way PostgREST answers it, for the send registry
// (email_send_log, read by _shared/outboundBudget.ts). Every other table behaves as in MemoryDb.
import { MemoryDb } from "./memoryDb";

type Row = Record<string, unknown>;
type Settle = (value: unknown) => unknown;

interface CountChain {
  select: () => CountChain;
  eq: (col: string, v: unknown) => CountChain;
  in: (col: string, v: unknown[]) => CountChain;
  gte: (col: string, v: string) => CountChain;
  insert: (row: Row) => unknown;
  then: (ok?: Settle, bad?: Settle) => Promise<unknown>;
}

export class CountingDb extends MemoryDb {
  override from(table: string) {
    const inner = super.from(table);
    if (table !== "email_send_log") return inner;
    const conds: Array<(r: Row) => boolean> = [];
    const actor = (r: Row) => (r.metadata as { actor_user_id?: unknown } | undefined)?.actor_user_id;
    const chain: CountChain = {
      select: () => chain,
      eq: (col, v) => (conds.push((r) => (col === "metadata->>actor_user_id" ? actor(r) === v : r[col] === v)), chain),
      in: (col, v) => (conds.push((r) => v.includes(r[col])), chain),
      gte: (col, v) => (conds.push((r) => String(r[col]) >= v), chain),
      insert: (row) => inner.insert({ created_at: new Date().toISOString(), ...row }),
      then: (ok, bad) => {
        const failure = this.hooks.failOn?.(table, "select");
        const matched = this.rows(table).filter((r) => conds.every((c) => c(r)));
        return Promise.resolve(failure ? { count: null, error: failure } : { count: matched.length, error: null }).then(ok, bad);
      },
    };
    return chain as unknown as ReturnType<MemoryDb["from"]>;
  }
}
