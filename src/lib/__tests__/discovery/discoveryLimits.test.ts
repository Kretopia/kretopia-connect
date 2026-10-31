import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeDiscoveryDb } from "./fakeDiscoveryDb";
import { parseRunSources } from "../../../../supabase/functions/_shared/discovery/http";
import { MAX_CANDIDATES_PER_RUN, RECONCILE_BUDGET_MS, RECONCILE_MAX_PER_RUN, runDiscovery, type PipelineDeps } from "../../../../supabase/functions/_shared/discovery/pipeline";
import { HIMALAYAS_PAGE_SIZE, SOURCE_ADAPTERS, adapterById, himalayasOpenUrl } from "../../../../supabase/functions/_shared/discovery/sources";
import { safeFetchBounded } from "../../../../supabase/functions/_shared/ssrf";

// Three limits of the daily run, removed (2026-10-30):
//   1. a run left out whatever came after its 100th DISTINCT posting, silently;
//   2. nothing took down a published posting that its source had closed before its own date;
//   3. a run always read every enabled source, so a once-a-day feed was read again to reach another source.
const NOW = new Date("2026-10-30T13:30:00Z");
const DAY = 86_400_000;
const FEED = "https://himalayas.app/jobs/api/search?q=video%20editor&sort=recent";
const check = (n: number) => `https://himalayas.app/jobs/api/companies/co-${n}/jobs/job-${n}`;

type Reply = { status?: number; body?: string; type?: string } | "throw";
// The real gateway (safeFetchBounded) runs against these fakes, so what is refused is refused by it.
function world(handler: (url: string) => Reply) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    const r = handler(url);
    if (r === "throw") throw new Error("network down");
    return new Response(r.body ?? "", { status: r.status ?? 200, headers: { "content-type": r.type ?? "application/json" } });
  }) as unknown as typeof fetch;
  const dns: Record<string, string[]> = { "himalayas.app": ["104.20.9.9"], "remoteok.com": ["104.20.1.1"] };
  const fetchBounded: PipelineDeps["fetchBounded"] = (url, policy) => safeFetchBounded(url, policy, { fetch: fetchImpl, resolveDns: async (h, t) => (t === "A" ? dns[h] ?? [] : []) });
  return { fetchBounded, calls };
}

const deps = (db: ReturnType<typeof makeDiscoveryDb>, w: ReturnType<typeof world>, over: Partial<PipelineDeps> = {}): PipelineDeps => ({
  rpc: db.rpc, from: db.from, fetchBounded: w.fetchBounded, now: () => NOW, claimSecret: "s", ...over,
});
const source = (id: string, over: Record<string, unknown> = {}) => ({ id, enabled: true, max_fetches_per_run: 1, daily_budget_cents: 0, cost_per_call_cents: 0, lock: false, failures: 0, ...over });

const himalayasJob = (n: number) => ({
  title: `Video Editor ${n}`, companyName: `Studio ${n}`, applicationLink: `https://himalayas.app/companies/studio-${n}/jobs/video-editor-${n}`,
  locationRestrictions: ["Portugal"], pubDate: Math.floor(NOW.getTime() / 1000) - 3600, expiryDate: Math.floor(NOW.getTime() / 1000) + 40 * 86400, excerpt: "A remote role.",
});
const remoteOkJob = (n: number) => ({ id: String(1_000_000 + n), position: `Designer ${n}`, company: "Acme", location: "Anywhere", description: "A role.", url: `https://remoteok.com/remote-jobs/designer-${n}-acme-${1_000_000 + n}`, date: "2026-10-28T00:00:00Z" });

// ── 1. the cap ────────────────────────────────────────────────────────────────────────────────────────────

