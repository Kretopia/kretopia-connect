import { describe, expect, it } from "vitest";

import { genericSearchTarget } from "@/lib/searchEntry";

describe("genericSearchTarget", () => {
  it("sends the generic search address to Discover", () => {
    expect(genericSearchTarget("")).toBe("/scout");
    expect(genericSearchTarget("?")).toBe("/scout");
  });

  it("keeps the parameters Discover reads, tab and mode", () => {
    expect(genericSearchTarget("?tab=people&mode=sourced")).toBe("/scout");
    expect(genericSearchTarget("?mode=sourced")).toBe("/scout");
  });

  it("drops what neither page ever read", () => {
    expect(genericSearchTarget("?skill=mixing&utm_source=footer")).toBe("/scout");
    expect(genericSearchTarget("?utm_source=footer&tab=people")).toBe("/scout");
  });

  it("leaves an address with a term on the results page, whatever else it carries", () => {
    expect(genericSearchTarget("?q=UX%20Designer")).toBe("/scout?q=UX%20Designer");
    expect(genericSearchTarget("?q=ux&tab=people")).toBe("/scout?q=ux");
    expect(genericSearchTarget("?tab=people&q=Noé")).toBe("/scout?q=No%C3%A9");
  });

  it("treats an empty or blank term as no term", () => {
    expect(genericSearchTarget("?q=")).toBe("/scout");
    expect(genericSearchTarget("?q=%20%20")).toBe("/scout");
    expect(genericSearchTarget("?q=&tab=people")).toBe("/scout");
  });
});
