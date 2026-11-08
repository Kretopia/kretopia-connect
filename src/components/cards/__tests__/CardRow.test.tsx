import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MapPin, Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { CardPill } from "../CardShell";
import { CardRow, type CardRowProps } from "../CardRow";
import { CARD_ROW_BUDGET } from "../cardTokens";

const LONG = "A very long line about a person or a place that goes on and on and on, with far more words than a row has room for, ".repeat(5);

const draw = (over: Partial<CardRowProps> = {}) =>
  render(
    <MemoryRouter>
      <CardRow testId="row" title="Ana Ruiz" {...over} />
    </MemoryRouter>,
  );
const row = () => screen.getByTestId("row");
const part = (name: string) => row().querySelector<HTMLElement>(`[data-card-part="${name}"]`);

describe("CardRow: the compact form of the shared card", () => {
  it("has the card's frame (radius, border, fill) and no tilt or flip of its own", () => {
    draw();
    expect(row().className).toContain("rounded-2xl");
    expect(row().className).toContain("border-border");
    expect(row().className).toContain("bg-card");
    expect(row().className).not.toMatch(/shadow-/);
    expect(row().querySelector("[data-flipped]")).toBeNull();
    expect(row().querySelector('[class*="perspective"]')).toBeNull();
  });

  it("keeps to its budget however much it is given: two lines of title, one of meta, two of description, four tags", () => {
    draw({ title: LONG, meta: LONG, description: LONG, tags: Array.from({ length: 9 }, (_, i) => <CardPill key={i}>tag {i}</CardPill>) });
    expect(part("title")!.className).toContain("line-clamp-2");
    expect(part("meta")!.className).toContain("truncate");
    expect(part("description")!.className).toContain("line-clamp-2");
    expect(within(part("tags")!).getAllByText(/^tag \d$/).map((t) => t.textContent)).toEqual(["tag 0", "tag 1", "tag 2", "tag 3"]);
    expect(CARD_ROW_BUDGET.tags).toBe(4);
  });

  it("drops what is empty instead of leaving a gap", () => {
    draw({ tags: [null, false, undefined] });
    for (const name of ["lead", "eyebrow", "meta", "description", "tags", "extra", "actions", "controls", "trailing"]) expect(part(name), name).toBeNull();
  });

  it("makes the whole row one real link in the app, or a button, with the title as its name", () => {
    const { unmount } = draw({ open: { to: "/profile/a" } });
    const link = screen.getByRole("link", { name: "Ana Ruiz" });
    expect(link).toHaveAttribute("href", "/profile/a");
    expect(link.className).toContain("after:absolute");
    unmount();
    const onClick = vi.fn();
    draw({ open: { onClick } });
    fireEvent.click(screen.getByRole("button", { name: "Ana Ruiz" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is not a target at all without one: the title is plain text and nothing stretches over the row", () => {
    draw();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(part("title")!.tagName).toBe("SPAN");
    expect(part("title")!.className).not.toContain("after:absolute");
  });

  it("marks the row a map or list has chosen: ringed, and announced as the current one", () => {
    const { unmount } = draw({ open: { onClick: vi.fn() }, selected: true });
    expect(row().className).toContain("ring-2");
    expect(row()).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "Ana Ruiz" })).toHaveAttribute("aria-current", "true");
    unmount();
    draw({ open: { onClick: vi.fn() } });
    expect(row().className).not.toContain("ring-2");
    expect(screen.getByRole("button", { name: "Ana Ruiz" })).not.toHaveAttribute("aria-current");
  });

  it("keeps controls above the row's link, so pressing one never opens the row", () => {
    const open = vi.fn();
    const remove = vi.fn();
    draw({ open: { onClick: open }, controls: <button type="button" aria-label="Remove" onClick={remove}><Trash2 aria-hidden /></button> });
    const control = screen.getByRole("button", { name: "Remove" });
    expect(control.parentElement!.className).toContain("z-[3]");
    fireEvent.click(control);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it("keeps decoration under the row's link, so pressing it opens the row", () => {
    draw({ open: { to: "/x" }, trailing: <span data-testid="chevron">›</span> });
    expect(part("trailing")!.className).not.toContain("z-[3]");
    expect(within(part("trailing")!).getByTestId("chevron")).toBeInTheDocument();
  });

  it("shows a primary and a secondary action, each above the link, and only the actions it was given", () => {
    const primary = vi.fn();
    const secondary = vi.fn();
    draw({ open: { onClick: vi.fn() }, primary: { label: "Message", onClick: primary }, secondary: { label: "Profile", onClick: secondary } });
    const actions = part("actions")!;
    fireEvent.click(within(actions).getByRole("button", { name: /Message/ }));
    fireEvent.click(within(actions).getByRole("button", { name: "Profile" }));
    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).toHaveBeenCalledTimes(1);
    for (const b of within(actions).getAllByRole("button")) expect(b.className).toContain("z-[3]");
  });

  it("draws a feature's own action in the primary's place, never beside a primary", () => {
    const own = <button type="button">Quick Apply</button>;
    const { unmount } = draw({ action: own });
    expect(within(part("actions")!).getByRole("button", { name: "Quick Apply" }).parentElement).toHaveAttribute("data-card-part", "primary");
    unmount();
    draw({ action: own, primary: { label: "Open", onClick: vi.fn() } });
    expect(screen.queryByRole("button", { name: "Quick Apply" })).toBeNull();
  });

  it("holds a lead, labels, a meta line and a bounded extra block", () => {
    draw({ lead: <span data-testid="avatar">A</span>, eyebrow: <CardPill>Paid</CardPill>, meta: <><MapPin aria-hidden />Lisbon</>, extra: <p>Trade: a mix for a master</p> });
    expect(within(part("lead")!).getByTestId("avatar")).toBeInTheDocument();
    expect(part("eyebrow")).toHaveTextContent("Paid");
    expect(part("meta")).toHaveTextContent("Lisbon");
    expect(part("extra")).toHaveTextContent("Trade: a mix for a master");
  });
});
