import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { KretoTip } from "../KretoTip";

/**
 * Regression coverage for Kreto's controlled rollout across KretoTip's
 * route groups (KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md §13): Studio shipped
 * in the pilot, Scout, Passport, Events and Circle are the rollout surfaces
 * approved after pilot review so far. This guards that the embodied
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

  it("Scout (discover) renders the embodied KretoPresence -- the first rollout surface", () => {
    const { container } = renderTip("discover");
    expect(cardPresence(container)).toHaveLength(1);
    expect(labelRobots(container)).toHaveLength(1);
    expect(screen.getByText(/Kreto · Scout/i)).toBeInTheDocument();
  });

  it("Passport renders the embodied KretoPresence -- the second rollout surface", () => {
    const { container } = renderTip("passport");
    expect(cardPresence(container)).toHaveLength(1);
    expect(labelRobots(container)).toHaveLength(1);
    expect(screen.getByText(/Kreto · Passport/i)).toBeInTheDocument();
  });

  it("Events (/events route) renders the embodied KretoPresence -- the third rollout surface", () => {
    const { container } = renderTipAtRoute("/events");
    expect(cardPresence(container)).toHaveLength(1);
    expect(labelRobots(container)).toHaveLength(1);
    expect(screen.getByText(/Kreto · Events/i)).toBeInTheDocument();
  });

  it("/meetup route also resolves to the Events group and renders the embodied presence", () => {
    const { container } = renderTipAtRoute("/meetup");
    expect(cardPresence(container)).toHaveLength(1);
    expect(labelRobots(container)).toHaveLength(1);
    expect(screen.getByText(/Kreto · Events/i)).toBeInTheDocument();
  });

  it("Circle (/circle route) renders the embodied KretoPresence -- the fourth rollout surface", () => {
    const { container } = renderTipAtRoute("/circle");
    expect(cardPresence(container)).toHaveLength(1);
    expect(labelRobots(container)).toHaveLength(1);
    expect(screen.getByText(/Kreto · Circle/i)).toBeInTheDocument();
  });

  it("/stages route also resolves to the Circle group and renders the embodied presence", () => {
    const { container } = renderTipAtRoute("/stages");
    expect(cardPresence(container)).toHaveLength(1);
    expect(labelRobots(container)).toHaveLength(1);
    expect(screen.getByText(/Kreto · Circle/i)).toBeInTheDocument();
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
