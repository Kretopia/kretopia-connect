import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StreamArgs = {
  onDelta: (t: string) => void;
  onError: (e: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
};
const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  load: vi.fn(),
  create: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));

vi.mock("@/lib/thriveCopilot", () => ({
  streamCopilot: (args: StreamArgs) => mocks.stream(args),
  loadConversationMessages: (id: string) => mocks.load(id),
  createConversation: () => mocks.create(),
  extractActions: () => ({ actions: [], plans: [] }),
  // Silent-failure side modes: no suggestion, no quota data in tests.
  autocompleteKreto: () => Promise.resolve(""),
  loadAiCreditOverview: () => Promise.resolve(null),
}));

import { InlineKretoChat } from "../InlineKretoChat";

/** Mirrors KretoTab: the parent owns the active conversation id. */
function Harness({ emptyState }: { emptyState?: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  return <InlineKretoChat conversationId={id} onConversationCreated={setId} emptyState={emptyState} />;
}

const send = (text: string) => {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
};

/** jsdom has no layout, so give the thread real scroll geometry. */
function giveThreadLayout(thread: HTMLElement, { scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(thread, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(thread, "clientHeight", { configurable: true, get: () => clientHeight });
  let top = scrollTop;
  Object.defineProperty(thread, "scrollTop", { configurable: true, get: () => top, set: (v: number) => { top = v; } });
  return () => top;
}

beforeEach(() => {
  mocks.stream.mockReset();
  mocks.load.mockReset().mockResolvedValue([]);
  mocks.create.mockReset().mockResolvedValue("conv-1");
  mocks.navigate.mockReset();
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

describe("InlineKretoChat", () => {
  it("navigates Search for UX Designers without planning, chatting or creating a thread", async () => {
    render(<Harness />);
    send("Search for UX Designers");
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/search?q=UX%20Designers"));
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("streams one assistant bubble and ends with the complete text", async () => {
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => {
      "Hello there, creator".split(" ").forEach((w, i) => onDelta((i ? " " : "") + w));
    });
    render(<Harness />);
    send("hi");
    await waitFor(() => expect(screen.getByText("Hello there, creator")).toBeInTheDocument());
    expect(screen.getAllByText("hi")).toHaveLength(1);
    expect(screen.getAllByRole("log")[0].children).toHaveLength(2); // user + assistant, nothing duplicated
  });

  it("does not wipe and reload the live thread when it creates its own conversation", async () => {
    // The server has not persisted the turn yet when the parent re-renders with the new id.
    mocks.load.mockResolvedValue([]);
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => {
      await new Promise((r) => setTimeout(r, 20));
      onDelta("Still here");
    });
    render(<Harness />);
    send("first message");
    await waitFor(() => expect(screen.getByText("Still here")).toBeInTheDocument());
    expect(screen.getByText("first message")).toBeInTheDocument();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("still loads history when a different conversation is opened", async () => {
    mocks.load.mockResolvedValue([{ role: "user", content: "old question" }, { role: "assistant", content: "old answer" }]);
    function Opened() {
      return <InlineKretoChat conversationId="existing" />;
    }
    render(<Opened />);
    await waitFor(() => expect(screen.getByText("old answer")).toBeInTheDocument());
    expect(mocks.load).toHaveBeenCalledWith("existing");
  });

  it("never scrolls the page: no scrollIntoView, even while streaming", async () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => {
      for (const w of ["a ", "b ", "c ", "d"]) onDelta(w);
    });
    render(<Harness />);
    send("go");
    await waitFor(() => expect(screen.getByText(/a b c d/)).toBeInTheDocument());
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps following the bottom while the reader is at the bottom", async () => {
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => onDelta("streamed"));
    render(<Harness />);
    const thread = screen.getByRole("log");
    const top = giveThreadLayout(thread, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    send("hello");
    await waitFor(() => expect(screen.getByText("streamed")).toBeInTheDocument());
    expect(top()).toBe(1000);
  });

  it("does not yank the reader back down after they scroll up, and offers Latest", async () => {
    let release!: () => void;
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => {
      onDelta("first ");
      await new Promise<void>((r) => { release = r; });
      onDelta("second");
    });
    render(<Harness />);
    const thread = screen.getByRole("log");
    const top = giveThreadLayout(thread, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    send("hello");
    await waitFor(() => expect(screen.getByText(/first/)).toBeInTheDocument());

    // The reader scrolls up to re-read something.
    act(() => { thread.scrollTop = 100; fireEvent.scroll(thread); });
    expect(screen.getByRole("button", { name: /Latest/ })).toBeInTheDocument();

    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByText(/first second/)).toBeInTheDocument());
    expect(top()).toBe(100);

    fireEvent.click(screen.getByRole("button", { name: /Latest/ }));
    expect(Element.prototype.scrollTo).toHaveBeenCalled();
  });

  it("drops the empty thinking bubble when Stop is pressed before any text", async () => {
    mocks.stream.mockImplementation(({ signal }: StreamArgs) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    );
    render(<Harness />);
    send("hello");
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument());
    expect(screen.getByText(/is thinking/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(screen.queryByText(/is thinking/)).toBeNull());
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("shows the empty state inside the thread, and replaces it with the messages", async () => {
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => onDelta("answer"));
    render(<Harness emptyState={<div>pick a starter</div>} />);
    expect(screen.getByRole("log")).toContainElement(screen.getByText("pick a starter"));
    send("hello");
    await waitFor(() => expect(screen.getByText("answer")).toBeInTheDocument());
    expect(screen.queryByText("pick a starter")).toBeNull();
  });

  it("a failed call keeps the draft in the composer and offers a retry", async () => {
    mocks.stream.mockImplementation(async ({ onError }: StreamArgs) => onError("Daily limit reached (30/30)."));
    render(<Harness />);
    send("my important draft");
    await waitFor(() => expect(screen.getByText("Daily limit reached (30/30).")).toBeInTheDocument());
    // The draft is restored, not cleared.
    expect(screen.getByRole("textbox")).toHaveValue("my important draft");
    // Retry resends the same draft.
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => onDelta("second attempt works"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("second attempt works")).toBeInTheDocument());
  });
});

describe("InlineKretoChat: Kreto model and effort", () => {
  type KretoArgs = StreamArgs & {
    profile?: string;
    effort?: number;
    confirmSupported?: boolean;
    confirmEstimate?: boolean;
    onRoute?: (route: { profile: string; effort: number; suggestEffort: number | null; notice: string | null; sharePct: number | null }) => void;
    onNeedsConfirm?: (request: { message: string; sharePct: number | null; basis: "today" | "week" }) => void;
  };
  const lastArgs = () => mocks.stream.mock.calls.at(-1)![0] as KretoArgs;
  const ASK = "This needs about 40% of what's left today. Run it?";
  const picker = (name: RegExp) => screen.getByRole("button", { name });

  beforeEach(() => localStorage.clear());

  it("sends the remembered model and effort, says it can ask, and labels the reply with what answered", async () => {
    localStorage.setItem("kreto:choice:v1", JSON.stringify({ profile: "forge", effort: 3 }));
    mocks.stream.mockImplementation(async ({ onRoute, onDelta }: KretoArgs) => {
      onRoute?.({ profile: "forge", effort: 3, suggestEffort: null, notice: null, sharePct: 4 });
      onDelta("Here is the one-pager.");
    });
    render(<Harness />);
    expect(picker(/Kreto model and effort: Kreto Forge, Deep/)).toBeInTheDocument();
    send("Draft a one-pager for the label");
    await screen.findByText("Here is the one-pager.");
    expect(lastArgs()).toMatchObject({ profile: "forge", effort: 3, confirmSupported: true, confirmEstimate: false });
    expect(screen.getByTestId("kreto-route-label")).toHaveTextContent("Kreto Forge · Deep");
  });

  it("asks before a big request: nothing shows as sent, the draft comes back, and Run it resends it confirmed", async () => {
    mocks.stream.mockImplementationOnce(async ({ onNeedsConfirm }: KretoArgs) => onNeedsConfirm?.({ message: ASK, sharePct: 40, basis: "today" }));
    render(<Harness />);
    send("Summarise my whole year");
    expect(await screen.findByTestId("kreto-confirm")).toHaveTextContent(ASK);
    expect(screen.getByRole("textbox")).toHaveValue("Summarise my whole year");
    expect(within(screen.getByRole("log")).queryByText("Summarise my whole year")).toBeNull();

    mocks.stream.mockImplementationOnce(async ({ onDelta }: KretoArgs) => onDelta("Your year, in short."));
    fireEvent.click(screen.getByRole("button", { name: "Run it" }));
    await screen.findByText("Your year, in short.");
    expect(lastArgs()).toMatchObject({ effort: 2, confirmEstimate: true });
    expect(mocks.stream).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("kreto-confirm")).toBeNull();
  });

  it("editing the draft drops the question; Use Quick runs it lighter and remembers Quick", async () => {
    mocks.stream.mockImplementation(async ({ onNeedsConfirm, onDelta, effort }: KretoArgs) => {
      if (effort === 1) onDelta("The short version.");
      else onNeedsConfirm?.({ message: ASK, sharePct: 40, basis: "today" });
    });
    render(<Harness />);
    send("Summarise my whole year");
    await screen.findByTestId("kreto-confirm");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Summarise my month" } });
    expect(screen.queryByTestId("kreto-confirm")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByTestId("kreto-confirm");
    fireEvent.click(screen.getByRole("button", { name: "Use Quick" }));
    await screen.findByText("The short version.");
    expect(lastArgs()).toMatchObject({ effort: 1, confirmEstimate: false });
    expect(JSON.parse(localStorage.getItem("kreto:choice:v1")!)).toEqual({ profile: "auto", effort: 1 });
    expect(picker(/Kreto model and effort: Auto, Quick/)).toBeInTheDocument();
  });

  it("offers a deeper pass when Kreto suggests one, and never takes it by itself", async () => {
    mocks.stream.mockImplementation(async ({ onRoute, onDelta }: KretoArgs) => {
      onRoute?.({ profile: "vision", effort: 2, suggestEffort: 3, notice: null, sharePct: null });
      onDelta("A first plan.");
    });
    render(<Harness />);
    send("Lay out my album release over three months, with a budget and the people I need");
    await screen.findByText("A first plan.");
    fireEvent.click(screen.getByRole("button", { name: "Switch to Deep" }));
    expect(picker(/Kreto model and effort: Auto, Deep/)).toBeInTheDocument();
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });

  it("the picker lists the Kreto models, shows one that is switched off as unavailable, and remembers a pick", async () => {
    render(<Harness />);
    fireEvent.click(picker(/Kreto model and effort: Auto, Balanced/));
    // Oracle stays off until the deepest tier is switched on (kretoProfilesClient.test keeps this in step with the server).
    const oracle = await screen.findByRole("radio", { name: /Kreto Oracle/ });
    expect(oracle).toBeDisabled();
    expect(oracle).toHaveTextContent("Not switched on yet");
    fireEvent.click(screen.getByRole("radio", { name: /Kreto Ledger/ }));
    fireEvent.click(screen.getByRole("button", { name: "Maximum" }));
    expect(JSON.parse(localStorage.getItem("kreto:choice:v1")!)).toEqual({ profile: "ledger", effort: 4 });
  });
});
