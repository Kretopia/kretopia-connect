import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/components/opportunity/BookmarkButton", () => ({
  BookmarkButton: () => <button type="button">Save opportunity</button>,
}));

vi.mock("@/components/opportunity/EasyApplyButton", () => ({
  EasyApplyButton: () => <button type="button">Easy Apply</button>,
}));

import { ScoutGigCard } from "../ScoutGigCard";

const LONG = (
  "Senior motion designer for a very large, long-running " +
  "multi-territory broadcast identity programme. "
).repeat(5);

const css = readFileSync(
  `${process.cwd()}/src/components/scout/ScoutGigCard.hybrid.css`,
  "utf8"
);

/*
 * Reads an exact CSS selector, including grouped declarations.
 * A parent selector such as ".scout-v23 ... .scout-v4 .flip-inner"
 * must not be mistaken for ".scout-v4 .flip-inner".
 */
function cssRule(selector: string): string {
  const withoutComments = css.replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );

  const rules = Array.from(
    withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)
  );

  const match = rules.find((rule) =>
    rule[1]
      .split(",")
      .some((part) => part.trim() === selector)
  );

  return match?.[2] ?? "";
}

function renderCard({
  internal = false,
  pay = "$800" as string | null,
}: {
  internal?: boolean;
  pay?: string | null;
} = {}) {
  return render(
    <MemoryRouter>
      <ScoutGigCard
        testId="budget-card"
        title={LONG}
        company="Northline Records"
        image="/local-cover.webp"
        href="/opportunity/1"
        pay={pay}
        location="Porto"
        origin={internal ? "kretopia" : "external"}
        internalOpportunityId={
          internal ? "opportunity-1" : undefined
        }
        sourceName="Creative Jobs"
        excerpt={LONG}
        badges={<span>Scouted</span>}
        evidence={<p>{LONG}</p>}
        footer={
          <button type="button">
            Apply at source
          </button>
        }
      >
        <p>Also posted for 2 more places</p>
      </ScoutGigCard>
    </MemoryRouter>
  );
}

const card = () => screen.getByTestId("budget-card");

const front = () =>
  card().querySelector<HTMLElement>(".flip-front")!;

const back = () =>
  card().querySelector<HTMLElement>(".flip-back")!;

const openBack = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Quick look" })
  );

describe("Scout Hybrid V4 — visual budget", () => {
  it("conserve la structure V4 avec un titre très long", () => {
    renderCard();

    expect(card()).toHaveClass("scout-v4");
    expect(card().querySelector(".scene")).not.toBeNull();
    expect(card().querySelector(".holo")).not.toBeNull();
    expect(card().querySelector(".tilt-shell")).not.toBeNull();
    expect(card().querySelector(".flip-inner")).not.toBeNull();
  });

  it("vérifie les dimensions exactes de la carte et de sa couverture", () => {
    const flip = cssRule(".scout-v4 .flip-inner");
    const cover = cssRule(".scout-v4 .cover");

    expect(flip).not.toBe("");
    expect(cover).not.toBe("");

    expect(flip).toMatch(/(?:^|;)\s*height:\s*368px\s*;/);
    expect(flip).toMatch(/min-height:\s*368px\s*;/);

    expect(cover).toMatch(/height:\s*122px\s*;/);
    expect(cover).toMatch(/flex:\s*0\s+0\s+122px\s*;/);
  });

  it("limite les titres longs à deux lignes", () => {
    const headline = cssRule(
      ".scout-v4 .flip-front .headline h4"
    );

    expect(headline).toMatch(/-webkit-line-clamp:\s*2/);
    expect(headline).toMatch(/overflow:\s*hidden/);
  });

  it("conserve les informations essentielles sur le recto", () => {
    renderCard();

    expect(front()).toHaveTextContent("Northline Records");
    expect(front()).toHaveTextContent("Porto");
    expect(front()).toHaveTextContent("Paid opportunity");
    expect(front()).toHaveTextContent("Scouted");

    expect(front()).not.toHaveTextContent("$800");
    expect(front()).not.toHaveTextContent(
      "Also posted for 2 more places"
    );
  });

  it("place le budget et les informations longues au verso", () => {
    renderCard();
    openBack();

    expect(back()).toHaveTextContent("$800");
    expect(back()).toHaveTextContent(LONG);
    expect(back()).toHaveTextContent(
      "Also posted for 2 more places"
    );
  });

  it("conserve les actions internes sur le recto", () => {
    renderCard({ internal: true });

    const cover = front().querySelector<HTMLElement>(
      ".cover-top"
    )!;

    expect(
      within(cover).getByRole("button", {
        name: "Save opportunity",
      })
    ).toBeInTheDocument();

    expect(
      within(front()).getByRole("button", {
        name: "Easy Apply",
      })
    ).toBeInTheDocument();
  });

  it("place les actions externes au verso", () => {
    renderCard();

    expect(front()).not.toHaveTextContent("Apply at source");

    openBack();

    expect(
      within(back()).getByRole("button", {
        name: "Apply at source",
      })
    ).toBeInTheDocument();
  });

  it("vérifie les effets holographiques non interactifs", () => {
    renderCard();

    for (const selector of [
      ".scout-v4 .material",
      ".scout-v4 .foil-light",
      ".scout-v4 .prismatic-edge",
    ]) {
      const rule = cssRule(selector);

      expect(rule).not.toBe("");
      expect(rule).toMatch(/pointer-events:\s*none/);
    }

    expect(
      card().querySelector(".foil-light")
    ).toHaveAttribute("aria-hidden", "true");

    expect(
      card().querySelector(".prismatic-edge")
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("préserve la gestion du débordement des deux faces", () => {
    const face = cssRule(".scout-v4 .flip-face");
    const reverse = cssRule(
      ".scout-v4 .flip-back > .content"
    );

    expect(face).toMatch(/overflow:\s*hidden/);
    expect(reverse).toMatch(/overflow-y:\s*auto/);
  });

  it("préserve la réduction des animations", () => {
    const reducedMotion = css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)^\}/m
    )?.[1];

    expect(reducedMotion).toBeDefined();
    expect(reducedMotion).toContain(".scout-v4 .flip-inner");
    expect(reducedMotion).toMatch(
      /transition:\s*none\s*!important/
    );
  });

  it("conserve Quick Look au pied du recto", () => {
    renderCard({ internal: true });

    const footer = front().querySelector<HTMLElement>(
      ".card-foot"
    )!;

    expect(
      within(footer).getByRole("button", {
        name: "Quick look",
      })
    ).toBeInTheDocument();

    expect(
      within(footer).getByRole("button", {
        name: "Easy Apply",
      })
    ).toBeInTheDocument();
  });

  it("garde Apply with Kreto exclusivement au verso", () => {
    renderCard();

    expect(front()).not.toHaveTextContent("Apply with Kreto");

    openBack();

    expect(
      within(back()).getByTestId("apply-with-kreto-open")
    ).toBeInTheDocument();
  });

  it("n'invente pas de rémunération absente", () => {
    renderCard({ pay: null });
    openBack();

    expect(back()).toHaveTextContent("Pay not listed");
    expect(back()).not.toHaveTextContent("$800");
  });
});
