import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Sending a message is acknowledged when the message is stored, not when the recipient has been told about it. The composer used to
// stay locked for the whole push and email chain, and a failure in that chain reported "Failed to send message" for a message
// that had gone through (so the sender typed it again).
const world = vi.hoisted(() => ({
  insert: vi.fn(),
  notifyMessage: vi.fn(),
  invoke: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: world.toast }) }));
vi.mock("@/lib/analytics", () => ({ analytics: { messageSent: vi.fn() } }));
vi.mock("@/components/brand/KretopiaLoader", () => ({ KretopiaSpinner: () => <span data-testid="spinner" /> }));
vi.mock("@/lib/pushNotifications", () => ({ notifyMessage: (...args: unknown[]) => world.notifyMessage(...args) }));
vi.mock("@/integrations/supabase/client", () => {
  const rows = (data: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "or", "order", "eq", "update"]) chain[method] = () => chain;
    chain.single = async () => ({ data: { full_name: "Alex Rivera" }, error: null });
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
    return chain;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "member-1" } } }) },
      from: (table: string) => (table === "messages" ? { ...rows([]), insert: (row: unknown) => world.insert(row) } : rows(null)),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: vi.fn(),
      functions: { invoke: (...args: unknown[]) => world.invoke(...args) },
    },
  };
});

import { DirectMessageDialog } from "../DirectMessageDialog";

beforeEach(() => {
  world.insert.mockReset();
  world.insert.mockResolvedValue({ error: null });
  world.notifyMessage.mockReset();
  world.invoke.mockReset();
  world.invoke.mockResolvedValue({ data: {}, error: null });
  world.toast.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const open = async () => {
  render(<DirectMessageDialog open onOpenChange={vi.fn()} recipientId="member-2" recipientName="Sam Lee" />);
  const input = await screen.findByPlaceholderText("Type a message...");
  // The composer needs the signed-in member, which the dialog reads when it opens.
  await waitFor(() => expect(screen.getByText("No messages yet")).toBeInTheDocument());
  return input as HTMLInputElement;
};

const send = (input: HTMLInputElement, text: string) => {
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
};

describe("sending a direct message", () => {
  it("frees the composer as soon as the message is stored, even while the notification is still in flight", async () => {
    world.notifyMessage.mockImplementation(() => new Promise(() => {})); // a push that never answers
    const input = await open();
    send(input, "Are you free on Friday?");

    await waitFor(() => expect(world.insert).toHaveBeenCalledWith(expect.objectContaining({ sender_id: "member-1", receiver_id: "member-2", content: "Are you free on Friday?" })));
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(screen.queryByTestId("spinner")).toBeNull();
    expect(world.toast).not.toHaveBeenCalled();
    // The recipient is still told, with the conversation to open.
    await waitFor(() => expect(world.notifyMessage).toHaveBeenCalledWith("member-2", "Alex Rivera", "Are you free on Friday?", "member-1"));
  });

  it("does not report a sent message as failed when telling the recipient fails", async () => {
    world.notifyMessage.mockRejectedValue(new Error("push service down"));
    const input = await open();
    send(input, "Hello");

    await waitFor(() => expect(world.notifyMessage).toHaveBeenCalled());
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(world.toast).not.toHaveBeenCalled();
    expect(input.value).toBe(""); // not restored for a second send: it was sent
  });

  it("still reports a message that was not stored, and keeps the text for another try", async () => {
    world.insert.mockResolvedValue({ error: { message: "offline" } });
    const input = await open();
    send(input, "Hello");

    await waitFor(() => expect(world.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Error", description: "Failed to send message" })));
    expect(input.value).toBe("Hello");
    expect(world.notifyMessage).not.toHaveBeenCalled();
  });
});