describe("the cap on distinct postings per run", () => {
  it("is per source: Himalayas has room for every query's whole page, the others keep the default of 100", () => {
    const him = adapterById("himalayas")!;
    expect(him.maxCandidatesPerRun).toBeGreaterThanOrEqual(him.feedUrls.length * HIMALAYAS_PAGE_SIZE);
    for (const a of SOURCE_ADAPTERS.filter((x) => x.id !== "himalayas")) expect(a.maxCandidatesPerRun, a.id).toBeUndefined();
    expect(MAX_CANDIDATES_PER_RUN).toBe(100);
  });

  it("a Himalayas run takes all 160 distinct postings of its eight full pages and leaves none out", async () => {
    const urls = adapterById("himalayas")!.feedUrls;
    const w = world((u) => {
      const q = urls.indexOf(u);
      return { body: JSON.stringify({ jobs: Array.from({ length: HIMALAYAS_PAGE_SIZE }, (_, i) => himalayasJob(q * HIMALAYAS_PAGE_SIZE + i)) }) };
    });
    const db = makeDiscoveryDb({ now: () => NOW, sources: [source("himalayas", { max_fetches_per_run: urls.length })] });
    const res = await runDiscovery(deps(db, w));
    expect(res.ran[0]).toMatchObject({ source: "himalayas", status: "ran", fetched: 160, imported: 160, alreadyKnown: 0 });
    expect(res.ran[0].cut).toBeUndefined();
    expect(db.listings.size).toBe(160);
  });

  it("a source with the default cap and more than 100 postings in one feed reads them all, imports 100, and SAYS how many it left out", async () => {
    const w = world(() => ({ body: JSON.stringify([{ legal: "x" }, ...Array.from({ length: 140 }, (_, i) => remoteOkJob(i))]) }));
    const db = makeDiscoveryDb({ now: () => NOW, sources: [source("remoteok")] });
    const res = await runDiscovery(deps(db, w));
    expect(res.ran[0]).toMatchObject({ source: "remoteok", status: "ran", fetched: 140, imported: 100, cut: 40 });
    expect(db.listings.size).toBe(100);
    // the next run finds the 100 known and takes the rest only if they are still in the feed: nothing is lost silently
  });

  it("Himalayas' own cap counts distinct postings across its queries, and what it leaves out is reported", async () => {
    const urls = adapterById("himalayas")!.feedUrls;
    // a page of 30 is not what Himalayas serves (20), but it shows the mechanism: 8 x 30 = 240 distinct, a cap of 200
    const w = world((u) => ({ body: JSON.stringify({ jobs: Array.from({ length: 30 }, (_, i) => himalayasJob(urls.indexOf(u) * 30 + i)) }) }));
    const db = makeDiscoveryDb({ now: () => NOW, sources: [source("himalayas", { max_fetches_per_run: urls.length })] });
    const res = await runDiscovery(deps(db, w));
    expect(res.ran[0]).toMatchObject({ fetched: 240, imported: 200, cut: 40 });
    expect(db.listings.size).toBe(200);
  });

  it("the same posting under several queries counts once toward the cap", async () => {
    const urls = adapterById("himalayas")!.feedUrls;
    const w = world(() => ({ body: JSON.stringify({ jobs: Array.from({ length: 20 }, (_, i) => himalayasJob(i)) }) })); // every query answers the same 20
    const db = makeDiscoveryDb({ now: () => NOW, sources: [source("himalayas", { max_fetches_per_run: urls.length })] });
    const res = await runDiscovery(deps(db, w));
    expect(res.ran[0]).toMatchObject({ fetched: 160, imported: 20 });
    expect(res.ran[0].cut).toBeUndefined();
  });
});

// ── 2. taking down what the source closed ─────────────────────────────────────────────────────────────────

