import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UnifiedSearchDropdown } from "../UnifiedSearchDropdown";

/**
 * The search results panel shows ONE wait indicator while a query is in
 * flight: the Kretopia K-mark loader. It used to stack a CSS border ring
 * (with a pulsing magnifier) under a second spinner, which read as two
 * loaders. These tests hold the request open so the loading state stays
 * on screen.
 */

vi.mock("@/integrations/supabase/client", () => {
  // A query that never settles keeps `loading` true for the whole test.
  const pending = () => new Promise<never>(() => undefined);
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "ilike", "or", "eq", "limit", "order"]) {
    chain[method] = () => chain;
  }
  // The chain is awaited by Promise.all, so it must be thenable and never resolve.
  chain.then = (_resolve: unknown, _reject: unknown) => pending();
  return {
    supabase: {
      from: () => chain,
      functions: { invoke: () => pending() },
    },
  };
});

vi.mock("@/hooks/useVoiceSearch", () => ({
  useVoiceSearch: () => ({
    supported: false,
    status: "idle",
    level: 0,
    errorMessage: null,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    dismissError: vi.fn(),
  }),
}));

function renderSearch() {
  return render(
    <MemoryRouter>
      <UnifiedSearchDropdown variant="hero" placeholder="Search" />
    </MemoryRouter>,
  );
}

describe("UnifiedSearchDropdown — loading state", () => {
  it("shows a single Kretopia loader while searching, with no ring and no second spinner", async () => {
    const { container } = renderSearch();
    const input = screen.getByRole("combobox", { name: /search a name, project or opportunity/i });

    fireEvent.change(input, { target: { value: "zzqx" } });

    const loader = await screen.findByRole("status", { name: /searching kretopia/i }, { timeout: 4000 });
    await waitFor(() => expect(container.querySelectorAll(".k-spinner")).toHaveLength(1));

    // One K-mark loader, nothing else spinning or ringed inside the panel.
    expect(loader.querySelectorAll(".k-spinner")).toHaveLength(1);
    const panel = screen.getByRole("region", { name: /search results/i });
    expect(panel.querySelector(".animate-spin")).toBeNull();
    expect(panel.querySelector(".animate-pulse")).toBeNull();
    expect(panel.querySelector(".border-2")).toBeNull();
    expect(screen.getByText(/checking creators, credits & gigs/i)).toBeInTheDocument();
  });
});
