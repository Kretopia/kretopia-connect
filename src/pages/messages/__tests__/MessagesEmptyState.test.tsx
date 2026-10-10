import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MessagesEmptyState } from "../MessagesEmptyState";
import type { Conversation } from "../types";

vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => ({ isBusiness: false, pick: (a: string) => a }) }));

const conv = (over: Partial<Conversation>): Conversation => ({
  conversation_id: "c",
  message_id: "m",
  sender_id: "other",
  receiver_id: "me",
  content: "hi",
  created_at: "2026-10-01T10:00:00Z",
  read: true,
  sender_name: "Sam Rivera",
  sender_avatar: "",
  receiver_name: "Me",
  receiver_avatar: "",
  match_id: null,
  ...over,
});

const setup = (conversations: Conversation[], onOpen = vi.fn(), onCreateGroup = vi.fn()) => {
  render(
    <MemoryRouter>
      <MessagesEmptyState conversations={conversations} currentUserId="me" onOpen={onOpen} onCreateGroup={onCreateGroup} />
    </MemoryRouter>,
  );
  return { onOpen, onCreateGroup };
};

describe("MessagesEmptyState", () => {
  it("pushes a first message when the inbox is empty", () => {
    const { onCreateGroup } = setup([]);
    expect(screen.getByRole("button", { name: /find someone to message/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start a group/i }));
    expect(onCreateGroup).toHaveBeenCalled();
  });

  it("offers the latest person by first name and opens that thread", () => {
    const { onOpen } = setup([
      conv({ message_id: "old", sender_id: "a", sender_name: "Old Contact", created_at: "2026-09-01T10:00:00Z" }),
      conv({ message_id: "new", sender_id: "u2" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /message sam/i }));
    expect(onOpen).toHaveBeenCalledWith("u2");
  });

  it("shows the four steps without an orbiting ring", () => {
    const { container } = render(
      <MemoryRouter>
        <MessagesEmptyState conversations={[]} currentUserId="me" onOpen={vi.fn()} onCreateGroup={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Open your inbox")).toBeInTheDocument();
    expect(container.querySelector(".ai-orbit-ring")).toBeNull();
  });
});
