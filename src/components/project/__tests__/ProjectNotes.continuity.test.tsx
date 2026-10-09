import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { draftKey, readDraft } from "@/lib/draftStorage";

// ── in-memory project_notes + a query builder that behaves like PostgREST for the calls the editor makes ──
type Row = { id: string; project_id: string; title: string; content: string | null; created_at: string; updated_at: string };
const db = vi.hoisted(() => ({
  rows: [] as any[],
  nextId: 1,
  failNextUpdateWith: null as string | null,
}));

const toast = vi.hoisted(() => {
  const fn: any = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  return fn;
});
vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => {
  class Builder {
    op: "select" | "update" | "insert" | "delete" = "select";
    patch: any = null;
    filters: Array<[string, string]> = [];
    selecting = false;
    constructor(private table: string) {}
    select() { this.selecting = true; return this; }
    update(p: any) { this.op = "update"; this.patch = p; return this; }
    insert(r: any) { this.op = "insert"; this.patch = r; return this; }
    delete() { this.op = "delete"; return this; }
    eq(c: string, v: string) { this.filters.push([c, v]); return this; }
    order() { return this; }
    match() { return db.rows.filter((r) => this.filters.every(([c, v]) => String(r[c]) === String(v))); }
    exec(single: boolean) {
      if (this.op === "update" && db.failNextUpdateWith) {
        const message = db.failNextUpdateWith;
        db.failNextUpdateWith = null;
        return { data: null, error: { message } };
      }
      if (this.op === "insert") {
        const row = {
          id: `n${db.nextId++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          content: null, ...this.patch,
        };
        db.rows.push(row);
        return { data: row, error: null };
      }
      const hit = this.match();
      if (this.op === "update") {
        hit.forEach((r) => Object.assign(r, this.patch));
      } else if (this.op === "delete") {
        db.rows = db.rows.filter((r) => !hit.includes(r));
      }
      const out = this.op === "select" || this.selecting ? hit.map((r) => ({ ...r })) : null;
      return { data: single ? (out?.[0] ?? null) : out, error: null };
    }
    maybeSingle() { return Promise.resolve(this.exec(true)); }
    single() { return Promise.resolve(this.exec(true)); }
    then(resolve: (v: any) => void) { resolve(this.exec(false)); }
  }
  return {
    supabase: {
      from: (table: string) => new Builder(table),
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    },
  };
});

import { ProjectNotes } from "../ProjectNotes";

const P = "p1";
const seed = (over: Partial<Row> = {}): Row => ({
  id: "n0", project_id: P, title: "Brief", content: "server text",
  created_at: "2026-10-01T00:00:00.000Z", updated_at: "2026-10-09T10:00:00.000Z", ...over,
});

const body = () => screen.getByLabelText("Note content") as HTMLTextAreaElement;
const type = (text: string) => fireEvent.change(body(), { target: { value: text } });

beforeEach(() => {
  localStorage.clear();
  db.rows = [seed()];
  db.nextId = 1;
  db.failNextUpdateWith = null;
  toast.success.mockClear();
  toast.error.mockClear();
});
afterEach(() => cleanup());

async function open() {
  render(<ProjectNotes projectId={P} />);
  await screen.findByLabelText("Note content");
  await waitFor(() => expect(body().value).toBe("server text"));
}

describe("ProjectNotes work continuity", () => {
  it("keeps unsaved edits on the device and says so, then brings them back after a reload", async () => {
    await open();
    type("half-finished thought");
    await waitFor(() => expect(screen.getByText(/Unsaved changes, kept on this device/)).toBeInTheDocument(), { timeout: 3000 });
    expect(readDraft<{ content: string }>(draftKey("note", P, "n0"))?.value.content).toBe("half-finished thought");

    cleanup(); // the tab closes
    await open2();
    expect(screen.getByText(/Restored your unsaved edits/)).toBeInTheDocument();
    expect(body().value).toBe("half-finished thought");

    fireEvent.click(screen.getByRole("button", { name: "Discard them" }));
    await waitFor(() => expect(body().value).toBe("server text"));
    expect(readDraft(draftKey("note", P, "n0"))).toBeNull();
  });

  it("only says 'Saved' after the server confirmed, and then drops the local copy", async () => {
    await open();
    type("final text");
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await screen.findByText(/^Saved at /);
    expect(db.rows[0].content).toBe("final text");
    expect(toast.success).toHaveBeenCalledWith("Note saved");
    await waitFor(() => expect(readDraft(draftKey("note", P, "n0"))).toBeNull());
  });

  it("never claims success when the save fails, and keeps the text", async () => {
    await open();
    type("important edit");
    db.failNextUpdateWith = "JWT expired";
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await screen.findByText(/Couldn't save \(JWT expired\)\. Your text is kept on this device\./);
    expect(toast.success).not.toHaveBeenCalled();
    expect(db.rows[0].content).toBe("server text");
    expect(body().value).toBe("important edit");
    await waitFor(() => expect(readDraft(draftKey("note", P, "n0"))).not.toBeNull(), { timeout: 3000 });
  });

  it("detects another person's change instead of overwriting it, and offers a way out", async () => {
    await open();
    type("my version");
    // a collaborator saves first
    db.rows[0] = { ...db.rows[0], content: "their version", updated_at: "2026-10-09T10:05:00.000Z" };
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Someone else changed this note/)).toBeInTheDocument();
    expect(db.rows[0].content).toBe("their version"); // nothing was overwritten
    expect(toast.success).not.toHaveBeenCalled();
    expect(body().value).toBe("my version");

    fireEvent.click(within(alert).getByRole("button", { name: /Keep mine/ }));
    await screen.findByText(/^Saved at /);
    expect(db.rows[0].content).toBe("my version");
  });

  it("'Use theirs' takes the other version and 'save mine as a new note' keeps both", async () => {
    await open();
    type("my version");
    db.rows[0] = { ...db.rows[0], content: "their version", updated_at: "2026-10-09T10:05:00.000Z" };
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    const alert = await screen.findByRole("alert");

    fireEvent.click(within(alert).getByRole("button", { name: /Save mine as a new note/ }));
    await waitFor(() => expect(body().value).toBe("their version"));
    const copy = db.rows.find((r) => r.title.endsWith("(my version)"));
    expect(copy?.content).toBe("my version");
    expect(db.rows.find((r) => r.id === "n0")?.content).toBe("their version");
  });

  it("asks before deleting, only claims it after a row was removed, and can undo", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Delete "Brief"\?/)).toBeInTheDocument();
    expect(db.rows).toHaveLength(1); // nothing happened yet

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete note" }));
    await waitFor(() => expect(db.rows).toHaveLength(0));
    const [message, options] = toast.success.mock.calls.find((c: any[]) => /deleted/.test(c[0]))!;
    expect(message).toBe('"Brief" deleted');

    await options.action.onClick(); // Undo
    await waitFor(() => expect(db.rows).toHaveLength(1));
    expect(db.rows[0]).toMatchObject({ title: "Brief", content: "server text" });
  });

  it("does not report a delete that removed nothing", async () => {
    await open();
    db.rows = []; // already deleted elsewhere / access gone
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete note" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/already deleted|no longer have access/)));
    expect(toast.success).not.toHaveBeenCalledWith(expect.stringMatching(/deleted$/), expect.anything());
  });
});

async function open2() {
  render(<ProjectNotes projectId={P} />);
  await screen.findByLabelText("Note content");
  await waitFor(() => expect(screen.getByText(/Restored your unsaved edits/)).toBeInTheDocument());
}
