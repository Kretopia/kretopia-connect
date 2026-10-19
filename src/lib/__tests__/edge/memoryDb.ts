// An in-memory stand-in for the Supabase query builder with real table semantics (rows persist between
// calls, filters narrow, updates/deletes act on what matched). fakeSupabase.ts answers reads from a
// resolver and only records writes, which cannot express "the insert I just made is now visible to the
// next read" or "the compare-and-swap lost"; edge tests about idempotency and races need that.
//
// Supported: select / insert / update / delete, eq / neq / in / is / not / ilike / or (eq + ilike terms) /
// gt / gte / lte, order (several, stable), limit, single / maybeSingle, and awaiting the chain. Anything else throws, so
// a test never silently passes on a query the stand-in does not understand.

type Row = Record<string, any>;
type Result = { data: any; error: { message: string; code?: string } | null };

export interface MemoryDbHooks {
  /** Called just before an insert is applied; may add rows (a concurrent writer) or return an error. */
  beforeInsert?: (table: string, rows: Row[], db: MemoryDb) => { message: string; code?: string } | void;
  /** Return an error to make any query on this table/op fail. */
  failOn?: (table: string, op: "select" | "insert" | "update" | "delete") => { message: string; code?: string } | null;
}

export class MemoryDb {
  tables: Record<string, Row[]> = {};
  log: Array<{ table: string; op: "insert" | "update" | "delete"; payload?: unknown; matched: number }> = [];
  hooks: MemoryDbHooks = {};
  private seq = 0;

  seed(table: string, rows: Row[]) {
    this.tables[table] = [...(this.tables[table] ?? []), ...rows.map((r) => ({ ...r }))];
    return this;
  }
  rows(table: string): Row[] {
    return this.tables[table] ?? [];
  }
  writes(table: string, op?: "insert" | "update" | "delete") {
    return this.log.filter((l) => l.table === table && (!op || l.op === op));
  }
  nextId(prefix: string) {
    return `${prefix}-${++this.seq}`;
  }

  from(table: string) {
    const db = this;
    const filters: Array<(r: Row) => boolean> = [];
    const orders: Array<{ col: string; asc: boolean }> = [];
    let limit: number | null = null;
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: any;
    let returning = false;

    const run = (mode: "list" | "single" | "maybeSingle"): Result => {
      const failure = db.hooks.failOn?.(table, op) ?? null;
      if (failure) return { data: null, error: failure };
      const all = (db.tables[table] ??= []);

      if (op === "insert") {
        const incoming: Row[] = (Array.isArray(payload) ? payload : [payload]).map((r: Row) => ({
          id: r.id ?? db.nextId(table),
          created_at: r.created_at ?? new Date(Date.now() + db.seq).toISOString(),
          ...r,
        }));
        const hookErr = db.hooks.beforeInsert?.(table, incoming, db);
        if (hookErr) return { data: null, error: hookErr };
        all.push(...incoming);
        db.log.push({ table, op, payload, matched: incoming.length });
        return shape(returning ? incoming : [], mode);
      }

      let matched = all.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        matched.forEach((r) => Object.assign(r, payload));
        db.log.push({ table, op, payload, matched: matched.length });
        return shape(returning ? matched : [], mode);
      }
      if (op === "delete") {
        db.tables[table] = all.filter((r) => !matched.includes(r));
        db.log.push({ table, op, matched: matched.length });
        return shape([], mode);
      }
      if (orders.length) {
        matched = [...matched].sort((a, b) => {
          for (const o of orders) {
            const x = a[o.col];
            const y = b[o.col];
            if (x === y) continue;
            return (x > y ? 1 : -1) * (o.asc ? 1 : -1);
          }
          return 0;
        });
      }
      if (limit !== null) matched = matched.slice(0, limit);
      return shape(matched, mode);
    };

    const shape = (rows: Row[], mode: "list" | "single" | "maybeSingle"): Result => {
      if (mode === "list") return { data: rows.map((r) => ({ ...r })), error: null };
      if (rows.length > 1 && mode === "maybeSingle") {
        return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      }
      if (rows.length === 0 && mode === "single") return { data: null, error: { message: "no rows", code: "PGRST116" } };
      return { data: rows[0] ? { ...rows[0] } : null, error: null };
    };

    const like = (pattern: string) =>
      new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i");

    const chain: any = {
      select: () => {
        if (op !== "select") returning = true;
        return chain;
      },
      insert: (p: any) => ((op = "insert"), (payload = p), chain),
      update: (p: any) => ((op = "update"), (payload = p), chain),
      delete: () => ((op = "delete"), chain),
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), chain),
      neq: (c: string, v: any) => (filters.push((r) => r[c] !== v), chain),
      in: (c: string, v: any[]) => (filters.push((r) => v.includes(r[c])), chain),
      is: (c: string, v: any) => (filters.push((r) => (v === null ? r[c] == null : r[c] === v)), chain),
      not: (c: string, o: string, v: any) => {
        if (o !== "is") throw new Error(`memoryDb: not(${o}) unsupported`);
        filters.push((r) => (v === null ? r[c] != null : r[c] !== v));
        return chain;
      },
      gt: (c: string, v: any) => (filters.push((r) => r[c] > v), chain),
      gte: (c: string, v: any) => (filters.push((r) => r[c] >= v), chain),
      lte: (c: string, v: any) => (filters.push((r) => r[c] <= v), chain),
      ilike: (c: string, pat: string) => (filters.push((r) => like(pat).test(String(r[c] ?? ""))), chain),
      or: (expr: string) => {
        const terms = expr.split(",").map((t) => {
          const [col, o, ...rest] = t.split(".");
          const val = rest.join(".");
          if (o === "eq") return (r: Row) => String(r[col]) === val;
          if (o === "ilike") return (r: Row) => like(val).test(String(r[col] ?? ""));
          throw new Error(`memoryDb: or term ${t} unsupported`);
        });
        filters.push((r) => terms.some((t) => t(r)));
        return chain;
      },
      order: (col: string, o?: { ascending?: boolean }) => (orders.push({ col, asc: o?.ascending !== false }), chain),
      limit: (n: number) => ((limit = n), chain),
      single: () => Promise.resolve(run("single")),
      maybeSingle: () => Promise.resolve(run("maybeSingle")),
      then: (ok: any, bad: any) => Promise.resolve(run("list")).then(ok, bad),
    };
    return chain;
  }
}
