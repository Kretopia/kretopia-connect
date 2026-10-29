import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/**
 * The accepted-connections job that /circle's Network tab did, now on Match: both directions count once accepted,
 * each person leads to the canonical message thread, and a failed read is never shown as "no connections".
 */
let user: { id: string } | null = { id: "me" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user }) }));
vi.mock("@/components/circle/NetworkVisualization", () => ({ NetworkVisualization: () => <div data-testid="network-visual" /> }));
vi.mock("@/components/InviteCircleCard", () => ({ InviteCircleCard: () => <div data-testid="invite-card" /> }));
vi.mock("@/components/InviteDialog", () => ({ InviteDialog: () => null }));
vi.mock("@/components/circle/ConnectionList", () => ({
  ConnectionList: ({ connections, onMessage }: { connections: { user_id: string; full_name: string }[]; onMessage: (id: string) => void }) => (
    <ul>{connections.map((c) => <li key={c.user_id}><button type="button" onClick={() => onMessage(c.user_id)}>Message {c.full_name}</button></li>)}</ul>
  ),
}));

type Rows = Record<string, { data: unknown; error: unknown }>;
let rows: Rows;
const profileIds: string[][] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const ctx: { table: string; col?: string } = { table };
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (col: string) => { ctx.col = col; return Promise.resolve(rows[`${table}:${col}`]); };
      chain.in = (_c: string, ids: string[]) => { profileIds.push(ids); return Promise.resolve(rows.profiles); };
      return chain;
    },
  },
}));

import { ConnectedCollaborators } from "../ConnectedCollaborators";

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
const renderIt = () =>
  render(
    <MemoryRouter initialEntries={["/match?tab=connected"]}>
      <Routes>
        <Route path="/match" element={<ConnectedCollaborators />} />
        <Route path="/messages" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const person = (id: string, name: string) => ({ user_id: id, full_name: name, role: "Editor", bio: null, avatar_url: null, location: null, badge: "", level: 1 });

beforeEach(() => {
  user = { id: "me" };
  profileIds.length = 0;
  rows = {
    "connections:user_id": { data: [{ connected_user_id: "a", status: "accepted" }, { connected_user_id: "p", status: "pending" }], error: null },
    "connections:connected_user_id": { data: [{ user_id: "b", status: "accepted" }, { user_id: "d", status: "declined" }], error: null },
    profiles: { data: [person("a", "Ana"), person("b", "Ben")], error: null },
  };
});

describe("ConnectedCollaborators", () => {
  it("lists accepted connections from both directions and nobody pending or declined", async () => {
    renderIt();
    expect(await screen.findByText("Message Ana")).toBeInTheDocument();
    expect(screen.getByText("Message Ben")).toBeInTheDocument();
    expect(profileIds).toEqual([["a", "b"]]);
    expect(screen.queryByTestId("invite-card")).not.toBeInTheDocument();
  });

  it("continues into the canonical message thread for that person", async () => {
    renderIt();
    fireEvent.click(await screen.findByText("Message Ben"));
    expect(await screen.findByTestId("where")).toHaveTextContent("/messages?user=b");
  });

  it("with no accepted connections it invites instead of listing", async () => {
    rows["connections:user_id"] = { data: [], error: null };
    rows["connections:connected_user_id"] = { data: [], error: null };
    renderIt();
    expect(await screen.findByTestId("invite-card")).toBeInTheDocument();
    expect(profileIds).toEqual([]);
  });

  it("a failed read is an error with a retry, not an empty list", async () => {
    rows["connections:user_id"] = { data: null, error: { message: "boom" } };
    renderIt();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your connections could not be loaded.");
    expect(screen.queryByTestId("invite-card")).not.toBeInTheDocument();
    rows["connections:user_id"] = { data: [{ connected_user_id: "a", status: "accepted" }], error: null };
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Message Ana")).toBeInTheDocument();
  });

  it("a failed profile read is an error too", async () => {
    rows.profiles = { data: null, error: { message: "boom" } };
    renderIt();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("asks a guest to sign in", () => {
    user = null;
    renderIt();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/auth");
  });
});
