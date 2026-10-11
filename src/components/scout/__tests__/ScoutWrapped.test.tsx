import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Scout's top section: the Wrapped frame with Scout's own facts. It states only
 * what Scout does (public job boards, matched to the Passport), shows at most
 * three counts of the person's own list, and has one big action that runs the
 * same scan the For You list always ran, once per click.
 */

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const db = {
  gigs: [] as Record<string, unknown>[],
  actions: [] as Record<string, unknown>[],
  lastRunAt: hoursAgo(0.1) as string | null,
  failList: false,
};
const invoke = vi.fn();

function builder(table: string) {
  let wantsDismissed = false;
  const q: Record<string, unknown> = {};
  for (const m of ["select", "gt", "order", "limit", "maybeSingle"]) q[m] = () => q;
  q.eq = (col: string, val: unknown) => {
    if (col === "action" && val === "dismissed") wantsDismissed = true;
    return q;
  };
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    if (db.failList && table === "scouted_gigs") return Promise.resolve({ data: null, error: { message: "boom" } }).then(res, rej);
    let data: unknown = [];
    if (table === "scouted_gigs") data = db.gigs;
    else if (table === "scouted_gig_actions") data = wantsDismissed ? db.actions.filter((a) => a.action === "dismissed") : db.actions;
    else if (table === "scout_preferences") data = db.lastRunAt ? { last_run_at: db.lastRunAt } : null;
    return Promise.resolve({ data, error: null }).then(res, rej);
  };
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => builder(t),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

import { ScoutScanProvider } from "../ScoutScanProvider";
import { ScoutWrapped } from "../ScoutWrapped";

const gigRow = (id: string, over: Record<string, unknown> = {}) => ({
  id, source: "gigboard", source_name: "Remote OK", source_url: `https://remoteok.com/remote-jobs/${id}-motion`, title: `Gig ${id}`,
  company: "Nord", location: "Remote", remote: true, description: "Make things move for a long programme of brand work.",
  full_description: null, image_url: null, compensation: null, contact_email: null, apply_url: `https://remoteok.com/remote-jobs/${id}-motion`,
  fit_score: 80, fit_reason: "Matches your motion", scouted_at: hoursAgo(72), posted_at: null, deadline: null, details_fetched_at: null, ...over,
});

const onSelectTab = vi.fn();
const renderWrapped = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ScoutScanProvider>
          <ScoutWrapped onSelectTab={onSelectTab} />
        </ScoutScanProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.assign(db, { gigs: [gigRow("a")], actions: [], lastRunAt: hoursAgo(0.1), failList: false });
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { skipped: "throttled" }, error: null });
  onSelectTab.mockReset();
});

const scanButton = () => screen.getByRole("button", { name: /Scan now|Scanning job boards|Checking job boards|Try again/ });

describe("ScoutWrapped", () => {
  it("is Scout's Wrapped frame: eyebrow, title, a truthful sentence and when Scout last checked", async () => {
    renderWrapped();
    expect(screen.getByRole("region", { name: /Find your next opportunity/ })).toBeInTheDocument();
    expect(screen.getByText("Scout")).toBeInTheDocument();
    expect(screen.getByText(/Scout checks public job boards for roles that match your Passport\. It never applies for you\./)).toBeInTheDocument();
    expect(await screen.findByText(/Checked .*ago/)).toBeInTheDocument();
  });

  it("claims no source it cannot show and no score", async () => {
    renderWrapped();
    await screen.findByText(/Checked/);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/LinkedIn|Instagram|\bATS\b|across the web|AI found|\d+% fit|strongest/i);
  });

  it("Scan now is the dominant action and runs the existing scan once per click", async () => {
    renderWrapped();
    await screen.findByText(/Checked/);
    const button = scanButton();
    expect(button).toHaveTextContent("Scan now");
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith("scout-gigs", { body: { trigger: "manual" } });
  });

  it("shows progress in place while it runs, and is not clickable meanwhile", async () => {
    let finish: (v: unknown) => void = () => {};
    invoke.mockReturnValueOnce(new Promise((r) => { finish = r; }));
    renderWrapped();
    await screen.findByText(/Checked/);
    fireEvent.click(scanButton());
    await waitFor(() => expect(scanButton()).toHaveTextContent("Scanning job boards…"));
    expect(scanButton()).toBeDisabled();
    expect(scanButton()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/elapsed\. New gigs appear below/)).toBeInTheDocument();
    await act(async () => { finish({ data: { inserted: 2, filtered: 5, queries: 3 }, error: null }); });
    await waitFor(() => expect(scanButton()).toHaveTextContent("Scan now"));
    expect(screen.getByRole("status")).toHaveTextContent("Found 2 new gigs");
  });

  it("says when it could not refresh, and offers Try again", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error("Edge Function returned a non-2xx status code") });
    renderWrapped();
    await screen.findByText(/Checked/);
    fireEvent.click(scanButton());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Couldn't refresh opportunities/));
    expect(scanButton()).toHaveTextContent("Try again");
    expect(scanButton()).toBeEnabled();
  });

  it("shows only counts of rows that exist, at most four, each switching to its tab", async () => {
    db.gigs = [gigRow("a", { scouted_at: hoursAgo(2) }), gigRow("b"), gigRow("c")];
    db.actions = [
      { scouted_gig_id: "a", action: "apply_clicked", outcome: null },
      { scouted_gig_id: "b", action: "saved", outcome: null },
      { scouted_gig_id: "x", action: "applied", outcome: "pending" },
    ];
    renderWrapped();
    const list = await screen.findByRole("list", { name: "Scout priority signals" });
    const tiles = within(list).getAllByRole("button");
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveTextContent("1application started");
    expect(tiles[1]).toHaveTextContent("1gig saved to review");
    expect(tiles[2]).toHaveTextContent("1application awaiting an outcome");
    expect(tiles[3]).toHaveTextContent("1gig found in the last 24 h");
    fireEvent.click(tiles[1]);
    expect(onSelectTab).toHaveBeenCalledWith("shortlist");
  });

  it("has no signal row at all when there is nothing to count", async () => {
    db.gigs = [];
    renderWrapped();
    await screen.findByText(/Checked/);
    expect(screen.queryByRole("list", { name: "Scout priority signals" })).not.toBeInTheDocument();
  });

  it("Scan now is the only action: no saved-opportunities button, even when something is saved", async () => {
    db.actions = [{ scouted_gig_id: "b", action: "saved", outcome: null }];
    renderWrapped();
    await screen.findByText(/Checked/);
    expect(screen.queryByRole("button", { name: /View saved opportunities/ })).not.toBeInTheDocument();
    expect(scanButton()).toBeInTheDocument();
  });

  it("says so when the list could not be read, instead of showing an empty list as nothing found", async () => {
    db.failList = true;
    renderWrapped();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load your opportunities/);
    expect(screen.getByText(/Couldn't load your list/)).toBeInTheDocument();
  });

  it("states the automatic re-check honestly, from the real interval", async () => {
    renderWrapped();
    expect(screen.getByText(/checks again every 10 minutes/)).toBeInTheDocument();
  });
});
