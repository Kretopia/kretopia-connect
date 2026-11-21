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
  account: { isAdmin: false, subscribed: false, tier: "free" },
  stream: vi.fn(),
  extract: vi.fn(),
  intent: vi.fn(),
  decide: vi.fn(),
  load: vi.fn(),
  create: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate, Link: ({ to, children }: { to: string; children?: React.ReactNode }) => <a href={to}>{children}</a> }));
vi.mock("@/lib/agentOrchestrator", () => ({
  sendAgentIntent: (...a: unknown[]) => mocks.intent(...a),
  decideAgentAction: (...a: unknown[]) => mocks.decide(...a),
}));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ isAdmin: mocks.account.isAdmin }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ subscriptionInfo: { subscribed: mocks.account.subscribed, tier: mocks.account.tier } }) }));

vi.mock("@/lib/thriveCopilot", () => ({
  streamCopilot: (args: StreamArgs) => mocks.stream(args),
  loadConversationMessages: (id: string) => mocks.load(id),
  createConversation: () => mocks.create(),
  extractActions: (raw: string) => mocks.extract(raw),
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
  mocks.account = { isAdmin: false, subscribed: false, tier: "free" };
  mocks.stream.mockReset();
  mocks.extract.mockReset().mockReturnValue({ actions: [], plans: [] });
  mocks.intent.mockReset();
  mocks.decide.mockReset();
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

  it("the picker lists the Kreto models, shows Oracle as Premium for a free account, and remembers a pick", async () => {
    render(<Harness />);
    fireEvent.click(picker(/Kreto model and effort: Auto, Balanced/));
    // Oracle needs the deepest tier: admins and Premium for now (kretoProfilesClient.test keeps this in step with the server).
    const oracle = await screen.findByRole("radio", { name: /Kreto Oracle/ });
    expect(oracle).toBeDisabled();
    expect(oracle).toHaveTextContent("On Premium for now");
    fireEvent.click(screen.getByRole("radio", { name: /Kreto Ledger/ }));
    fireEvent.click(screen.getByRole("button", { name: "Maximum" }));
    expect(JSON.parse(localStorage.getItem("kreto:choice:v1")!)).toEqual({ profile: "ledger", effort: 4 });
  });

  it("an admin or an active Premium account can pick Kreto Oracle", async () => {
    mocks.account = { isAdmin: true, subscribed: false, tier: "free" };
    const { unmount } = render(<Harness />);
    fireEvent.click(picker(/Kreto model and effort: Auto, Balanced/));
    expect(await screen.findByRole("radio", { name: /Kreto Oracle/ })).toBeEnabled();
    unmount();
    mocks.account = { isAdmin: false, subscribed: true, tier: "creator_pro" };
    render(<Harness />);
    fireEvent.click(picker(/Kreto model and effort: Auto, Balanced/));
    const oracle = await screen.findByRole("radio", { name: /Kreto Oracle/ });
    expect(oracle).toBeEnabled();
    fireEvent.click(oracle);
    expect(JSON.parse(localStorage.getItem("kreto:choice:v1")!)).toEqual({ profile: "oracle", effort: 2 });
  });

  it("sends what Kreto may see and the memory switch, and each reply says what it drew on", async () => {
    localStorage.setItem("kreto:context:v1", JSON.stringify({ context: ["projects", "money"], memory: false }));
    mocks.stream.mockImplementation(async ({ onRoute, onDelta }: KretoArgs & { context?: unknown; memory?: boolean }) => {
      onRoute?.({ profile: "ledger", effort: 2, suggestEffort: null, notice: null, sharePct: null, sources: { sections: ["projects", "money"], memories: 0, projectFacts: false } } as never);
      onDelta("Two invoices are waiting.");
    });
    render(<Harness />);
    expect(screen.getByRole("button", { name: /What Kreto can see: Projects, Money · no memory/ })).toBeInTheDocument();
    send("Which invoices are still unpaid?");
    await screen.findByText("Two invoices are waiting.");
    expect(lastArgs()).toMatchObject({ context: ["projects", "money"], memory: false });
    expect(screen.getByTestId("kreto-sources")).toHaveTextContent("From your Kretopia data: Projects, Money");
  });

  it("the context picker switches to only what I choose, ticks a part, turns memory off, and remembers it", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /What Kreto can see: Auto/ }));
    fireEvent.click(await screen.findByRole("radio", { name: /Only what I choose/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Money" }));
    fireEvent.click(screen.getByRole("switch", { name: "Use what Kreto remembers" }));
    expect(JSON.parse(localStorage.getItem("kreto:context:v1")!)).toEqual({ context: ["money"], memory: false });
    mocks.stream.mockImplementation(async ({ onDelta }: KretoArgs) => onDelta("ok"));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    send("What do I owe?");
    await screen.findByText("ok");
    expect(lastArgs()).toMatchObject({ context: ["money"], memory: false });
  });
});

