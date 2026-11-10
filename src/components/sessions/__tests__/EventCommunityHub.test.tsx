import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../EventGuestRoster", () => ({ EventGuestRoster: () => <p>roster</p> }));
vi.mock("../EventGroupChatCard", () => ({ EventGroupChatCard: () => <p>group chat</p> }));
vi.mock("../EventInlineChat", () => ({ EventInlineChat: () => null }));
vi.mock("../EventComments", () => ({ EventComments: () => <p>comments</p> }));
vi.mock("../ContinueAsCircle", () => ({ ContinueAsCircle: () => <p>continue as circle</p> }));

import { EventCommunityHub } from "../EventCommunityHub";

const Where = () => <output data-testid="where">{useLocation().search}</output>;

const draw = (search = "") =>
  render(
    <MemoryRouter initialEntries={[`/event/e1${search}`]}>
      <EventCommunityHub
        eventId="e1" eventTitle="Studio Night" hostId="host" isCreator={false} isAuthenticated currentUserId="viewer" isParticipant
        guestMatchingEnabled isPast={false} isCompleted={false} groupChatEnabled={false} groupChatRoomId={null}
        onGroupChatChange={vi.fn()} onCircleLinked={vi.fn()}
      />
      <Where />
    </MemoryRouter>,
  );

describe("EventCommunityHub: the crew, without a second count", () => {
  it("labels the first tab without a number: the page says how many are going once, in the booking block", () => {
    draw();
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Who's Going", "Chat", "Comments"]);
  });

  it("keeps ?crew= working: the shared link opens that tab, and switching writes it back", () => {
    draw("?crew=comments");
    expect(screen.getByRole("tab", { name: "Comments" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("comments")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Chat" }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: "Chat" }));
    expect(screen.getByTestId("where")).toHaveTextContent("crew=chat");
  });

  it("opens on Who's Going when there is no ?crew=, or an unknown one", () => {
    const { unmount } = draw();
    expect(screen.getByRole("tab", { name: "Who's Going" })).toHaveAttribute("aria-selected", "true");
    unmount();
    draw("?crew=nonsense");
    expect(screen.getByRole("tab", { name: "Who's Going" })).toHaveAttribute("aria-selected", "true");
  });

  it("sets no outer margin of its own: the page's shell owns the rhythm", () => {
    const { container } = draw();
    expect(container.querySelector("section")!.className).not.toMatch(/(^|\s)m[btxy]?-\d/);
  });
});
