// MemoryDb with `select(..., { count, head })` answered the way PostgREST answers it, for the send registry
// (email_send_log, read by _shared/outboundBudget.ts). Every other table behaves as in MemoryDb.
import { MemoryDb } from "./memoryDb";

export class CountingDb extends MemoryDb {
  override from(table: string) {
    const inner = super.from(table);
    if (table !== "email_send_log") return inner;
    const conds: Array<(r: Record<string, any>) => boolean> = [];
    const chain: any = {
      select: () => chain,
      eq: (col: string, v: unknown) => (conds.push((r) => (col === "metadata->>actor_user_id" ? r.metadata?.actor_user_id === v : r[col] === v)), chain),
      in: (col: string, v: unknown[]) => (conds.push((r) => v.includes(r[col])), chain),
      gte: (col: string, v: string) => (conds.push((r) => String(r[col]) >= v), chain),
      insert: (row: Record<string, any>) => inner.insert({ created_at: new Date().toISOString(), ...row }),
      then: (ok: any, bad: any) => {
        const failure = this.hooks.failOn?.(table, "select");
        const matched = this.rows(table).filter((r) => conds.every((c) => c(r)));
        return Promise.resolve(failure ? { count: null, error: failure } : { count: matched.length, error: null }).then(ok, bad);
      },
    };
    return chain;
  }
}