describe("published postings the source has closed", () => {
  let seq = 0;
  const publish = (db: ReturnType<typeof makeDiscoveryDb>, over: Record<string, unknown> = {}) => {
    const n = ++seq;
    const id = `pub-${n}`;
    db.listings.set(id, {
      id, status: "published", visibility: "public", source_provider: "himalayas", source_url: `https://himalayas.app/companies/co-${n}/jobs/job-${n}`,
      identity_key: `himalayas:co-${n}/job-${n}`, last_checked_at: new Date(NOW.getTime() - 3 * DAY).toISOString(), ...over,
    });
    return { id, n };
  };
  const run = (db: ReturnType<typeof makeDiscoveryDb>, w: ReturnType<typeof world>, over: Partial<PipelineDeps> = {}) => runDiscovery(deps(db, w, over));
  const emptyFeed = (replies: Record<number, Reply> = {}) =>
    world((u) => {
      if (u === FEED) return { body: JSON.stringify({ jobs: [] }) };
      const n = Number(u.match(/\/job-(\d+)$/)?.[1]);
      return replies[n] ?? { status: 200, body: "{}" };
    });
  const himalayasDb = (over: Record<string, unknown> = {}) => makeDiscoveryDb({ now: () => NOW, sources: [source("himalayas", over)] });

  it("only a 410 (closed) or a 404 (gone) takes a posting down: it becomes expired and private, with the reason in the audit trail; open ones are noted as checked; errors change nothing", async () => {
    const db = himalayasDb();
    const closed = publish(db), gone = publish(db), err = publish(db), net = publish(db);
    const open = Array.from({ length: 8 }, () => publish(db));
    const w = emptyFeed({ [closed.n]: { status: 410, body: '{"expiryDate":"2026-10-29"}' }, [gone.n]: { status: 404, body: "{}" }, [err.n]: { status: 500, body: "oops" }, [net.n]: "throw" });
    const res = await run(db, w);
    expect(res.ran[0]).toMatchObject({ status: "ran", reconciled: { checked: 12, open: 8, takenDown: 2, unknown: 2, remaining: 0 } });
    for (const x of [closed, gone]) expect(db.listings.get(x.id)).toMatchObject({ status: "expired", visibility: "private" });
    for (const x of [err, net]) expect(db.listings.get(x.id)).toMatchObject({ status: "published", visibility: "public" });
    for (const x of open) {
      expect(db.listings.get(x.id)).toMatchObject({ status: "published", visibility: "public", last_checked_at: NOW.toISOString() });
    }
    expect(db.events.filter((e) => e.event === "source_closed").map((e) => e.listing).sort()).toEqual([closed.id, gone.id].sort());
    expect(db.events.find((e) => e.listing === closed.id)).toMatchObject({ actor: null, event: "source_closed" });
    expect(w.calls).toContain(check(closed.n));
  });

  it("asks about each posting at the address the source documents (/jobs/api/companies/<company>/jobs/<slug>), and about nothing else", async () => {
    const db = himalayasDb();
    const a = publish(db);
    const w = emptyFeed();
    await run(db, w);
    expect(w.calls).toEqual([FEED, check(a.n)]);
  });

  it("a posting the feed showed in this very run is not asked about; neither is a claimed one, nor another source's", async () => {
    const db = himalayasDb();
    const fresh = publish(db, { last_checked_at: NOW.toISOString() }); // touched by this run's read
    const claimed = publish(db, { status: "claimed", visibility: "public" });
    const other = publish(db, { source_provider: "jobicy", source_url: "https://jobicy.com/jobs/1-a" });
    const stale = publish(db);
    const w = emptyFeed({ [stale.n]: { status: 410 } });
    await run(db, w);
    expect(w.calls.filter((c) => c.includes("/jobs/api/companies/"))).toEqual([check(stale.n)]);
    for (const x of [fresh, claimed, other]) expect(db.listings.get(x.id)!.status).toBe(x.id === claimed.id ? "claimed" : "published");
    expect(db.listings.get(stale.id)!.status).toBe("expired");
  });

  it("an outage cannot empty the list: when more than a third of at least five answers say closed or gone, NOTHING is taken down", async () => {
    const db = himalayasDb();
    const all = Array.from({ length: 10 }, () => publish(db));
    const w = emptyFeed(Object.fromEntries(all.map((x) => [x.n, { status: 404 }])));
    const res = await run(db, w);
    expect(res.ran[0].reconciled).toMatchObject({ checked: 10, takenDown: 0, aborted: "too_many_ended" });
    for (const x of all) expect(db.listings.get(x.id)!.status).toBe("published");
    expect(db.events.filter((e) => e.event === "source_closed")).toHaveLength(0);
  });

  it("a normal day's few closures still go: three of three is below the five answers the rule needs", async () => {
    const db = himalayasDb();
    const three = Array.from({ length: 3 }, () => publish(db));
    const res = await run(db, emptyFeed(Object.fromEntries(three.map((x) => [x.n, { status: 410 }]))));
    expect(res.ran[0].reconciled).toMatchObject({ checked: 3, takenDown: 3 });
    for (const x of three) expect(db.listings.get(x.id)!.status).toBe("expired");
  });

  it("a 429 stops the asking at once: what was already answered stands, the rest waits for the next run", async () => {
    const db = himalayasDb();
    const first = publish(db, { last_checked_at: new Date(NOW.getTime() - 9 * DAY).toISOString() });
    const second = publish(db, { last_checked_at: new Date(NOW.getTime() - 8 * DAY).toISOString() });
    const third = publish(db, { last_checked_at: new Date(NOW.getTime() - 7 * DAY).toISOString() });
    const fourth = publish(db, { last_checked_at: new Date(NOW.getTime() - 6 * DAY).toISOString() });
    const w = emptyFeed({ [first.n]: { status: 410 }, [second.n]: { status: 200 }, [third.n]: { status: 429 }, [fourth.n]: { status: 200 } });
    const res = await run(db, w);
    expect(res.ran[0].reconciled).toMatchObject({ checked: 2, takenDown: 1, open: 1, remaining: 2, aborted: "rate_limited" });
    expect(w.calls.filter((c) => c.includes("/jobs/api/companies/"))).toEqual([check(first.n), check(second.n), check(third.n)]); // the fourth was never asked
    expect(db.listings.get(first.id)!.status).toBe("expired");
  });

  it("at most RECONCILE_MAX_PER_RUN are asked per run, the longest-unchecked first; the rest are reported as remaining", async () => {
    const db = himalayasDb();
    const items = Array.from({ length: RECONCILE_MAX_PER_RUN + 12 }, (_, i) => publish(db, { last_checked_at: new Date(NOW.getTime() - (100 - i) * 3_600_000).toISOString() })); // item 0 is the oldest
    const w = emptyFeed();
    const res = await run(db, w);
    expect(res.ran[0].reconciled).toMatchObject({ checked: RECONCILE_MAX_PER_RUN, open: RECONCILE_MAX_PER_RUN, remaining: 12 });
    const asked = w.calls.filter((c) => c.includes("/jobs/api/companies/"));
    expect(asked.slice(0, 3)).toEqual(items.slice(0, 3).map((x) => check(x.n)));
    expect(asked).not.toContain(check(items[items.length - 1].n)); // the newest-checked waits
  });

  it("stops asking when its time budget is spent, and says what remains", async () => {
    const db = himalayasDb();
    Array.from({ length: 10 }, () => publish(db));
    let t = NOW.getTime();
    const res = await run(db, emptyFeed(), { now: () => new Date((t += RECONCILE_BUDGET_MS / 3)) });
    const r = res.ran[0].reconciled!;
    expect(r.checked).toBeGreaterThan(0);
    expect(r.checked).toBeLessThan(10);
    expect(r.remaining).toBe(10 - r.checked);
  });

  it("a source with a price per call is never asked, and a source that cannot answer has no reconciliation", async () => {
    const priced = himalayasDb({ cost_per_call_cents: 1, daily_budget_cents: 50 });
    publish(priced);
    const wp = emptyFeed();
    const res = await runDiscovery(deps(priced, wp, { rpc: priced.rpc }));
    expect(res.ran[0].reconciled).toBeUndefined();
    expect(wp.calls).toEqual([FEED]);

    const ok = makeDiscoveryDb({ now: () => NOW, sources: [source("remoteok")] });
    const w = world(() => ({ body: JSON.stringify([{ legal: "x" }, remoteOkJob(1)]) }));
    expect((await runDiscovery(deps(ok, w))).ran[0].reconciled).toBeUndefined();
  });

  it("a failure while taking a posting down is reported and never fails the run or the import", async () => {
    const db = himalayasDb();
    publish(db);
    const w = world((u) => (u === FEED ? { body: JSON.stringify({ jobs: [himalayasJob(1)] }) } : { status: 410 }));
    const res = await run(db, w, {
      from: (t: string) => {
        const q = db.from(t) as Record<string, unknown>;
        if (t === "external_listings") q.update = () => { throw new Error("boom"); };
        return q;
      },
    });
    expect(res.ran[0]).toMatchObject({ status: "ran", imported: 1, reconciled: { error: "boom", takenDown: 0 } });
  });
});