describe("InlineKretoChat: actions are approved here, never sent somewhere else", () => {
  const action = (over: Record<string, unknown>) => ({ run_id: "r1", user_id: "u1", tool_args: {}, risk_level: "requires_approval", preview_body: null, ...over });
  /** A note as its parts: status chip, what, why ("Done | Create task"). */
  const notes = () => screen.getAllByTestId("kreto-action-note").map((n) => [...n.children].map((c) => c.textContent).join(" | "));

  it("a proposed action becomes an approval card under the reply; what ran or is not allowed is said plainly", async () => {
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => onDelta("On it."));
    mocks.extract.mockReturnValue({ actions: [{ intent: "assign the colour pass to Lena and add a task" }], plans: [] });
    mocks.intent.mockResolvedValue({
      run_id: "r1", status: "awaiting_approval", agent_kind: "project_manager", awaiting_approval: true,
      actions: [
        action({ id: "a1", tool_name: "assign_task", status: "proposed", preview_title: "Assign the colour pass to Lena" }),
        action({ id: "a2", tool_name: "create_task", status: "auto_executed", risk_level: "safe_auto", preview_title: "Create task \"Colour pass\"" }),
        action({ id: "a3", tool_name: "delete_project", status: "rejected", risk_level: "locked", preview_title: "Delete a project", preview_body: "Deleting a project is yours to do in the project's settings; I can't do it for you." }),
      ],
    });
    render(<Harness />);
    send("Assign the colour pass to Lena");
    expect(await screen.findByText("Assign the colour pass to Lena")).toBeInTheDocument();
    expect(mocks.intent).toHaveBeenCalledWith("assign the colour pass to Lena and add a task", { surface: "home" });
    expect(notes()).toEqual([
      "Done | Create task \"Colour pass\"",
      "Not allowed | Delete a project | Deleting a project is yours to do in the project's settings; I can't do it for you.",
    ]);
    expect(screen.queryByText(/bottom navigation/)).toBeNull();
  });

  it("approving says what really happened, including when it could not be confirmed", async () => {
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => onDelta("Ready when you are."));
    mocks.extract.mockReturnValue({ actions: [{ intent: "message the crew" }], plans: [] });
    mocks.intent.mockResolvedValue({ run_id: "r1", status: "awaiting_approval", agent_kind: "talent", awaiting_approval: true, actions: [action({ id: "a1", tool_name: "send_message", status: "proposed", preview_title: "Message the crew" })] });
    mocks.decide.mockResolvedValue({ ok: false, outcome: "unknown", message: "I couldn't confirm whether this went through. Check before trying again, so nothing happens twice." });
    render(<Harness />);
    send("Tell the crew we wrap at 6");
    fireEvent.click(await screen.findByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull());
    expect(mocks.decide).toHaveBeenCalledWith("a1", "approved");
    expect(notes()).toEqual(["Not confirmed | Message the crew | I couldn't confirm whether this went through. Check before trying again, so nothing happens twice."]);
  });

  it("a plan says nothing was started; a setup failure says so; neither claims success", async () => {
    mocks.stream.mockImplementation(async ({ onDelta }: StreamArgs) => onDelta("Here's how I'd do it."));
    mocks.extract.mockReturnValue({ actions: [{ intent: "book the studio" }], plans: [{ goal: "launch the album" }] });
    mocks.intent.mockRejectedValue(new Error("Agents disabled in your settings"));
    render(<Harness />);
    send("Plan the album launch and book the studio");
    await waitFor(() => expect(screen.getAllByTestId("kreto-action-note")).toHaveLength(2));
    expect(notes()).toEqual([
      "I've sketched a multi-step plan, but I can't run plans from this page yet, so nothing was started.",
      "Didn't go through | I couldn't set that up | Agents disabled in your settings.",
    ]);
  });
});
