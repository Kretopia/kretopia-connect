// The memory page shows what Kreto noted on its own (it reads these in chats) next to what the person saved, and
// deleting one removes it for good.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

const world = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  deleted: [] as Array<{ table: string; id: unknown }>,
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    const result = () => Promise.resolve({ data: world.tables[table] ?? [], error: null });
    chain.select = () => chain;
    chain.eq = (col: string, value: unknown) => {
      if (chain._deleting) {
        world.deleted.push({ table, id: value });
        return Promise.resolve({ error: null });
      }
      return chain;
    };
    chain.order = () => chain;
    chain.delete = () => ((chain._deleting = true), chain);
    chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject);
    return chain;
  };
  return { supabase: { from: (table: string) => query(table), functions: { invoke: vi.fn() } } };
});

import CopilotMemory from "../CopilotMemory";

beforeEach(() => {
  world.deleted = [];
  world.tables = {
    copilot_memories: [{ id: "m1", kind: "preference", content: "Prefers short replies", source: "manual", confidence: 1, use_count: 0, last_used_at: null, created_at: new Date().toISOString() }],
    thrive_memory: [
      { id: "n1", kind: "vendor", label: "Preferred DoP: Marcus", body: "Night shoots", created_at: new Date().toISOString() },
      { id: "n2", kind: "follow_up", label: "Send the treatment to Lena", body: null, created_at: new Date().toISOString() },
    ],
  };
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("Kreto Memory page", () => {
  it("shows what Kreto noted from chats alongside what the person saved, and says what is never kept unasked", async () => {
    render(<CopilotMemory />);
    expect(await screen.findByText("Prefers short replies")).toBeInTheDocument();
    const noted = screen.getByRole("region", { name: /Noted from your chats \(2\)/ });
    expect(within(noted).getByText("Preferred DoP: Marcus")).toBeInTheDocument();
    expect(within(noted).getByText("Send the treatment to Lena")).toBeInTheDocument();
    expect(noted).toHaveTextContent(/Money figures and contact details are kept only when you say .remember./);
  });

  it("deleting a note removes it from the store and from the page", async () => {
    render(<CopilotMemory />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete note: Preferred DoP: Marcus" }));
    await waitFor(() => expect(screen.queryByText("Preferred DoP: Marcus")).toBeNull());
    expect(world.deleted).toEqual([{ table: "thrive_memory", id: "n1" }]);
  });
});