// ── 3. one run, some sources ──────────────────────────────────────────────────────────────────────────────

describe("a run limited to the sources named", () => {
  const both = () => makeDiscoveryDb({ now: () => NOW, sources: [source("remoteok"), source("himalayas")] });
  const feeds = () => world((u) => ({ body: u.startsWith("https://remoteok.com") ? JSON.stringify([{ legal: "x" }, remoteOkJob(1)]) : JSON.stringify({ jobs: [himalayasJob(1)] }) }));

  it("reads only the named source: the other is not fetched and not in the report", async () => {
    const w = feeds();
    const res = await runDiscovery(deps(both(), w), { only: ["remoteok"] });
    expect(res.ran.map((r) => r.source)).toEqual(["remoteok"]);
    expect(w.calls).toEqual(["https://remoteok.com/api"]);
  });

  it("without a list every enabled source is read, exactly as before (an empty list means the same)", async () => {
    for (const only of [undefined, []]) {
      const w = feeds();
      const res = await runDiscovery(deps(both(), w), { only });
      expect(res.ran.map((r) => r.source).sort()).toEqual(["himalayas", "remoteok"]);
      expect(w.calls).toHaveLength(2);
    }
  });

  it("a named source that is not enabled (or not a source at all) is reported as skipped and never run", async () => {
    const db = makeDiscoveryDb({ now: () => NOW, sources: [source("remoteok"), source("himalayas", { enabled: false })] });
    const w = feeds();
    const res = await runDiscovery(deps(db, w), { only: ["himalayas", "nonsense", "remoteok"] });
    expect(res.ran).toEqual(expect.arrayContaining([{ source: "himalayas", status: "skipped", reason: "not_enabled" }, { source: "nonsense", status: "skipped", reason: "not_enabled" }]));
    expect(res.ran.find((r) => r.source === "remoteok")).toMatchObject({ status: "ran", imported: 1 });
    expect(w.calls).toEqual(["https://remoteok.com/api"]);
  });

  it("does not bypass anything else: the kill switch still stops it, and each source still takes its own lock and budget", async () => {
    const off = makeDiscoveryDb({ now: () => NOW, settings: { enabled: false }, sources: [source("remoteok")] });
    const w = feeds();
    expect(await runDiscovery(deps(off, w), { only: ["remoteok"] })).toEqual({ ran: [], skipped: "kill_switch_off" });
    expect(w.calls).toEqual([]);
  });
});

