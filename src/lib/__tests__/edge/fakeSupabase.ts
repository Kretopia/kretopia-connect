// A tiny stand-in for the Supabase query builder, enough to run an edge
// function's handler under test. Reads are answered by a resolver keyed on the
// table and the filters used; every write is recorded so a test can assert on
// what the function would have changed.
export interface QueryContext {
  table: string;
  op: "list" | "single" | "maybeSingle";
  filters: Record<string, unknown>;
  inFilters: Record<string, unknown[]>;
}
export interface RecordedWrite {
  table: string;
  op: "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: Record<string, unknown>;
}
export type Resolver = (ctx: QueryContext) => { data?: unknown; error?: { message: string; code?: string } | null };

export function makeFakeClient(resolver: Resolver, writes: RecordedWrite[] = []) {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const inFilters: Record<string, unknown[]> = {};
    let write: RecordedWrite | null = null;

    const settle = (op: QueryContext["op"]) => {
      if (write) {
        writes.push(write);
        // A write that matched rows answers with them (`.update(...).select("id")` is how callers
        // detect a lost compare-and-swap); only a delete answers with nothing.
        return Promise.resolve({ data: write.op === "delete" ? [] : [{ id: `row-${table}` }], error: null });
      }
      const r = resolver({ table, op, filters, inFilters });
      return Promise.resolve({ data: r.data ?? (op === "list" ? [] : null), error: r.error ?? null });
    };

    const chain: any = {
      select: () => chain,
      insert: (payload: unknown) => { write = { table, op: "insert", payload, filters }; return chain; },
      update: (payload: unknown) => { write = { table, op: "update", payload, filters }; return chain; },
      upsert: (payload: unknown) => { write = { table, op: "upsert", payload, filters }; return chain; },
      delete: () => { write = { table, op: "delete", filters }; return chain; },
      eq: (k: string, v: unknown) => { filters[k] = v; return chain; },
      neq: () => chain,
      in: (k: string, v: unknown[]) => { inFilters[k] = v; return chain; },
      is: () => chain,
      not: () => chain,
      gt: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => settle("single"),
      maybeSingle: () => settle("maybeSingle"),
      then: (ok: any, bad: any) => settle("list").then(ok, bad),
    };
    return chain;
  };
  return { from, rpc: () => Promise.resolve({ data: null, error: null }), auth: {} as any };
}
