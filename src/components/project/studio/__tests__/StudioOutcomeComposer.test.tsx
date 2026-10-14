import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { StudioOutcomeComposer } from "../StudioOutcomeComposer";

/**
 * Coverage for the room's one direct-command input: Kreto's presence in its
 * header, and that "Tell Kreto what you need" is free: a recognised request is
 * placed locally without any function call, and a request the rules cannot
 * place never surfaces a payment or quota error when the router function
 * (and its AI) is unavailable.
 */

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/components/brand/KretoCharacter", () => ({
  KretoCharacter: ({ variant, size }: { variant?: string; size?: number }) => (
    <div data-testid="kreto-avatar" data-variant={variant} data-size={size} />
  ),
}));

function renderComposer() {
  return render(
    <MemoryRouter>
      <StudioOutcomeComposer projectId="p1" projectTitle="Test Project" />
    </MemoryRouter>,
  );
}

afterEach(() => {
  mocks.navigate.mockClear();
  mocks.toast.mockClear();
  mocks.invoke.mockReset();
});

describe("StudioOutcomeComposer", () => {
  it("shows Kreto's own avatar next to its direct-command line, not a generic icon", () => {
    renderComposer();
    expect(screen.getByText("Tell Kreto what you need")).toBeInTheDocument();
    const avatar = screen.getByTestId("kreto-avatar");
    expect(avatar).toHaveAttribute("data-size", "40");
  });

  it("still renders the prompt input and quick-start chips", () => {
    renderComposer();
    expect(screen.getByPlaceholderText(/Create a sponsor deck/i)).toBeInTheDocument();
    expect(screen.getByText("Sponsor deck")).toBeInTheDocument();
  });

  it("places a quick-start request on the spot: no function call, no error", async () => {
    renderComposer();
    fireEvent.click(screen.getByText("Sponsor deck"));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.navigate.mock.calls[0][0]).toMatch(/^\/desk\/p1\/thrive\/generate\?intent=sponsor_deck&brief=/);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("opens the Letter of Intent generator for the LOI chip", async () => {
    renderComposer();
    fireEvent.click(screen.getByText("Letter of Intent"));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.navigate.mock.calls[0][0]).toContain("intent=letter_of_intent");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("sends a crew search to the talent finder without a function call", async () => {
    renderComposer();
    fireEvent.click(screen.getByText("Find crew"));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.navigate.mock.calls[0][0]).toMatch(/^\/talent-finder\?q=/);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("never shows a payment error: an unplaced request whose router answers 402 opens the copilot", async () => {
    // What the production function answered before: a 402 from the AI gateway.
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("Edge Function returned a non-2xx status code (402)") });
    const opened = vi.fn();
    window.addEventListener("thrive-copilot:open", opened);
    renderComposer();
    const input = screen.getByPlaceholderText(/Create a sponsor deck/i);
    fireEvent.change(input, { target: { value: "what should I focus on this week?" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();
    window.removeEventListener("thrive-copilot:open", opened);
  });

  it("still uses the router's own answer for an unplaced request when it is available", async () => {
    mocks.invoke.mockResolvedValue({
      data: { outcome: "find_gigs", doc_intent: null, refined_brief: "paid film work", target_query: "paid film work", preview: "Searching." },
      error: null,
    });
    renderComposer();
    const input = screen.getByPlaceholderText(/Create a sponsor deck/i);
    fireEvent.change(input, { target: { value: "anything lucrative for me next month" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.navigate.mock.calls[0][0]).toBe("/scout?q=paid%20film%20work");
  });
});
