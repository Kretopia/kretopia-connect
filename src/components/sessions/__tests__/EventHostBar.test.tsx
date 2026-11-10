import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventHostBar } from "../EventHostBar";

const draw = (over: Partial<React.ComponentProps<typeof EventHostBar>> = {}) => {
  const h = {
    onEdit: vi.fn(), onEditSections: vi.fn(), onCheckIn: vi.fn(), onShare: vi.fn(), onBackstage: vi.fn(), onCohosts: vi.fn(),
    onRecap: vi.fn(), onDownloadGuestList: vi.fn(), onMarkComplete: vi.fn(), onCancelEvent: vi.fn(),
  };
  render(<EventHostBar isPast={false} isCompleted={false} isCancelled={false} {...h} {...over} />);
  return h;
};
const openMore = () => fireEvent.keyDown(screen.getByRole("button", { name: "More host tools" }), { key: "Enter" });

describe("EventHostBar", () => {
  it("puts the everyday host actions in plain view, labelled as the host's own", () => {
    const h = draw();
    const bar = screen.getByRole("region", { name: "Host tools" });
    expect(within(bar).getByText("Only you see this.")).toBeInTheDocument();
    for (const [name, handler] of [
      ["Edit event", h.onEdit], ["Edit page sections", h.onEditSections], ["Check-in", h.onCheckIn], ["Share / QR", h.onShare],
    ] as const) {
      fireEvent.click(within(bar).getByRole("button", { name }));
      expect(handler).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps the rest one menu away: backstage, co-hosts, recap, the guest list, and closing the event", () => {
    const h = draw();
    openMore();
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Open Backstage", "Manage Co-hosts", "Post Update / Recap", "Download Guest List", "Mark Complete", "Cancel Event",
    ]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Cancel Event" }));
    expect(h.onCancelEvent).toHaveBeenCalledTimes(1);
    expect(h.onMarkComplete).not.toHaveBeenCalled();
  });

  it("offers no way to complete an event that is over, or to cancel one that is already cancelled", () => {
    draw({ isPast: true, isCancelled: true });
    openMore();
    const names = within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent);
    expect(names).not.toContain("Mark Complete");
    expect(names).not.toContain("Cancel Event");
    expect(names).toContain("Download Guest List");
  });
});
