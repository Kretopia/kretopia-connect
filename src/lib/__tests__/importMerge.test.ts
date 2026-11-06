import { describe, expect, it } from "vitest";
import { planProfileImport } from "../importMerge";

describe("planProfileImport", () => {
  it("fills empty fields and keeps what the member already wrote", () => {
    const plan = planProfileImport(
      { full_name: "Dee Marshall", role: "", bio: "   ", location: null },
      { full_name: "Someone Else", role: "Director", bio: "Imported bio", location: "Paris" },
    );
    expect(plan.fill).toEqual({ role: "Director", bio: "Imported bio", location: "Paris" });
    expect(plan.kept).toEqual(["full_name"]);
  });

  it("ignores empty or non-text imported values instead of blanking a field", () => {
    const plan = planProfileImport({ role: "Editor" }, { role: "  ", bio: 42 as unknown as string, location: "" });
    expect(plan.fill).toEqual({});
    expect(plan.kept).toEqual([]);
  });
});
