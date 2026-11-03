import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { allowanceFrom } from "@/lib/aiAllowance";
import type { AiCreditOverview } from "@/lib/thriveCopilot";

const h = vi.hoisted(() => ({ overview: null as unknown, stream: vi.fn(), navigate: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@/lib/thriveCopilot", () => ({
  streamCopilot: (args: unknown) => h.stream(args),
  loadConversationMessages: () => Promise.resolve([]),
  createConversation: () => Promise.resolve("conv-1"),
  extractActions: () => ({ actions: [], plans: [] }),
  autocompleteKreto: () => Promise.resolve(""),
  loadAiCreditOverview: () => Promise.resolve(h.overview),
}));

import { InlineKretoChat } from "../InlineKretoChat";
import { KretoQuotaIndicator } from "../KretoQuotaIndicator";

const NOW = new Date("2026-11-03T18:48:00Z");
const overview = (messages: Partial<AiCreditOverview["mine"][number]> = {}): AiCreditOverview => ({
  envelope: { day: "2026-11-03", credits_used: 10, credits_cap: 1000, credits_reserved: 0, denials_allowance: 0, denials_budget: 0 },
  features: [],
  mine: [{ feature: "kreto_message", used: 5, cap: 20, reserved: 0, ...messages }],
});

beforeEach(() => {
  h.stream.mockReset();
  h.navigate.mockReset();
  h.overview = null;
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

describe("KretoQuotaIndicator", () => {
  it("renders nothing without an allowance", () => {
    const { container } = render(<KretoQuotaIndicator allowance={null} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows what is left and when it resets, in one quiet line", () => {
    render(<KretoQuotaIndicator allowance={allowanceFrom(overview(), NOW)} now={NOW} />);
    const line = screen.getByTestId("kreto-allowance");
    expect(line).toHaveTextContent("15 of 20 messages left today");
    expect(line).toHaveTextContent("resets in 5 h 12 min (midnight UTC)");
    expect(screen.queryByTestId("kreto-allowance-blocked")).toBeNull();
  });

  it("says it plainly when the next message would be refused, with when it comes back", () => {
    render(<KretoQuotaIndicator allowance={allowanceFrom(overview({ used: 20 }), NOW)} now={NOW} />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("You've used today's 20 of 20 Kreto messages.");
    expect(notice).toHaveTextContent("It resets at midnight UTC, in 5 h 12 min");
  });
});

describe("the Kreto composer when the allowance is used up", () => {
  const type = (text: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });

  it("explains the limit and its reset, and will not send, while keeping what was typed", async () => {
    h.overview = overview({ used: 20 });
    render(<InlineKretoChat conversationId={null} onConversationCreated={() => {}} />);
    expect(await screen.findByTestId("kreto-allowance-blocked")).toHaveTextContent("You've used today's 20 of 20 Kreto messages.");
    type("Draft me an email to a client");
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    expect(send.getAttribute("aria-describedby")).toBe("kreto-allowance-notice");
    fireEvent.submit(send.closest("form")!);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(h.stream).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("Draft me an email to a client");
    expect(screen.getByRole("textbox").getAttribute("placeholder")).toContain("paused until the allowance resets");
  });

  it("still navigates: going to a page needs no model, so it costs nothing and is not blocked", async () => {
    h.overview = overview({ used: 20 });
    render(<InlineKretoChat conversationId={null} onConversationCreated={() => {}} />);
    await screen.findByTestId("kreto-allowance-blocked");
    type("Search for UX Designers");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/search?q=UX%20Designers"));
    expect(h.stream).not.toHaveBeenCalled();
  });

  it("lets a person with allowance left send as usual", async () => {
    h.overview = overview({ used: 5 });
    h.stream.mockImplementation(async ({ onDelta, onDone }: { onDelta: (t: string) => void; onDone: () => void }) => {
      onDelta("Sure.");
      onDone();
    });
    render(<InlineKretoChat conversationId={null} onConversationCreated={() => {}} />);
    await screen.findByTestId("kreto-allowance");
    type("Draft me an email to a client");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(h.stream).toHaveBeenCalledTimes(1));
  });
});
