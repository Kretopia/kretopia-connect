import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Bookmark, Share2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { expectWithinBudget } from "@/test/cardBudget";
import { CardPill, CardShell, type CardShellProps } from "../CardShell";
import { CARD_BUDGET } from "../cardTokens";

const LONG = "An extremely long headline that goes on and on and on, about a very large number of things, ".repeat(6);

const stuffed = (over: Partial<CardShellProps> = {}): CardShellProps => ({
  testId: "card",
  title: LONG,
  open: { to: "/thing/1" },
  cover: <img alt="" src="/cover.webp" />,
  coverStart: <CardPill tone="origin">Origin</CardPill>,
  coverControls: <button type="button" aria-label="Save">s</button>,
  meta: `${LONG} meta`,
  description: LONG,
  tags: Array.from({ length: 9 }, (_, i) => <CardPill key={i}>tag {i}</CardPill>),
  trust: LONG,
  primary: { label: "Open", to: "/thing/1" },
  secondary: { icon: <Share2 aria-hidden />, label: "Share", onClick: vi.fn() },
  ...over,
});

const renderShell = (props: Partial<CardShellProps> = {}) => render(<MemoryRouter><CardShell {...stuffed(props)} /></MemoryRouter>);
const card = () => screen.getByTestId("card");

describe("CardShell: the budget is applied by the shell, not asked of the caller", () => {
  it("keeps to it however much it is given", () => {
    renderShell();
    expectWithinBudget(card());
  });

  it("draws three tags and no more, in the order given", () => {
    renderShell();
    const tags = within(card()).getAllByText(/^tag \d$/);
    expect(tags.map((t) => t.textContent)).toEqual(["tag 0", "tag 1", "tag 2"]);
    expect(CARD_BUDGET.tags).toBe(3);
  });

  it("drops what is empty instead of leaving a gap", () => {
    renderShell({ meta: undefined, description: undefined, tags: [null, false, undefined], trust: undefined, secondary: undefined });
    for (const part of ["meta", "description", "tags", "trust", "secondary"]) expect(card().querySelector(`[data-card-part="${part}"]`)).toBeNull();
  });

  it("gives the cover a fixed 16:9 box, whatever it holds", () => {
    renderShell({ cover: <div style={{ height: 900 }}>tall</div> });
    expect(card().querySelector('[data-card-part="cover"]')!.className).toContain("aspect-[16/9]");
  });

  it("has one footer with one primary action and one icon secondary, and nothing else in it", () => {
    renderShell();
    const footer = card().querySelector<HTMLElement>('[data-card-part="footer"]')!;
    expect(within(footer).getAllByRole("link")).toHaveLength(1);
    expect(within(footer).getAllByRole("button")).toHaveLength(1);
    expect(within(footer).getByRole("button", { name: "Share" })).toHaveTextContent("");
  });

  it("renders the primary action as a link in the app, a new-tab link to another site, or a button", () => {
    const { unmount } = renderShell();
    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute("href", "/thing/1");
    unmount();
    const external = renderShell({ primary: { label: "Apply", href: "https://jobs.example/1", rel: "noopener noreferrer nofollow" } });
    const link = screen.getByRole("link", { name: /Apply/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
    external.unmount();
    const onClick = vi.fn();
    renderShell({ primary: { label: "Go", onClick } });
    fireEvent.click(screen.getByRole("button", { name: /Go/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks a saved toggle as pressed, for assistive technology", () => {
    renderShell({ coverControls: undefined, secondary: { icon: <Bookmark aria-hidden />, label: "Save", pressed: true, onClick: vi.fn() } });
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "true");
  });

  it("can make the whole card its target, with what must stay clickable above it", () => {
    renderShell({ stretch: true });
    expect(card().querySelector('[data-card-part="title"]')!.className).toContain("after:absolute");
    expect(card().querySelector('[data-card-part="primary"]')!.className).toContain("z-[3]");
  });

  it("lets a title with only a click handler be a button", () => {
    const onClick = vi.fn();
    renderShell({ open: { onClick, ariaLabel: "View brief" } });
    fireEvent.click(screen.getByRole("button", { name: "View brief" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("CardShell: the back", () => {
  const withBack = (over: Partial<CardShellProps> = {}) => ({
    back: { label: "quick look", eyebrow: "Quick look", children: <p>The long text</p>, actions: <button type="button">Do it</button>, onOpen: vi.fn() },
    ...over,
  });

  it("is not in the page until the card is first turned, and the turning icon replaces the secondary action", () => {
    renderShell(withBack());
    expect(screen.queryByText("The long text")).toBeNull();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    expect(screen.getByTestId("quick-look")).toHaveAttribute("aria-label", "Quick look");
    expectWithinBudget(card());
  });

  it("turns, tells the caller, hides the front from assistive technology and makes it inert, then comes back on Escape", () => {
    const props = withBack();
    renderShell(props);
    fireEvent.click(screen.getByTestId("quick-look"));
    expect(props.back.onOpen).toHaveBeenCalledTimes(1);
    expect(card()).toHaveAttribute("data-flipped", "true");
    const back = screen.getByRole("group", { name: /quick look/ });
    expect(back).toHaveTextContent("The long text");
    expect(back).not.toHaveAttribute("inert");
    expect(card().querySelector('[data-card-part="cover"]')!.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(card().querySelector('[data-card-part="cover"]')!.parentElement).toHaveAttribute("inert");
    expect(document.activeElement).toBe(screen.getByTestId("flip-back"));

    fireEvent.keyDown(screen.getByTestId("flip-back"), { key: "Escape" });
    expect(card()).toHaveAttribute("data-flipped", "false");
    expect(document.activeElement).toBe(screen.getByTestId("quick-look"));
  });

  it("puts the back's own actions in the back's footer, beside Flip back", () => {
    renderShell(withBack());
    fireEvent.click(screen.getByTestId("quick-look"));
    const back = screen.getByRole("group", { name: /quick look/ });
    expect(within(back).getByRole("button", { name: "Do it" })).toBeInTheDocument();
    expect(within(back).getByTestId("flip-back")).toBeInTheDocument();
  });
});