describe("the function that takes the request (not run here: it needs Deno)", () => {
  const src = readFileSync(resolve(__dirname, "../../../../supabase/functions/external-discovery-run/index.ts"), "utf8");

  it("refuses a bad list of sources before it touches anything, and passes a good one to the run and back in the answer", () => {
    const parse = src.indexOf("parseRunSources(body.sources)");
    expect(parse).toBeGreaterThan(-1);
    expect(src.indexOf('return json(req, { ok: false, code: "bad_request"')).toBeGreaterThan(parse);
    // refused before the abandoned-reservation sweep and before the run
    expect(src.indexOf('if (only === "invalid")')).toBeLessThan(src.indexOf('rpc("expire_discovery_spend")'));
    expect(src).toContain("runDiscovery(deps, { slot, ...(only ? { only } : {}) })");
    // the answer repeats the list the run was limited to, so a caller sees what was read (checked on the answer's own line)
    const answer = src.split("\n").find((l) => l.includes("return json(req, { ok: true"));
    expect(answer).toBeDefined();
    expect(answer).toContain("...(only ? { only } : {})");
  });
});

describe("the request's list of sources", () => {
  it("absent means every source; a list of up to eight ids is kept without repeats", () => {
    expect(parseRunSources(undefined)).toBeNull();
    expect(parseRunSources(null)).toBeNull();
    expect(parseRunSources(["remoteok", "jobicy", "remoteok"])).toEqual(["remoteok", "jobicy"]);
    expect(parseRunSources(Array.from({ length: 8 }, (_, i) => `s-${i}`))).toHaveLength(8);
  });

  it("anything else is refused, not guessed at", () => {
    for (const bad of [[], "remoteok", { 0: "remoteok" }, 5, ["Remote OK"], ["remoteok", 3], ["a".repeat(33)], ["../etc"], Array.from({ length: 9 }, (_, i) => `s-${i}`), [""]]) {
      expect(parseRunSources(bad), JSON.stringify(bad)).toBe("invalid");
    }
  });
});

// ── what Himalayas documents ──────────────────────────────────────────────────────────────────────────────

describe("Himalayas' own way of saying a job is still open", () => {
  it("builds the address from the job's own page, and from nothing else", () => {
    expect(himalayasOpenUrl("https://himalayas.app/companies/customer-io/jobs/senior-brand-designer")).toBe("https://himalayas.app/jobs/api/companies/customer-io/jobs/senior-brand-designer");
    expect(himalayasOpenUrl("https://HIMALAYAS.app/companies/customer-io/jobs/senior-brand-designer/?utm_source=api")).toBe("https://himalayas.app/jobs/api/companies/customer-io/jobs/senior-brand-designer");
    for (const no of ["https://evil.example/companies/a/jobs/b", "https://himalayas.app/jobs/api/search?q=x", "https://himalayas.app/companies/a", "https://himalayas.app/companies/a/jobs/", "https://himalayas.app/companies/A_B/jobs/c", "not a url", ""]) {
      expect(himalayasOpenUrl(no), no).toBeNull();
    }
  });

  it("200 is open, 410 closed, 404 gone, and every other answer is unknown (never a reason to take anything down)", () => {
    const i = adapterById("himalayas")!.openCheck!.interpret;
    expect([200, 410, 404].map(i)).toEqual(["open", "closed", "gone"]);
    for (const s of [201, 204, 301, 302, 400, 401, 403, 429, 500, 502, 503, 504]) expect(i(s), String(s)).toBe("unknown");
  });

  it("is the only source with such a check", () => {
    expect(SOURCE_ADAPTERS.filter((a) => a.openCheck).map((a) => a.id)).toEqual(["himalayas"]);
  });
});
