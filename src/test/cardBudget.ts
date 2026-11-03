import { expect } from "vitest";
import { CARD_BUDGET } from "@/components/cards/cardTokens";

/**
 * What every card, whatever it shows, keeps to. Each variant's test builds its card with far more than the budget allows and calls this:
 * the parts are found by `data-card-part`, which only CardShell writes, so a card that drew its own anatomy would have none to find.
 */
export function expectWithinBudget(card: HTMLElement) {
  const all = (name: string) => Array.from(card.querySelectorAll<HTMLElement>(`[data-card-part="${name}"]`));

  const covers = all("cover");
  expect(covers, "a card has one cover").toHaveLength(1);
  expect(covers[0].className, "a fixed 16:9 cover").toContain("aspect-[16/9]");

  const titles = all("title");
  expect(titles, "a card has one title on its front").toHaveLength(1);
  expect(titles[0].className, `a title is cut at ${CARD_BUDGET.titleLines} lines`).toContain(`line-clamp-${CARD_BUDGET.titleLines}`);

  for (const meta of all("meta")) expect(meta.className, "one line of meta").toContain("truncate");
  for (const description of all("description")) expect(description.className, `a description is cut at ${CARD_BUDGET.descriptionLines} lines`).toContain(`line-clamp-${CARD_BUDGET.descriptionLines}`);
  for (const tags of all("tags")) expect(tags.children.length, `${CARD_BUDGET.tags} tags at most`).toBeLessThanOrEqual(CARD_BUDGET.tags);
  for (const trust of all("trust")) expect(trust.className, `provenance is cut at ${CARD_BUDGET.trustLines} lines`).toContain(`line-clamp-${CARD_BUDGET.trustLines}`);

  const footers = all("footer");
  expect(footers.length, "one footer").toBeLessThanOrEqual(1);
  for (const footer of footers) {
    expect(footer.querySelectorAll('[data-card-part="primary"]').length, "one primary action").toBeLessThanOrEqual(1);
    expect(footer.querySelectorAll('[data-card-part="secondary"]').length, "one secondary action").toBeLessThanOrEqual(1);
    expect(footer.querySelectorAll("a, button").length, "a primary and a secondary, nothing else, in the footer").toBeLessThanOrEqual(2);
    for (const secondary of all("secondary")) {
      const visible = secondary.cloneNode(true) as HTMLElement;
      visible.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());
      expect((visible.textContent ?? "").trim(), "the secondary action is an icon, its name is for assistive technology").toBe("");
      expect(secondary.getAttribute("aria-label"), "an icon with a name").toBeTruthy();
    }
  }
}
