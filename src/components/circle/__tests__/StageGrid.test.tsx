import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "member" } as { id: string } | null, loading: false },
  rows: { sound_stages: [] as unknown[], curated_stages: [] as unknown[] },
  errors: { sound_stages: null as Error | null, curated_stages: null as Error | null },
  removeChannel: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: keyof typeof mocks.rows) => {
      const query: Record<string, unknown> & { then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise<unknown> } = {
        select: () => query,
        eq: () => query,
        in: () => query,
        lte: () => query,
        gte: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve, reject) => Promise.resolve({
          data: mocks.rows[table],
          error: mocks.errors[table],
        }).then(resolve, reject),
      };
      return query;
    },
    channel: () => ({
      on() { return this; },
      subscribe() { return this; },
    }),
    removeChannel: mocks.removeChannel,
  },
}));

import { StageGrid } from "../StageGrid";

const renderGrid = (onOpenStage = vi.fn()) => render(
  <MemoryRouter>
    <StageGrid onJoinSoundStage={() => {}} onOpenStage={onOpenStage} />
  </MemoryRouter>,
);

beforeEach(() => {
  mocks.auth = { user: { id: "member" }, loading: false };
  mocks.rows.sound_stages = [];
  mocks.rows.curated_stages = [];
  mocks.errors.sound_stages = null;
  mocks.errors.curated_stages = null;
  mocks.removeChannel.mockClear();
});

describe("StageGrid empty state", () => {
  it("keeps the schedule link readable and wires opening to the real stage action", async () => {
    const onOpenStage = vi.fn();
    renderGrid(onOpenStage);

    expect(await screen.findByText("Nothing live right now")).toBeInTheDocument();
    expect(screen.getByText("Check what’s scheduled, or open your own stage.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse upcoming sessions" })).toHaveAttribute("href", "#call-sheet");
    fireEvent.click(screen.getByRole("button", { name: "Open a Sound Stage" }));
    expect(onOpenStage).toHaveBeenCalledOnce();
  });

  it("shows a real retry after a load error", async () => {
    mocks.errors.sound_stages = new Error("offline");
    renderGrid();
    expect(await screen.findByText("Couldn't load stages")).toBeInTheDocument();

    mocks.errors.sound_stages = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Nothing live right now")).toBeInTheDocument());
  });
});

describe("StageGrid for a visitor who is not signed in", () => {
  it("says to sign in, with the way in, instead of a load error with a Retry that can't work", async () => {
    mocks.auth = { user: null, loading: false };
    mocks.errors.sound_stages = new Error("permission denied for table sound_stages");
    renderGrid();

    expect(await screen.findByText("Sign in to see what's live")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load stages")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth?tab=signin&redirect=%2Fcircle%3Ftab%3Dlive");
    expect(screen.getByRole("link", { name: "Join Kretopia" })).toHaveAttribute("href", "/start?next=%2Fcircle%3Ftab%3Dlive&src=stages");
  });

  it("waits for the session before deciding: a member who is still loading sees the plain error, never the sign-in card", async () => {
    mocks.auth = { user: null, loading: true };
    mocks.errors.sound_stages = new Error("offline");
    renderGrid();
    expect(await screen.findByText("Couldn't load stages")).toBeInTheDocument();
    expect(screen.queryByText("Sign in to see what's live")).not.toBeInTheDocument();
  });

  it("a visitor who can read the list (nothing blocks it) sees the list, not the sign-in card", async () => {
    mocks.auth = { user: null, loading: false };
    renderGrid();
    expect(await screen.findByText("Nothing live right now")).toBeInTheDocument();
    expect(screen.queryByText("Sign in to see what's live")).not.toBeInTheDocument();
  });
});
