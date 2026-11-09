import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: { sound_stages: [] as unknown[], curated_stages: [] as unknown[] },
  errors: { sound_stages: null as Error | null, curated_stages: null as Error | null },
  removeChannel: vi.fn(),
}));

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
