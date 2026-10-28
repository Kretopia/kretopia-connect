// An in-memory model of the discovery database for orchestration tests. It mirrors the SEMANTICS of the SQL functions in
// supabase/migrations/20261029100000_external_discovery.sql (the SQL itself was run on a real Postgres under concurrency,
// see docs/release/EXTERNAL_DISCOVERY.md): each rpc is one atomic step, so Promise.all interleaves like parallel callers.
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function makeDiscoveryDb(init: { admins?: string[]; settings?: Partial<{ enabled: boolean; ceiling: number; perUser: number }>; sources?: Row[]; scouted?: Row[] } = {}) {
  const admins = new Set(init.admins ?? ["admin-1"]);
  const settings = { enabled: true, ceiling: 100, perUser: 30, ...(init.settings ?? {}) };
  const sources: Row[] = init.sources ?? [{ id: "remoteok", enabled: true, max_fetches_per_run: 1, daily_budget_cents: 50, cost_per_call_cents: 0, lock: false, failures: 0 }];
  const scouted: Row[] = init.scouted ?? []; // members' Scouted lists (one row per member), read by the duplicate advice
  const listings = new Map<string, Row>();
  const byKey = new Map<string, string>();
  const tokens: Row[] = [];
  const claims: Row[] = [];
  const events: { listing: string; actor: string | null; event: string }[] = [];
  const ledger = new Map<string, Row>();
  const counters = new Map<string, number>();
  const log: string[] = [];
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;
  const isAdmin = (u: string | null) => !!u && admins.has(u);
  const ev = (listing: string, actor: string | null, event: string) => events.push({ listing, actor, event });

  const capOf = (scope: string, src: Row) => (scope === "global" ? settings.ceiling : scope.startsWith("source:") ? src.daily_budget_cents : settings.perUser);

  const rpcs: Record<string, (a: Row) => Row> = {
    import_external_listing: ({ p_actor, p_row }) => {
      const key = p_row.identity_key ?? null;
      if (key && byKey.has(key)) {
        const ex = listings.get(byKey.get(key)!)!;
        ex.last_checked_at = new Date();
        return { created: false, listing_id: ex.status === "published" || ex.status === "claimed" || ex.created_by === p_actor ? ex.id : null, reason: "already_known" };
      }
      const lid = id("l");
      listings.set(lid, { id: lid, status: "draft", visibility: "private", created_by: p_actor, owner_user_id: null, applications_enabled: false, ...p_row });
      if (key) byKey.set(key, lid);
      ev(lid, p_actor, "imported");
      return { created: true, listing_id: lid };
    },
    review_external_listing: ({ p_listing, p_actor, p_action }) => {
      const l = listings.get(p_listing);
      if (!l) return { ok: false, reason: "not_found" };
      if (p_action === "send_to_review") {
        if (l.created_by !== p_actor && !isAdmin(p_actor)) return { ok: false, reason: "forbidden" };
        l.status = "in_review"; l.visibility = "review"; return { ok: true };
      }
      if (!isAdmin(p_actor)) return { ok: false, reason: "forbidden" };
      if (p_action === "approve") {
        if (!l.identity_key) return { ok: false, reason: "needs_corroborating_source" };
        if (l.flagged_instructions) return { ok: false, reason: "flagged_instructions" };
        if (!l.apply_url || !l.original_publisher) return { ok: false, reason: "missing_publisher_or_destination" };
        l.status = "published"; l.visibility = "public"; return { ok: true };
      }
      l.status = p_action === "reject" ? "rejected" : p_action === "expire" ? "expired" : "removed"; l.visibility = "private";
      // like the partial unique index: a rejected or removed listing no longer holds its identity, so it can be imported again
      if ((l.status === "rejected" || l.status === "removed") && l.identity_key && byKey.get(l.identity_key) === l.id) byKey.delete(l.identity_key);
      return { ok: true };
    },
    register_claim_token: ({ p_listing, p_actor, p_token_hash, p_expires_at }) => {
      if (!isAdmin(p_actor)) return { ok: false, reason: "forbidden" };
      const l = listings.get(p_listing);
      if (!l || l.status !== "published") return { ok: false, reason: "not_published_or_already_claimed" };
      tokens.push({ listing_id: p_listing, hash: p_token_hash, expires_at: new Date(p_expires_at), used: false });
      ev(p_listing, p_actor, "claim_link_created");
      return { ok: true };
    },
    redeem_claim_token: ({ p_token_hash, p_listing, p_user }) => {
      if (!p_user) return { ok: false, reason: "sign_in_required" };
      const l = listings.get(p_listing);
      if (!l || l.status !== "published") return { ok: false, reason: "unavailable" };
      const t = tokens.find((x) => x.hash === p_token_hash && x.listing_id === p_listing && !x.used && !x.revoked && x.expires_at.getTime() > Date.now());
      if (!t) return { ok: false, reason: "invalid_or_used" };
      t.used = true;
      const c = { id: id("c"), listing_id: p_listing, claimant_user_id: p_user, status: "pending" };
      claims.push(c);
      return { ok: true, claim_id: c.id };
    },
    verify_external_claim: ({ p_claim, p_claimant, p_method, p_domain, p_decided_by }) => {
      if (p_method === "admin_review" && !isAdmin(p_decided_by)) return { ok: false, reason: "forbidden" };
      const c = claims.find((x) => x.id === p_claim);
      if (!c) return { ok: false, reason: "not_found" };
      if (c.claimant_user_id !== p_claimant && p_method === "source_domain") return { ok: false, reason: "not_your_claim" };
      if (c.status !== "pending") return { ok: false, reason: "not_pending" };
      if (claims.some((x) => x.listing_id === c.listing_id && x.status === "verified")) return { ok: false, reason: "already_claimed" };
      const l = listings.get(c.listing_id)!;
      if (l.status !== "published") return { ok: false, reason: "not_published_or_already_claimed" };
      c.status = "verified"; c.method = p_method; c.domain = p_domain;
      l.status = "claimed"; l.owner_user_id = c.claimant_user_id; l.verification_status = "owner_verified";
      ev(c.listing_id, p_decided_by, "claim_verified");
      return { ok: true, listing_id: c.listing_id };
    },
    reject_external_claim: ({ p_claim, p_admin }) => {
      if (!isAdmin(p_admin)) return { ok: false, reason: "forbidden" };
      const c = claims.find((x) => x.id === p_claim && x.status === "pending");
      if (!c) return { ok: false, reason: "not_pending" };
      c.status = "rejected"; return { ok: true };
    },
    owner_update_external_listing: ({ p_listing, p_owner, p_edits }) => {
      const l = listings.get(p_listing);
      if (!l || l.owner_user_id !== p_owner || l.status !== "claimed") return { ok: false, reason: "forbidden" };
      for (const k of ["description_full", "deadline_at", "budget"]) if (k in p_edits) l[k] = p_edits[k];
      return { ok: true };
    },
    set_external_applications: ({ p_listing, p_admin, p_enabled }) => {
      if (!isAdmin(p_admin)) return { ok: false, reason: "forbidden" };
      const l = listings.get(p_listing);
      if (!l || l.status !== "claimed" || l.verification_status !== "owner_verified") return { ok: false, reason: "needs_verified_owner" };
      l.applications_enabled = p_enabled; return { ok: true };
    },
    dispute_external_listing: ({ p_listing }) => {
      const l = listings.get(p_listing);
      if (!l) return { ok: false, reason: "not_found" };
      l.visibility = "review"; return { ok: true };
    },
    external_log: ({ p_listing, p_actor, p_event }) => { ev(p_listing, p_actor, p_event); return { ok: true }; },
    reserve_discovery_spend: ({ p_job_key, p_source, p_user, p_cents }) => {
      log.push(`reserve:${p_job_key}`);
      if (!settings.enabled) return { ok: false, reason: "disabled" };
      const src = sources.find((s) => s.id === p_source);
      if (!src || !src.enabled) return { ok: false, reason: "source_disabled" };
      if (ledger.has(p_job_key)) return { ok: true, reused: true };
      const scopes = ["global", `source:${p_source}`, ...(p_user ? [`user:${p_user}`] : [])].sort();
      const after: Record<string, number> = {};
      for (const s of scopes) {
        const next = (counters.get(s) ?? 0) + p_cents;
        if (next > capOf(s, src)) return { ok: false, reason: `cap_reached:${s}` };
        after[s] = next;
      }
      for (const s of scopes) counters.set(s, after[s]);
      ledger.set(p_job_key, { cents: p_cents, scopes, status: "reserved" });
      return { ok: true, reserved_cents: p_cents };
    },
    settle_discovery_spend: ({ p_job_key, p_actual_cents }) => {
      log.push(`settle:${p_job_key}`);
      const r = ledger.get(p_job_key);
      if (!r || r.status !== "reserved") return { ok: false, reason: "not_reserved" };
      const actual = Math.min(Math.max(p_actual_cents, 0), r.cents);
      for (const s of r.scopes) counters.set(s, Math.max((counters.get(s) ?? 0) - (r.cents - actual), 0));
      r.status = "settled"; return { ok: true, settled_cents: actual };
    },
    acquire_discovery_run: ({ p_source }) => {
      const s = sources.find((x) => x.id === p_source);
      if (!s || !s.enabled || s.lock) return false as unknown as Row;
      s.lock = true; return true as unknown as Row;
    },
    release_discovery_run: ({ p_source }) => { const s = sources.find((x) => x.id === p_source); if (s) s.lock = false; return {}; },
    record_discovery_run: ({ p_source, p_ok, p_error }) => {
      const s = sources.find((x) => x.id === p_source)!;
      s.lock = false;
      if (p_ok) { s.failures = 0; s.last_error = null; } else { s.failures += 1; s.last_error = p_error; if (s.failures >= 3) s.enabled = false; }
      return { enabled: s.enabled, consecutive_failures: s.failures };
    },
  };

  const rpc = async (name: string, args: Row) => {
    await Promise.resolve(); // an await boundary per call, like a network hop
    const fn = rpcs[name];
    if (!fn) return { data: null, error: { message: `unknown rpc ${name}` } };
    return { data: fn(args), error: null };
  };

  const tables: Record<string, () => Row[]> = {
    external_listings: () => [...listings.values()],
    external_listing_claims: () => claims,
    discovery_settings: () => [{ enabled: settings.enabled }],
    discovery_sources: () => sources,
    scouted_gigs: () => scouted,
  };
  // SQL ILIKE with the default backslash escape: % = any run, _ = any one character
  const ilike = (pattern: string) => {
    let re = "";
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === "\\" && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      else if (c === "%") re += ".*";
      else if (c === "_") re += ".";
      else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(`^${re}$`, "i");
  };
  const from = (table: string) => {
    let rows = (tables[table]?.() ?? []).slice();
    let total: number | null = null;
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), q),
      in: (c: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[c]))), q),
      is: (c: string, v: unknown) => ((rows = rows.filter((r) => (v === null ? r[c] == null : r[c] === v))), q),
      ilike: (c: string, pat: string) => ((rows = rows.filter((r) => typeof r[c] === "string" && ilike(pat).test(r[c]))), q),
      gt: (c: string, v: string) => ((rows = rows.filter((r) => r[c] > v)), q),
      order: () => q,
      limit: (k: number) => ((total = rows.length), (rows = rows.slice(0, k)), q),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, count: total ?? rows.length, error: null }).then(res),
    };
    return q;
  };

  return { rpc, from, scouted, listings, tokens, claims, events, ledger, counters, sources, settings, log, admins, isAdmin };
}
