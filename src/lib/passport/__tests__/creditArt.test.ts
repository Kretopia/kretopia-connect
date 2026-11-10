import { describe, expect, it } from "vitest";
import { KRETO_SCENES } from "@/components/brand/kretoScenes";
import { CREDIT_SCENES, creditSceneFor } from "../creditArt";

// The product expressions each belong to one feature, and the plain backgrounds have no Kreto at a desk in a place: neither is the art of
// somebody's work history.
const PRODUCT_EXPRESSIONS = ["passport", "krepay", "assistant", "match", "scout", "soundstages", "studio", "talent-search"];
const INTERIM_CROPS = ["landing-hero", "product-launch", "social", "investor-deck", "announcement", "event", "onboarding", "celebration", "campaign"];

describe("the picture a credit wears when it has no cover", () => {
  it("is always one of the approved scenes, each with the 480 px file that a card slot uses", () => {
    for (const scene of CREDIT_SCENES) {
      expect(KRETO_SCENES[scene], scene).toBeDefined();
      expect(KRETO_SCENES[scene].thumb?.src, `${scene} has a thumb`).toBeTruthy();
    }
    expect(new Set(CREDIT_SCENES).size).toBe(CREDIT_SCENES.length);
  });

  it("uses only the environments: no feature's own art, no interim crop, no plain background", () => {
    for (const scene of CREDIT_SCENES) {
      expect(PRODUCT_EXPRESSIONS).not.toContain(scene);
      expect(INTERIM_CROPS).not.toContain(scene);
      expect(["bg-dark", "bg-light"]).not.toContain(scene);
    }
  });

  it("is the same for the same credit, every time", () => {
    const ids = ["c1", "8f14e45f-ceea-467a-9575-1c1d53f7c2b4", "credit with spaces", "é-ünïcode", "0"];
    for (const id of ids) {
      const first = creditSceneFor(id);
      for (let call = 0; call < 25; call += 1) expect(creditSceneFor(id)).toBe(first);
      expect(CREDIT_SCENES).toContain(first);
    }
  });

  it("does not depend on order, position or anything but the id", () => {
    const ids = Array.from({ length: 40 }, (_, index) => `credit-${index}`);
    const forward = ids.map(creditSceneFor);
    const backward = [...ids].reverse().map(creditSceneFor).reverse();
    expect(backward).toEqual(forward);
  });

  it("spreads different credits over the scenes, so a row of credits is not one picture repeated", () => {
    const used = new Set(Array.from({ length: 60 }, (_, index) => creditSceneFor(`7c9e6679-7425-40de-944b-e07fc1f90a${String(index).padStart(2, "0")}`)));
    expect(used.size).toBe(CREDIT_SCENES.length);
  });

  it("still gives a card without a usable id a picture, and always the same one", () => {
    const fallback = creditSceneFor("");
    expect(creditSceneFor(undefined)).toBe(fallback);
    expect(creditSceneFor(null)).toBe(fallback);
    expect(creditSceneFor("   ")).toBe(fallback);
    expect(CREDIT_SCENES).toContain(fallback);
  });
});
