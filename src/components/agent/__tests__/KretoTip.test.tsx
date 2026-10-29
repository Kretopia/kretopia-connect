import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { KretoTip } from "../KretoTip";

/**
 * Regression coverage for Kreto's controlled rollout across KretoTip's
 * route groups (KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md §13): Studio shipped
 * in the pilot, Scout, Passport and Events are the rollout surfaces
 * approved after pilot review so far. Events has since been moved to the
 * Kretopia K-mark (like Scout) on the owner's direction. This guards that the embodied
 * presence only appears on the approved route groups and every other group
 * still renders the flat KretoMark unchanged -- a rollout to "everywhere at
 * once" would be exactly the regression this suite exists to catch.
 */

/** The embodied-presence SVG inside the card artwork slot. The small robot in
 *  the "Kreto · X" label (KretoLabel) is the same component at `micro` size,
 *  but it is a label on EVERY tip by design, so it is excluded here: this
 *  suite guards where the large card artwork may appear. */
const cardPresence = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('svg[viewBox="0 0 100 100"]')).filter((el) => !el.closest("[data-kreto-label]"));
const labelRobots = (container: HTMLElement) =>
  container.querySelectorAll('[data-kreto-label] svg[viewBox="0 0 100 100"]');

function renderTip(surface: "today" | "discover" | "desk" | "match" | "pay" | "passport") {
  return render(
    <MemoryRouter>
      <KretoTip surface={surface} />
    </MemoryRouter>,
  );
}

/** Events has no `surface` override key (unlike the others), so it's
 *  exercised via real route matching instead -- the same code path a real
 *  visitor to /events hits. */
function renderTipAtRoute(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <KretoTip />
    </MemoryRouter>,
  );
}

describe("KretoTip — Kreto presence rollout scope", () => {
  it("Studio (desk) renders the miniature 3D Kreto artwork", () => {
    const { container } = renderTip("desk");
    expect(container.querySelector('img[src*="kreto-producer-hd"]')).toBeInTheDocument();
    expect(cardPresence(container)).toHaveLength(0);
    expect(labelRobots(container)).toHaveLength(1);
    expect(screen.getByText(/Kreto · Studio/i)).toBeInTheDocument();
  });

  it("Scout (discover) wears the Kretopia K-mark like Passport, with no robot artwork or label robot", () => {
    const { container } = renderTip("discover");
    expect(container.querySelector('img[src*="kretopia-k-mark"]')).toBeInTheDocument();
    expect(cardPresence(container)).toHaveLength(0);
    expect(labelRobots(container)).toHaveLength(0);
    expect(screen.getByText(/Kreto · Scout/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shortlist for me/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Or just chat/i })).toBeInTheDocument();
  });

  it("Passport renders the embodied KretoPresence -- the second rollout surface", () => {
    const { container } = renderTip("passport");
    expect(cardPresence(container)).toHaveLength(1);
    expect(labelRobots(container)).toHaveLength(1);
    expect(screen.getByText(/Kreto · Passport/i)).toBeInTheDocument();
  });

  it("Events (/events route) wears the real Kretopia K-mark: one logo, one plain label, no robot", () => {
    const { container } = renderTipAtRoute("/events");
    expect(container.querySelector('img[src*="kretopia-k-mark"]')).toBeInTheDocument();
    expect(cardPresence(container)).toHaveLength(0);
    expect(labelRobots(container)).toHaveLength(0);
    // Plain label: the context appears once, not as a sr-only copy next to a visible one.
    expect(screen.getAllByText(/Kreto · Events/i)).toHaveLength(1);
  });

  it("/meetup route also resolves to the Events group with the same K-mark card", () => {
    const { container } = renderTipAtRoute("/meetup");
    expect(container.querySelector('img[src*="kretopia-k-mark"]')).toBeInTheDocument();
    expect(cardPresence(container)).toHaveLength(0);
    expect(labelRobots(container)).toHaveLength(0);
    expect(screen.getByText(/Kreto · Events/i)).toBeInTheDocument();
  });

  it("Events has no dismiss control, and its two actions are distinct", () => {
    renderTipAtRoute("/events");
    expect(screen.queryByRole("button", { name: /Dismiss tip/i })).toBeNull();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent(/Build my event|Write the invite/);
    expect(buttons[1]).toHaveTextContent("Or just chat");
  });

  it("other route groups keep their dismiss control", () => {
    renderTip("discover");
    expect(screen.getByRole("button", { name: /Dismiss tip/i })).toBeInTheDocument();
  });

  it("Stages (/circle and /stages) has no Circle tip: the surface carries its own Kreto actions", () => {
    for (const route of ["/circle", "/stages"]) {
      const { container, unmount } = renderTipAtRoute(route);
      expect(screen.queryByText(/who's worth adding to your circle/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Suggest people/i)).not.toBeInTheDocument();
      expect(cardPresence(container)).toHaveLength(0);
      unmount();
    }
  });

  it.each(["today", "match", "pay"] as const)(
    "%s still renders the flat KretoMark, not the embodied presence -- rollout is scoped, not global",
    (surface) => {
      const { container } = renderTip(surface);
      expect(cardPresence(container)).toHaveLength(0);
      expect(container.querySelector("img")).toBeInTheDocument();
      // The header label carries the mini robot on every tip.
      expect(labelRobots(container)).toHaveLength(1);
    },
  );
});
