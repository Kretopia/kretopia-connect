import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  DRAFT_TTL_MS,
  clearAllDrafts,
  clearDraft,
  draftKey,
  readDraft,
  sweepExpiredDrafts,
  writeDraft,
} from "../draftStorage";
import { useDraftRecovery } from "@/hooks/useDraftRecovery";
import { createNote, deleteNote, saveNote, type NoteRow, type NotesClient } from "../noteSave";

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("draftStorage", () => {
  it("round-trips a draft with its base version", () => {
    const k = draftKey("note", "p1", "n1");
    expect(writeDraft(k, { title: "a", content: "b" }, "2026-10-09T10:00:00Z")).toBe(true);
    const d = readDraft<{ title: string; content: string }>(k);
    expect(d?.value).toEqual({ title: "a", content: "b" });
    expect(d?.base).toBe("2026-10-09T10:00:00Z");
  });

  it("expires after 14 days and removes the entry", () => {
    const k = draftKey("note", "p1", "n1");
    writeDraft(k, { x: 1 }, null, 1_000);
    expect(readDraft(k, 1_000 + DRAFT_TTL_MS - 1)).not.toBeNull();
    expect(readDraft(k, 1_000 + DRAFT_TTL_MS + 1)).toBeNull();
    expect(localStorage.getItem(k)).toBeNull();
  });

  it("treats corrupt or foreign data as no draft, never throws", () => {
    const k = draftKey("note", "p1", "n1");
    localStorage.setItem(k, "{not json");
    expect(readDraft(k)).toBeNull();
    localStorage.setItem(k, JSON.stringify({ v: 99, savedAt: Date.now(), value: 1 }));
    expect(readDraft(k)).toBeNull();
  });

  it("reports false instead of throwing when storage refuses the write", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(writeDraft(draftKey("a"), { big: "x" })).toBe(false);
    spy.mockRestore();
  });

  it("refuses absurdly large drafts", () => {
    expect(writeDraft(draftKey("a"), "x".repeat(500_000))).toBe(false);
  });

  it("clears one draft, all drafts, and sweeps expired ones, leaving other keys alone", () => {
    localStorage.setItem("other", "keep");
    writeDraft(draftKey("a"), 1, null, 1_000);
    writeDraft(draftKey("b"), 2);
    expect(sweepExpiredDrafts(1_000 + DRAFT_TTL_MS + 10)).toBe(1);
    clearDraft(draftKey("b"));
    expect(readDraft(draftKey("b"))).toBeNull();
    writeDraft(draftKey("c"), 3);
    expect(clearAllDrafts()).toBe(1);
    expect(localStorage.getItem("other")).toBe("keep");
  });
});

describe("useDraftRecovery", () => {
  const KEY = draftKey("note", "p1", "n1");
  const saved = { title: "Saved", content: "server text" };

  it("persists unsaved edits after the debounce and reports an honest status", () => {
    vi.useFakeTimers();
    const onRestore = vi.fn();
    const { result, rerender } = renderHook(
      (p: { value: typeof saved }) => useDraftRecovery({ key: KEY, saved, value: p.value, onRestore, debounceMs: 100 }),
      { initialProps: { value: saved } },
    );
    expect(result.current.status).toBe("clean");

    rerender({ value: { ...saved, content: "typing…" } });
    expect(result.current.status).toBe("dirty");
    expect(readDraft(KEY)).toBeNull(); // not yet: debounced

    act(() => void vi.advanceTimersByTime(150));
    expect(result.current.status).toBe("kept-on-device");
    expect(readDraft<typeof saved>(KEY)?.value.content).toBe("typing…");
  });

  it("restores a different draft once when the note is opened, and says when it was saved", () => {
    const writtenAt = Date.now() - 60_000;
    writeDraft(KEY, { title: "Saved", content: "unsaved edit" }, null, writtenAt);
    const onRestore = vi.fn();
    const { result } = renderHook(() => useDraftRecovery({ key: KEY, saved, value: saved, onRestore }));
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith({ title: "Saved", content: "unsaved edit" });
    expect(result.current.restoredAt).toBe(writtenAt);
  });

  it("ignores (and removes) a draft identical to what the server holds", () => {
    writeDraft(KEY, saved);
    const onRestore = vi.fn();
    renderHook(() => useDraftRecovery({ key: KEY, saved, value: saved, onRestore }));
    expect(onRestore).not.toHaveBeenCalled();
    expect(readDraft(KEY)).toBeNull();
  });

  it("markSaved deletes the draft; discard restores the server version", () => {
    vi.useFakeTimers();
    const onRestore = vi.fn();
    const edited = { ...saved, content: "mine" };
    const { result } = renderHook(() => useDraftRecovery({ key: KEY, saved, value: edited, onRestore, debounceMs: 10 }));
    act(() => void vi.advanceTimersByTime(20));
    expect(readDraft(KEY)).not.toBeNull();
    act(() => result.current.discard());
    expect(readDraft(KEY)).toBeNull();
    expect(onRestore).toHaveBeenLastCalledWith(saved);

    act(() => void vi.advanceTimersByTime(20));
    act(() => result.current.markSaved());
    expect(readDraft(KEY)).toBeNull();
  });

  it("flush writes immediately, and closing the page flushes too (nothing waits for the debounce)", () => {
    vi.useFakeTimers();
    const edited = { ...saved, content: "unflushed" };
    const { result } = renderHook(() =>
      useDraftRecovery({ key: KEY, saved, value: edited, onRestore: vi.fn(), debounceMs: 10_000 }),
    );
    expect(readDraft(KEY)).toBeNull();
    act(() => result.current.flush());
    expect(readDraft<typeof saved>(KEY)?.value.content).toBe("unflushed");
    clearDraft(KEY);
    act(() => void window.dispatchEvent(new Event("pagehide")));
    expect(readDraft<typeof saved>(KEY)?.value.content).toBe("unflushed");
  });

  it("does not restore when told the person started from a template", () => {
    writeDraft(KEY, { title: "old", content: "old" });
    const onRestore = vi.fn();
    renderHook(() => useDraftRecovery({ key: KEY, saved, value: saved, onRestore, skipRestore: true }));
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("claims 'not-kept' when the device refuses the draft", () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() =>
      useDraftRecovery({ key: KEY, saved, value: { ...saved, content: "x" }, onRestore: vi.fn(), debounceMs: 10 }),
    );
    act(() => void vi.advanceTimersByTime(20));
    expect(result.current.status).toBe("not-kept");
    vi.restoreAllMocks();
  });
});

