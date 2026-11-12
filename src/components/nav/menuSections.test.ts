import { describe, expect, it } from "vitest";
import { getMenuSections } from "./menuSections";

describe.each([false, true])("menu mode Company=%s", (company) => {
  it.each([false, true])("limits each category to three cards with manager=%s", (manager) => {
    for (const section of getMenuSections(company, manager)) {
      expect(section.items.length).toBeGreaterThan(0);
      expect(section.items.length).toBeLessThanOrEqual(3);
    }
  });
  it("places Kreto once in the first Workspace category", () => {
    const sections = getMenuSections(company, true);
    expect(sections[0].title).toBe("Workspace");
    expect(sections[0].items[0].path).toBe("/kreto");
    expect(sections.flatMap(s => s.items).filter(i => i.path === "/kreto")).toHaveLength(1);
  });
});