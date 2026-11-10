import { describe, expect, it, vi } from "vitest";

// Each page module records that it was requested, so the test can tell which chunk a link warms.
const loaded = vi.hoisted(() => ({ names: [] as string[] }));
vi.mock("@/pages/Scout", () => { loaded.names.push("Scout"); return { default: () => null }; });
vi.mock("@/pages/Opportunities", () => { loaded.names.push("Opportunities"); return { default: () => null }; });
vi.mock("@/pages/PerksTab", () => { loaded.names.push("PerksTab"); return { default: () => null }; });
vi.mock("@/pages/CreativeCircle", () => { loaded.names.push("CreativeCircle"); return { default: () => null }; });

import { prefetchRoute } from "../routePrefetch";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("route prefetch for the consolidated entry points", () => {
  it("a link to Scout inside Opportunities warms Scout's chunk, not the feed's (the longest prefix wins)", async () => {
    prefetchRoute("/opportunities/scout?tab=all&q=film");
    await settle();
    expect(loaded.names).toEqual(["Scout"]);
  });

  it("a link to the feed still warms the feed", async () => {
    prefetchRoute("/opportunities");
    await settle();
    expect(loaded.names).toEqual(["Scout", "Opportunities"]);
  });

  it("Perks, Creative Circle and the old Founding address warm what they land on", async () => {
    prefetchRoute("/perks");
    await settle();
    expect(loaded.names).toContain("PerksTab");
    prefetchRoute("/founding-member");
    await settle();
    expect(loaded.names).toContain("CreativeCircle");
  });
});
