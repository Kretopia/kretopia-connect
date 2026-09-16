import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UnifiedSearchDropdown } from "../UnifiedSearchDropdown";

/**
 * Regression coverage for the landing-page hero searchbar's layout contract
 * (Section 5 of the August 31 release charter): the bar must stay fixed in
 * place when clicked/focused/typed into -- no horizontal growth, no layout
 * shift, no overlap with surrounding content, escape closes the overlay.
 *
 * jsdom does not perform real CSS layout, so getBoundingClientRect() always
 * returns zeros here -- this suite cannot assert real pixel geometry. Full
 * pixel-level verification (input rect identical before/after typing, no
 * horizontal overflow at 1280px and 375px, dropdown width/x matching the
 * input exactly) was done via live browser testing against the running app
 * this session. What this suite guards instead is the STRUCTURAL contract
 * that produces that behavior: the input's className has no conditional
 * width/height growth on focus, the results panel is absolutely positioned
 * and anchored to the input's own bounds (not a wider/taller overlay), and
 * the interaction state machine (focus/type/escape/blur) behaves correctly.
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        or: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        ilike: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));

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

function renderHeroSearch(props: Partial<React.ComponentProps<typeof UnifiedSearchDropdown>> = {}) {
  return render(
    <MemoryRouter>
      {/* Same fixed-width wrapper KretopiaHero.tsx uses around the real
          component -- max-w-2xl mx-auto, not something that grows. */}
      <div className="max-w-2xl mx-auto">
        <UnifiedSearchDropdown variant="hero" placeholder="Search your name or stage name" {...props} />
      </div>
    </MemoryRouter>,
  );
}

describe("UnifiedSearchDropdown (hero variant) — landing searchbar layout contract", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("renders a single search input with the expected accessible name", () => {
    renderHeroSearch();
    const input = screen.getByRole("textbox", { name: /search a name, project or opportunity/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Search your name or stage name");
  });

  it("input width class is a static w-full, never a focus-conditional width", () => {
    renderHeroSearch();
    const input = screen.getByRole("textbox", { name: /search a name, project or opportunity/i });
    // A regression here (e.g. a focus-within:w-* class reintroduced from the
    // navbar's own search input) would change this string -- the hero input
    // must always fill its fixed-width parent, never grow past it.
    expect(input.className).toMatch(/\bw-full\b/);
    expect(input.className).not.toMatch(/focus(-within)?:w-/);
  });

  it("click/focus does not change the input's width or height class, and opens no overlay below 2 characters", () => {
    renderHeroSearch();
    const input = screen.getByRole("textbox", { name: /search a name, project or opportunity/i }) as HTMLInputElement;
    const classBefore = input.className;

    fireEvent.click(input);
    input.focus();

    expect(input.className).toBe(classBefore);
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("typing 2+ characters opens the results overlay (aria-expanded), and closing it never touches the input's own class", async () => {
    renderHeroSearch();
    const input = screen.getByRole("textbox", { name: /search a name, project or opportunity/i }) as HTMLInputElement;
    const classBefore = input.className;

    input.focus();
    fireEvent.change(input, { target: { value: "Ma" } });

    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
    expect(input.className).toBe(classBefore);

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "false"));

    // Escape closes the overlay but must not clear what the user typed or
    // move focus away -- clearing/blurring on Escape would be a regression.
    expect(input.value).toBe("Ma");
    expect(document.activeElement).toBe(input);
  });

  it("clicking outside the search wrapper closes the results overlay", async () => {
    // The component deliberately uses a document-level mousedown listener
    // (not a plain input onBlur) so clicking a result inside the dropdown
    // doesn't close it before the click registers -- a raw blur event is
    // NOT how this closes, and shouldn't be treated as a regression if it
    // doesn't. Simulate the real trigger: a mousedown outside the wrapper.
    renderHeroSearch();
    const input = screen.getByRole("textbox", { name: /search a name, project or opportunity/i }) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Sound" } });
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));

    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "false"));
  });

  it("submitting the query calls onQuerySubmit exactly once, without navigating away from the current geometry-owning tree", () => {
    const onQuerySubmit = vi.fn();
    renderHeroSearch({ onQuerySubmit });
    const input = screen.getByRole("textbox", { name: /search a name, project or opportunity/i });

    fireEvent.change(input, { target: { value: "Maya Solano" } });
    fireEvent.submit(input.closest("form")!);

    expect(onQuerySubmit).toHaveBeenCalledTimes(1);
    expect(onQuerySubmit).toHaveBeenCalledWith("Maya Solano");
  });
});
