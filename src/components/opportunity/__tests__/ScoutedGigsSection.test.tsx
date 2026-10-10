import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Scout's results say what they can prove and nothing else: no fit percentage,
 * no "strongest match", no floating pay advice, and no date frozen into the
 * stored sentence. What Scout matched stays, as evidence; the source and the
 * age are computed now, from the gig's own fields.
 */

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../ScoutPreferencesDialog", () => ({ ScoutPreferencesDialog: () => null }));

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const gigRows = [
  {
    id: "g1", source: "gigboard", source_name: "Remote OK", source_url: "https://remoteok.com/remote-jobs/motion-designer-nord-12345",
    title: "Motion Designer", company: "Nord", location: "Remote", remote: true, description: "Make things move.",
    full_description: "Make things move.", image_url: null, compensation: "$60k / year", contact_email: null,
    apply_url: "https://remoteok.com/remote-jobs/motion-designer-nord-12345", fit_score: 88,
    fit_reason: "Matches your “motion design” · Remote · posted yesterday · $60k / year.",
    scouted_at: hoursAgo(5), posted_at: null, details_fetched_at: null,
  },
  {
    id: "g2", source: "web", source_name: "Studio Board", source_url: "https://studio.example/jobs/video-editor-sud-2",
    title: "Video Editor", company: "Sud", location: "Lyon", remote: false, description: "Cut films.",
    full_description: "Cut films.", image_url: null, compensation: null, contact_email: null,
    apply_url: null, fit_score: 71,
    fit_reason: "Wants an editor who has cut brand films · Posted 2 days ago",
    scouted_at: hoursAgo(30), posted_at: hoursAgo(48), details_fetched_at: null,
  },
];

function builder(table: string) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gt", "order", "limit", "in", "maybeSingle", "update", "upsert"]) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    const data = table === "scouted_gigs" ? gigRows : table === "scout_preferences" ? { last_run_at: hoursAgo(0.05) } : [];
    return Promise.resolve({ data, error: null }).then(res, rej);
  };
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    functions: { invoke: vi.fn(async () => ({ data: { skipped: "throttled" }, error: null })) },
  },
}));

import { ScoutedGigsSection } from "../ScoutedGigsSection";

const renderSection = (props: { scanSurface?: "inline" | "wrapped" } = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ScoutedGigsSection {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});

const GONE = [/% fit/i, /strongest match/i, /why this fits you/i, /spend time on a pitch/i, /posted yesterday/i, /don't state their pay/i];

describe("Scout results", () => {
  it("shows no fit percentage, no superlative, no floating pay advice and no frozen date", async () => {
    renderSection();
    await screen.findAllByText("Motion Designer");
    for (const gone of GONE) expect(screen.queryByText(gone)).not.toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/\d+% fit/);
    // the stored sentence's relative date is not shown inside any evidence block
    for (const heading of screen.getAllByText("Relevant evidence")) {
      expect(heading.parentElement?.textContent ?? "").not.toMatch(/posted|yesterday|\bago\b/i);
    }
  });

  it("keeps what Scout matched, as evidence", async () => {
    renderSection();
    await screen.findAllByText("Motion Designer");
    expect(screen.getAllByText("Relevant evidence").length).toBeGreaterThan(0);
    expect(screen.getByText(/Matches your “motion design” · Remote/)).toBeInTheDocument();
  });

  it("labels model-written evidence as summarised from the listing, and engine matches as not", async () => {
    renderSection();
    await screen.findAllByText("Video Editor");
    const summarised = screen.getAllByText(/Summarised from the listing/);
    expect(summarised).toHaveLength(1); // only the web-sourced gig
  });

  it("keeps the source and a live age on the lead card and on the others", async () => {
    renderSection();
    await screen.findAllByText("Motion Designer");
    expect(screen.getAllByText(/via Remote OK/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/found .*ago/).length).toBeGreaterThan(0); // g1: no posted_at, so "found"
    expect(screen.getAllByText(/posted .*ago/).length).toBeGreaterThan(0); // g2: the board gave a date
  });

  it("keeps the pay filter and its real counts", async () => {
    renderSection();
    await screen.findAllByText("Motion Designer");
    const group = screen.getByRole("group", { name: "Pay filter" });
    expect(within(group).getByRole("button", { name: /All 2/ })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /Pay listed 1/ })).toBeInTheDocument();
  });

  it("draws Scan now in its own header by default, and leaves it to the Wrapped surface when told to", async () => {
    const inline = renderSection();
    await screen.findAllByText("Motion Designer");
    expect(screen.getAllByRole("button", { name: "Scan now" })).toHaveLength(1);
    inline.unmount();

    renderSection({ scanSurface: "wrapped" });
    await screen.findAllByText("Motion Designer");
    expect(screen.queryByRole("button", { name: "Scan now" })).not.toBeInTheDocument();
    // Tune stays with the list
    expect(screen.getByTitle("Tune scout preferences")).toBeInTheDocument();
  });

  it("the brief dialog has the same evidence, the source and no percentage", async () => {
    renderSection();
    const [title] = await screen.findAllByText("Motion Designer");
    fireEvent.click(title);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Relevant evidence")).toBeInTheDocument());
    expect(within(dialog).queryByText(/% fit/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/why this fits you/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Verify on Remote OK/)).toBeInTheDocument();
    expect(within(dialog).getByText(/via Remote OK/)).toBeInTheDocument();
  });
});