// ── noteSave: a fake of the query builder that records what was asked ────────
const row = (over: Partial<NoteRow> = {}): NoteRow => ({
  id: "n1", title: "T", content: "C", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-09T10:00:00Z", ...over,
});

function fakeClient(opts: {
  updated?: NoteRow | null;
  latest?: NoteRow | null;
  updateError?: string;
  lookupError?: string;
  deleted?: NoteRow | null;
  deleteError?: string;
  inserted?: NoteRow | null;
}) {
  const calls: any[] = [];
  const client: NotesClient = {
    from: () => {
      const state: any = { filters: {} };
      const q: any = {
        select: () => { state.select = true; return q; },
        update: (p: any) => { state.op = "update"; state.patch = p; return q; },
        insert: (r: any) => { state.op = "insert"; state.row = r; return q; },
        delete: () => { state.op = "delete"; return q; },
        eq: (c: string, v: string) => { state.filters[c] = v; return q; },
        maybeSingle: async () => {
          calls.push({ ...state, filters: { ...state.filters } });
          if (state.op === "update") return opts.updateError ? { data: null, error: { message: opts.updateError } } : { data: opts.updated ?? null, error: null };
          if (state.op === "delete") return opts.deleteError ? { data: null, error: { message: opts.deleteError } } : { data: opts.deleted ?? null, error: null };
          return opts.lookupError ? { data: null, error: { message: opts.lookupError } } : { data: opts.latest ?? null, error: null };
        },
        single: async () => {
          calls.push({ ...state, filters: { ...state.filters } });
          return opts.inserted ? { data: opts.inserted, error: null } : { data: null, error: { message: "insert failed" } };
        },
      };
      return q;
    },
  };
  return { client, calls };
}

describe("saveNote", () => {
  const opened = { id: "n1", updated_at: "2026-10-09T10:00:00Z" };
  const patch = { title: "New", content: "Body" };

  it("writes only if the note is still the version that was opened", async () => {
    const { client, calls } = fakeClient({ updated: row({ title: "New", updated_at: "2026-10-09T10:05:00Z" }) });
    const out = await saveNote(client, opened, patch, () => "2026-10-09T10:05:00Z");
    expect(out.status).toBe("saved");
    expect(calls[0].filters).toEqual({ id: "n1", updated_at: "2026-10-09T10:00:00Z" });
  });

  it("reports a conflict when someone else saved in between, and writes nothing", async () => {
    const theirs = row({ title: "Theirs", updated_at: "2026-10-09T10:03:00Z" });
    const { client } = fakeClient({ updated: null, latest: theirs });
    expect(await saveNote(client, opened, patch)).toEqual({ status: "conflict", latest: theirs });
  });

  it("does not claim success when the note was deleted or access was removed", async () => {
    expect(await saveNote(fakeClient({ updated: null, latest: null }).client, opened, patch)).toEqual({ status: "gone" });
  });

  it("does not claim success when the note is visible but not writable", async () => {
    expect(await saveNote(fakeClient({ updated: null, latest: row() }).client, opened, patch)).toEqual({ status: "denied" });
  });

  it("surfaces real errors from either step", async () => {
    expect(await saveNote(fakeClient({ updateError: "JWT expired" }).client, opened, patch)).toEqual({ status: "error", message: "JWT expired" });
    expect(await saveNote(fakeClient({ updated: null, lookupError: "boom" }).client, opened, patch)).toEqual({ status: "error", message: "boom" });
  });

  it("can deliberately overwrite after a conflict by passing the latest version", async () => {
    const latest = row({ updated_at: "2026-10-09T10:03:00Z" });
    const { client, calls } = fakeClient({ updated: row({ updated_at: "2026-10-09T10:06:00Z" }) });
    await saveNote(client, { id: "n1", updated_at: latest.updated_at }, patch);
    expect(calls[0].filters.updated_at).toBe("2026-10-09T10:03:00Z");
  });
});

describe("deleteNote / createNote", () => {
  it("delete only claims success when a row was removed, and returns it for undo", async () => {
    const r = row();
    expect(await deleteNote(fakeClient({ deleted: r }).client, "n1")).toEqual({ status: "deleted", row: r });
    expect(await deleteNote(fakeClient({ deleted: null }).client, "n1")).toEqual({ status: "gone" });
    expect(await deleteNote(fakeClient({ deleteError: "nope" }).client, "n1")).toEqual({ status: "error", message: "nope" });
  });

  it("create returns the stored row or the error", async () => {
    const r = row();
    expect(await createNote(fakeClient({ inserted: r }).client, "p1", { title: "T", content: "C" })).toEqual({ status: "created", row: r });
    expect((await createNote(fakeClient({}).client, "p1", { title: "T", content: "C" })).status).toBe("error");
  });
});
