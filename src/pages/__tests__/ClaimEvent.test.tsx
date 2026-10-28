import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/**
 * Claiming a scouted event by link: the card comes from the token (it is not readable from the table), and the link
 * only ASKS to host, in one call. Holding it never makes anyone the host: a Kretopia curator decides, and the page says so.
 */
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const auth = { user: { id: "me" } as { id: string } | null };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));

const card = { id: "ev1", title: "Open studio night", description: "Doors at 7.", category: "meetup", venue_name: "Studio 5", venue_address: null, country: "PT", start_time: "2026-12-05T19:00:00Z", end_time: null, cover_image_url: null, claim_status: "unclaimed", scouted_by: "scout1", created_by: null, source_platform: null, source_url: null };
let cardRow: typeof card | null = card;
let requestReply: { data: unknown; error: { message: string } | null } = { data: { requested: true, verified: false, request_id: "r1" }, error: null };
const rpc = vi.fn();
const fromTables: string[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: unknown) => {
      rpc(name, args);
      if (name === "get_scouted_event_by_token") return Promise.resolve({ data: cardRow ? [cardRow] : [], error: null });
      if (name === "request_scouted_claim") return Promise.resolve(requestReply);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      fromTables.push(table);
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.insert = () => Promise.resolve({ data: null, error: null });
      q.maybeSingle = () => Promise.resolve({ data: { full_name: "Maya" }, error: null });
      return q;
    },
  },
}));

import ClaimEvent from "../ClaimEvent";

const TOKEN = "tok_evt_0123456789abcdef";
const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/claim-event/${TOKEN}`]}>
      <Routes>
        <Route path="/claim-event/:token" element={<ClaimEvent />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const requestButton = () => screen.findByRole("button", { name: /request to claim this event/i });
const calls = (name: string) => rpc.mock.calls.filter(([n]) => n === name);

beforeEach(() => {
  toast.mockClear();
  rpc.mockClear();
  fromTables.length = 0;
  sessionStorage.clear();
  auth.user = { id: "me" };
  cardRow = card;
  requestReply = { data: { requested: true, verified: false, request_id: "r1" }, error: null };
});

describe("ClaimEvent", () => {
  it("fetches the card by token through the function and never reads the table for it", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Open studio night" })).toBeInTheDocument();
    expect(calls("get_scouted_event_by_token")).toEqual([["get_scouted_event_by_token", { p_token: TOKEN }]]);
    expect(fromTables).not.toContain("creative_jams");
  });

  it("an unknown token reads as not found", async () => {
    cardRow = null;
    renderPage();
    expect(await screen.findByText(/invalid or has been removed/i)).toBeInTheDocument();
  });

  it("asks with one call and says it is a request: nobody becomes the host, nobody is told it is live, nothing opens", async () => {
    renderPage();
    fireEvent.click(await requestButton());

    expect(await screen.findByText("Request received")).toBeInTheDocument();
    expect(screen.getByText(/become its host only when they approve/i)).toBeInTheDocument();
    expect(calls("request_scouted_claim")).toEqual([["request_scouted_claim", { p_kind: "event", p_token: TOKEN }]]);
    expect(toast.mock.calls.map(([t]) => t.title)).toEqual(["Request sent"]);
    expect(toast.mock.calls[0][0].description).toMatch(/not the host until a kretopia curator verifies/i);
    expect(fromTables).not.toContain("notifications"); // "your scout was claimed, it's live" would be untrue
    expect(screen.queryByTestId("where")).not.toBeInTheDocument(); // no jump to the host's backstage
    expect(screen.queryByRole("button", { name: /request to claim this event/i })).not.toBeInTheDocument();
  });

  it("the old 'the link makes you the host' call is never made", async () => {
    renderPage();
    fireEvent.click(await requestButton());
    await screen.findByText("Request received");
    expect(calls("claim_scouted_event")).toHaveLength(0);
  });

  it("an event that already has a host, or a bad link, says so and shows no request", async () => {
    requestReply = { data: { requested: false, reason: "not_available" }, error: null };
    renderPage();
    fireEvent.click(await requestButton());
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ title: "Couldn't send the request", variant: "destructive" });
    expect(toast.mock.calls[0][0].description).toMatch(/already have a host|no longer valid/i);
    expect(screen.queryByText("Request received")).not.toBeInTheDocument();
  });

  it("too many requests waiting is said plainly", async () => {
    requestReply = { data: { requested: false, reason: "too_many_open" }, error: null };
    renderPage();
    fireEvent.click(await requestButton());
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0].description).toMatch(/several claim requests waiting/i);
  });

  it("a failing call shows its real error", async () => {
    requestReply = { data: null, error: { message: "permission denied" } };
    renderPage();
    fireEvent.click(await requestButton());
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ title: "Request failed", description: "permission denied" });
  });

  it("a guest is sent to sign in first and nothing is requested", async () => {
    auth.user = null;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /sign in to request/i }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/auth?redirect="));
    expect(sessionStorage.getItem("pending_event_claim_token")).toBe(TOKEN);
    expect(calls("request_scouted_claim")).toHaveLength(0);
  });

  it("the page never promises hosting before a curator has decided", async () => {
    renderPage();
    await requestButton();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/you're now the host|event claimed|claiming makes you the host/i);
    expect(text).toMatch(/curator checks that you organise this event/i);
  });
});
