import { describe, expect, it } from "vitest";

import { genericSearchTarget } from "@/lib/searchEntry";

describe("genericSearchTarget", () => {
  it("sends the generic search address to Discover", () => {
    expect(genericSearchTarget("")).toBe("/discover");
    expect(genericSearchTarget("?")).toBe("/discover");
  });

  it("keeps the parameters Discover reads, tab and mode", () => {
    expect(genericSearchTarget("?tab=people&mode=sourced")).toBe("/discover?tab=people&mode=sourced");
    expect(genericSearchTarget("?mode=sourced")).toBe("/discover?mode=sourced");
  });

  it("drops what neither page ever read", () => {
    expect(genericSearchTarget("?skill=mixing&utm_source=footer")).toBe("/discover");
    expect(genericSearchTarget("?utm_source=footer&tab=people")).toBe("/discover?tab=people");
  });

  it("leaves an address with a term on the results page, whatever else it carries", () => {
    expect(genericSearchTarget("?q=ux%20designer")).toBeNull();
    expect(genericSearchTarget("?q=ux&tab=people")).toBeNull();
    expect(genericSearchTarget("?tab=people&q=Noé")).toBeNull();
  });

  it("treats an empty or blank term as no term", () => {
    expect(genericSearchTarget("?q=")).toBe("/discover");
    expect(genericSearchTarget("?q=%20%20")).toBe("/discover");
    expect(genericSearchTarget("?q=&tab=people")).toBe("/discover?tab=people");
  });
});
