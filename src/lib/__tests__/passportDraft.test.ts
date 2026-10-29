import { describe, expect, it, vi } from "vitest";
import { requestPassportDraft, savePassportDraft, type PassportDraft } from "../passportDraft";

const draft: PassportDraft = {
  bio: { text: "I'm an illustrator in Jakarta focused on storyboarding." },
  photo: { url: "https://lh3.test/me", source: "auth_provider" },
  work_item: { project_name: "Portfolio · amaravega.com", role: "Illustrator", url: "https://amaravega.com/work", source_label: "Link already on your profile" },
};

describe("requestPassportDraft", () => {
  it("returns a ready draft, partial when a missing field could not be drafted", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, draft: { bio: draft.bio, photo: null, work_item: null }, unavailable: { photo: "no_candidates", work_item: "no_candidates" } },
      error: null,
    });
    const r = await requestPassportDraft(invoke);
    expect(invoke).toHaveBeenCalledWith("draft-passport-profile", { body: {} });
    expect(r).toMatchObject({ status: "ready", partial: true });
    if (r.status === "ready") expect(r.draft).toEqual({ bio: draft.bio, photo: null, work_item: null });
  });

  it("is not partial when every missing field has a draft", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, draft, unavailable: {} }, error: null });
    expect(await requestPassportDraft(invoke)).toMatchObject({ status: "ready", partial: false });
  });

  it("fields that were already complete do not make the draft partial", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, draft: { bio: draft.bio, photo: null, work_item: null }, unavailable: { photo: "already_complete", work_item: "already_complete" } },
      error: null,
    });
    expect(await requestPassportDraft(invoke)).toMatchObject({ status: "ready", partial: false });
  });

  it("reads the function's error body, and never turns a failure into an empty draft", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { context: { json: async () => ({ ok: false, code: "rate_limited" }) } } });
    expect(await requestPassportDraft(invoke)).toEqual({ status: "failed", code: "rate_limited", message: "Too many requests. Try again in a minute." });
  });

  it("a thrown request and an unreadable answer are failures too", async () => {
    expect(await requestPassportDraft(vi.fn().mockRejectedValue(new Error("offline")))).toMatchObject({ status: "failed", code: "network" });
    expect(await requestPassportDraft(vi.fn().mockResolvedValue({ data: { ok: true }, error: null }))).toMatchObject({ status: "failed" });
    expect(await requestPassportDraft(vi.fn().mockResolvedValue({ data: null, error: new Error("x") }))).toMatchObject({ status: "failed", code: "unavailable" });
  });
});

function fakeDb(opts: { profileError?: boolean; existingCredit?: boolean; lookupError?: boolean; insertError?: boolean } = {}) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const db = {
    from(table: string) {
      return {
        update(payload: unknown) {
          calls.push({ table, op: "update", payload });
          return { eq: async () => ({ error: opts.profileError ? { message: "denied" } : null }) };
        },
        select() {
          const chain = { eq: () => chain, limit: () => chain, maybeSingle: async () => ({ data: opts.existingCredit ? { id: "c1" } : null, error: opts.lookupError ? { message: "x" } : null }) };
          return chain;
        },
        insert: async (payload: unknown) => {
          calls.push({ table, op: "insert", payload });
          return { error: opts.insertError ? { message: "check violation" } : null };
        },
      };
    },
  };
  return { db, calls };
}

describe("savePassportDraft writes only what was accepted", () => {
  it("saves accepted bio and photo in one profile update and leaves the rest alone", async () => {
    const { db, calls } = fakeDb();
    const r = await savePassportDraft(db, "u1", draft, ["bio", "photo"]);
    expect(r).toEqual({ saved: ["bio", "photo"], failed: [] });
    expect(calls).toEqual([{ table: "profiles", op: "update", payload: { bio: draft.bio!.text, avatar_url: "https://lh3.test/me" } }]);
  });

  it("nothing accepted writes nothing", async () => {
    const { db, calls } = fakeDb();
    expect(await savePassportDraft(db, "u1", draft, [])).toEqual({ saved: [], failed: [] });
    expect(calls).toEqual([]);
  });

  it("adds an accepted work item as a self-reported credit, never a verified one", async () => {
    const { db, calls } = fakeDb();
    const r = await savePassportDraft(db, "u1", draft, ["work_item"]);
    expect(r.saved).toEqual(["work_item"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: "credits", op: "insert" });
    expect(calls[0].payload).toMatchObject({ user_id: "u1", verification_status: "self_reported", url: "https://amaravega.com/work", role: "Illustrator" });
    expect(JSON.stringify(calls[0].payload)).not.toMatch(/web_verified|"verified"|auto_discovered|peer/);
  });

  it("does not add the same link twice", async () => {
    const { db, calls } = fakeDb({ existingCredit: true });
    expect((await savePassportDraft(db, "u1", draft, ["work_item"])).saved).toEqual(["work_item"]);
    expect(calls).toEqual([]);
  });

  it("reports each write that failed instead of assuming it saved", async () => {
    const a = await savePassportDraft(fakeDb({ profileError: true }).db, "u1", draft, ["bio", "photo", "work_item"]);
    expect(a.saved).toEqual(["work_item"]);
    expect(a.failed.map((f) => f.field)).toEqual(["bio", "photo"]);
    const b = await savePassportDraft(fakeDb({ insertError: true }).db, "u1", draft, ["work_item"]);
    expect(b).toEqual({ saved: [], failed: [{ field: "work_item", message: "The work item could not be added." }] });
    const c = await savePassportDraft(fakeDb({ lookupError: true }).db, "u1", draft, ["work_item"]);
    expect(c.failed).toHaveLength(1);
  });
});
