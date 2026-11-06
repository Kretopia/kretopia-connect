import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updates: unknown[] = [];
let rows: unknown[] = [];
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
    from: () => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      for (const m of ["eq", "order", "select"]) chain[m] = self;
      chain.update = (patch: unknown) => { updates.push(patch); return chain; };
      chain.maybeSingle = async () => ({ data: { id: "p1" }, error: null });
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok);
      return chain;
    },
    functions: { invoke: vi.fn() },
  },
}));

import { PressLinksSection } from "../PressLinksSection";

const link = (over: Record<string, unknown>) => ({ id: "p1", title: "A feature", url: "https://news.example/a", publication: "News", ...over });

describe("PressLinksSection: Featured In needs the owner's word", () => {
  beforeEach(() => {
    updates.length = 0;
  });

  it("shows a visitor only the links the owner confirmed", async () => {
    rows = [link({ id: "a", title: "Confirmed piece", owner_confirmed_at: "2026-11-01" }), link({ id: "b", title: "Found by name search" })];
    render(<PressLinksSection userId="u1" isOwnProfile={false} onRefresh={() => undefined} />);
    expect(await screen.findByText("Confirmed piece")).toBeInTheDocument();
    expect(screen.queryByText("Found by name search")).not.toBeInTheDocument();
  });

  it("shows nothing at all to a visitor when nothing is confirmed", async () => {
    rows = [link({ title: "Found by name search" })];
    const { container } = render(<PressLinksSection userId="u1" isOwnProfile={false} onRefresh={() => undefined} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("shows the owner an unconfirmed link with This is me / Not me, and confirming saves the timestamp", async () => {
    rows = [link({ title: "Found by name search" })];
    render(<PressLinksSection userId="me" isOwnProfile onRefresh={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: /Confirm this is about me/ }));
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).toEqual({ owner_confirmed_at: expect.any(String) });
    expect(screen.getByRole("button", { name: /Not me, remove/ })).toBeInTheDocument();
  });

  it("does not offer This is me on a link that is already confirmed", async () => {
    rows = [link({ owner_confirmed_at: "2026-11-01" })];
    render(<PressLinksSection userId="me" isOwnProfile onRefresh={() => undefined} />);
    await screen.findByText("A feature");
    expect(screen.queryByRole("button", { name: /Confirm this is about me/ })).not.toBeInTheDocument();
  });
});
