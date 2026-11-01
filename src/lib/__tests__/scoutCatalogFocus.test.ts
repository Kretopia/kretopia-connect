import { describe, expect, it } from "vitest";
import { focusRequest, type CatalogItem } from "@/lib/scoutCatalog";

// focusRequest only reads the title, the company and the place.
const item = (title: string, company = "", locationFull = "") => ({ id: `${title}|${company}|${locationFull}`, title, company, locationFull }) as unknown as CatalogItem;

const catalog = [
  item("UX Designer", "Acme", "Berlin"),
  item("Senior UI/UX Designer", "Studio Nord", "Paris, France"),
  item("Frontend Developer", "Beta", "Remote"),
  item("Luxury Retail Associate", "Maison", "Paris"),
  item("Product Designer", "Gamma", "Paris"),
  item("Sound Engineer", "Delta", "Lyon"),
];
const titles = (f: ReturnType<typeof focusRequest>) => f?.items.map((i) => i.title);

describe("focusRequest", () => {
  it("lands on the postings whose title carries the role, not on every posting that mentions it", () => {
    const f = focusRequest(catalog, "UX Designer");
    expect(titles(f)).toEqual(["UX Designer", "Senior UI/UX Designer"]);
    expect(f?.term).toBe("UX Designer");
    expect(f?.exact).toBe(true);
  });

  it("reads a short word as a whole word: ux is not found in luxury", () => {
    expect(titles(focusRequest(catalog, "ux"))).not.toContain("Luxury Retail Associate");
  });

  it("accepts a plural", () => {
    expect(titles(focusRequest(catalog, "UX Designers"))).toEqual(["UX Designer", "Senior UI/UX Designer"]);
  });

  it("uses the company and the place when the title does not carry every word", () => {
    const f = focusRequest(catalog, "UX Designer Paris");
    expect(titles(f)).toEqual(["Senior UI/UX Designer"]);
    expect(f?.exact).toBe(true);
  });

  it("drops the last word, usually a place, when nothing carries all of them", () => {
    const f = focusRequest(catalog, "UX Designer Lyon");
    expect(titles(f)).toEqual(["UX Designer", "Senior UI/UX Designer"]);
    expect(f?.term).toBe("UX Designer");
    expect(f?.exact).toBe(false);
  });

  it("finds a place on its own", () => {
    expect(titles(focusRequest(catalog, "Paris"))).toEqual(["Senior UI/UX Designer", "Luxury Retail Associate", "Product Designer"]);
  });

  it("never falls back to the whole catalog", () => {
    expect(focusRequest(catalog, "astronaut")).toBeNull();
    expect(focusRequest(catalog, "")).toBeNull();
    expect(focusRequest([], "UX Designer")).toBeNull();
  });
});
