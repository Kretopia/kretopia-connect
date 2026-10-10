import { describe, expect, it } from "vitest";
import { isThinListing } from "../scoutListing";

const real = {
  description: "A real description with enough detail to be worth a pitch, including scope and timing.",
  company: "Nord Films",
  compensation: null,
  apply_url: "https://remoteok.com/remote-jobs/motion-designer-123",
  source_url: null,
};

describe("isThinListing", () => {
  it("keeps a real posting", () => {
    expect(isThinListing(real)).toBe(false);
  });

  it("drops a listing with no description, pay or company", () => {
    expect(isThinListing({ ...real, description: "short", company: null, compensation: null })).toBe(true);
  });

  it("keeps a short description when pay or company is stated", () => {
    expect(isThinListing({ ...real, description: "short", company: "Nord" })).toBe(false);
    expect(isThinListing({ ...real, description: "short", company: null, compensation: "$60k" })).toBe(false);
  });

  it("drops a link to a category, search or home page, and an unreadable link", () => {
    expect(isThinListing({ ...real, apply_url: "https://example.com/jobs" })).toBe(true);
    expect(isThinListing({ ...real, apply_url: "https://example.com" })).toBe(true);
    expect(isThinListing({ ...real, apply_url: "not a url" })).toBe(true);
    expect(isThinListing({ ...real, apply_url: null, source_url: null })).toBe(true);
  });

  it("only accepts a LinkedIn link that is one job", () => {
    expect(isThinListing({ ...real, apply_url: "https://www.linkedin.com/jobs/search/?keywords=motion" })).toBe(true);
    expect(isThinListing({ ...real, apply_url: "https://www.linkedin.com/jobs/view/4012345678" })).toBe(false);
  });

  it("prefers the full description when there is one", () => {
    expect(isThinListing({ ...real, description: "", full_description: "x".repeat(60), company: null })).toBe(false);
  });
});
