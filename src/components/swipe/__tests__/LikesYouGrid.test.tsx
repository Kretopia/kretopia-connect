import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

/**
 * Incoming interest: answering writes one swipe row. That proves an answer was saved, not that a connection exists, so a
 * right answer must not announce "a match", and a failed write must leave the person in the list.
 */
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const me = { id: "me" }; // one stable object: the grid reloads whenever the user object changes
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: me }) }));

let insertResult: { error: unknown } = { error: null };
const inserts: unknown[] = [];
const results: Record<string, unknown> = {
  "swipes:incoming": { data: [{ user_id: "p1", created_at: "2026-10-01" }] },
  "swipes:outgoing": { data: [] },
  profiles: { data: [{ user_id: "p1", full_name: "Priya Rao", role: "Editor", location: "Mumbai", avatar_url: null }] },
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let key = table;
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      for (const m of ["eq", "order", "limit", "in"]) chain[m] = self;
      chain.select = (cols: string) => { if (table === "swipes") key = cols.includes("created_at") ? "swipes:incoming" : "swipes:outgoing"; return chain; };
      chain.insert = async (row: unknown) => { inserts.push(row); return insertResult; };
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(results[key]).then(ok);
      return chain;
    },
  },
}));

import { LikesYouGrid } from "../LikesYouGrid";

const renderGrid = () => render(<MemoryRouter><LikesYouGrid /></MemoryRouter>);

beforeEach(() => {
  toast.mockClear();
  inserts.length = 0;
  insertResult = { error: null };
});

describe("LikesYouGrid answers", () => {
  it("a right answer saves one swipe and says interest was saved, never that it is a match", async () => {
    renderGrid();
    fireEvent.click(await screen.findByRole("button", { name: /match/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(inserts).toEqual([{ user_id: "me", target_id: "p1", target_type: "profile", direction: "right" }]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Interest saved" }));
    expect(JSON.stringify(toast.mock.calls)).not.toMatch(/it's a match/i);
    await waitFor(() => expect(screen.queryByText("Priya Rao")).not.toBeInTheDocument());
  });

  it("a failed write is reported and the person stays in the list", async () => {
    insertResult = { error: { message: "denied" } };
    renderGrid();
    fireEvent.click(await screen.findByRole("button", { name: /match/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't save that", variant: "destructive" })));
    expect(screen.getByText("Priya Rao")).toBeInTheDocument();
  });
});
