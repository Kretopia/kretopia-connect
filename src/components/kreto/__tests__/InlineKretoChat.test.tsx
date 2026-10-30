import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
}));

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
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

describe("InlineKretoChat", () => {
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
