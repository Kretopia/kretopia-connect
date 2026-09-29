import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { CreatorWorkHome } from "@/pages/CreatorWorkHome";

/**
 * Smoke coverage for the Studio-local Today/Work/Library/Inbox tab strip
 * added to CreatorWorkHome (the /desk dashboard for individual creators).
 * /desk itself is behind ProtectedRoute and talks to the real production
 * Supabase project, so it can't be click-through-verified live without a
 * real signed-in account (see project_pending_studio_tabs_live_test memory
 * note) -- this exercises the exact same component tree with a fully
 * mocked, offline Supabase client instead, following the same mocking
 * pattern VoiceFirstCreateModal.test.tsx already uses.
 *
 * A generic chainable/thenable query-builder stub (rather than hand-
 * modeling each .select().eq().order() shape CreatorWorkHome's several
 * effects use) keeps this robust to any query shape landing on an empty,
 * successful result -- the point of this test is "the four tabs mount
 * and switch," not asserting on fetched data itself (StudioLibraryTab
 * and StudioInboxTab each get their own focused data-rendering tests).
 */

const TABLE_DATA: Record<string, any[]> = {
  projects: [
    { id: "p1", title: "Carnival Film", status: "active", mood: "creative", updated_at: new Date().toISOString(), created_by: "test-user-id" },
  ],
  studio_folders: [],
  invoices: [],
  project_collaborators: [],
  project_files: [],
  project_messages: [],
  profiles: [{ user_id: "test-user-id", full_name: "Test User", avatar_url: null, created_at: "2020-01-01T00:00:00Z", xp: 999 }],
};

function makeBuilder(data: any[]): any {
  const result = { data, error: null, count: data.length };
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    is: () => builder,
    gte: () => builder,
    lte: () => builder,
    not: () => builder,
    or: () => builder,
    single: () => Promise.resolve({ data: data[0] ?? null, error: null }),
    maybeSingle: () => Promise.resolve({ data: data[0] ?? null, error: null }),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(TABLE_DATA[table] ?? []),
    rpc: (fn: string) => {
      if (fn === "get_project_people") return Promise.resolve({ data: [], error: null });
      if (fn === "can_see_milestone_money") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "test-user-id" } }, error: null }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

// A single stable object, not a fresh `{ id: ... }` literal per call --
// TodayStrip's own effect depends on `[user]` (the whole object, not
// user.id), so a mock that hands back a new reference on every render
// makes that effect re-run every render forever: setState -> re-render ->
// useAuth() called again -> new user object -> effect deps changed ->
// setState again, an infinite loop pinning CPU rather than a hang.
const mockUser = { id: "test-user-id" };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, session: null, loading: false }),
}));

// useStudioGlobalModals renders VoiceFirstCreateModal (closed) unconditionally,
// which pulls in extractBriefDocument.ts -> pdfjs-dist at module scope; that
// needs DOMMatrix, a real browser Canvas API jsdom doesn't provide. None of
// these tests touch file upload, so this mock avoids the environment gap
// entirely, same fix VoiceFirstCreateModal.test.tsx already uses.
vi.mock("@/lib/extractBriefDocument", () => ({
  compressImage: vi.fn(async () => ({ base64: "", mime: "image/jpeg" })),
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/desk"]}>
        <CreatorWorkHome />
      </MemoryRouter>
    </HelmetProvider>,
  );

// Radix's TabsTrigger activates on onMouseDown (or onFocus for keyboard/
// roving-focus navigation) -- see @radix-ui/react-tabs's TabsTrigger --
// not on a bare "click" event, which is all fireEvent.click dispatches in
// jsdom. fireEvent.mouseDown is what a real pointer click implies here.
describe("CreatorWorkHome — Studio-local Today/Work/Library/Inbox tabs", () => {
  it("renders all four tab triggers once loaded", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Today/ })).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /Work/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Library/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Inbox/ })).toBeInTheDocument();
  });

  it("defaults to the Work tab, showing the Projects dashboard, not an empty Today glance", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Work/ })).toHaveAttribute("data-state", "active"));
    expect(screen.getByText("Carnival Film")).toBeInTheDocument();
  });

  it("switches to Today and shows the glance strip + pulse section, not the Projects list", async () => {
    renderPage();
    await waitFor(() => screen.getByRole("tab", { name: /Today/ }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Today/ }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /Today/ })).toHaveAttribute("data-state", "active"));
    expect(screen.getByRole("heading", { name: "Right now" })).toBeInTheDocument();
  });

  it("switches to Library and shows its empty state with real data absent", async () => {
    renderPage();
    await waitFor(() => screen.getByRole("tab", { name: /Library/ }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Library/ }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /Library/ })).toHaveAttribute("data-state", "active"));
    await waitFor(() => expect(screen.getByText("Nothing dropped yet")).toBeInTheDocument());
  });

  it("switches to Inbox and shows its empty state with no messages", async () => {
    renderPage();
    await waitFor(() => screen.getByRole("tab", { name: /Inbox/ }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Inbox/ }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /Inbox/ })).toHaveAttribute("data-state", "active"));
    await waitFor(() => expect(screen.getByText("No conversations yet")).toBeInTheDocument());
  });
});
