import { describe, expect, it } from "vitest";
import { redirectTarget } from "../redirectTarget";

describe("redirectTarget: a retired address keeps what the visitor arrived with", () => {
  it("carries the query string across, so /scout?tab=all&q=film lands on Scout with its tab and its search", () => {
    expect(redirectTarget("/opportunities/scout", "?tab=all&q=film", "")).toEqual({ pathname: "/opportunities/scout", search: "?tab=all&q=film", hash: "" });
  });

  it("carries the hash across when the destination has none", () => {
    expect(redirectTarget("/opportunities/scout", "", "#results")).toEqual({ pathname: "/opportunities/scout", search: "", hash: "#results" });
  });

  it("a destination that names its own hash keeps it (/founding-member goes to the Founding status)", () => {
    expect(redirectTarget("/creative-circle#founding", "", "#other")).toEqual({ pathname: "/creative-circle", search: "", hash: "#founding" });
    expect(redirectTarget("/creative-circle#founding", "?ref=mail", "")).toEqual({ pathname: "/creative-circle", search: "?ref=mail", hash: "#founding" });
  });

  it("a parameter the destination names itself wins over the same one arriving, and the others are kept", () => {
    expect(redirectTarget("/thing?tab=all", "?tab=old&q=x", "")).toEqual({ pathname: "/thing", search: "?tab=all&q=x", hash: "" });
  });

  it("encodes what it carries and adds nothing when there was nothing", () => {
    expect(redirectTarget("/x", "?q=a%20b%26c", "").search).toBe("?q=a+b%26c");
    expect(redirectTarget("/x")).toEqual({ pathname: "/x", search: "", hash: "" });
  });
});
