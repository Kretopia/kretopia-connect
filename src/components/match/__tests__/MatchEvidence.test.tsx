import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateCandidate, FIT_LABEL, type CandidateFacts } from "@/lib/matching/evaluate";
import { matchNeedSchema } from "@/lib/matching/need";
import { FitBadge, MatchEvidence } from "../MatchEvidence";

afterEach(cleanup);

const facts = (over: Partial<CandidateFacts> = {}): CandidateFacts => ({ userId: "u1", fullName: "Ana Lopez", role: "TikTok creator", bio: null, location: null, skills: [], links: { tiktok: true }, synced: {}, credits: [], ...over });
const need = matchNeedSchema.parse({
  craft: { category: "creator", importance: "required" },
  platforms: [{ platform: "tiktok", importance: "required" }, { platform: "instagram", importance: "preferred" }],
  audience: { description: "women 18 to 24 in the US", importance: "required" },
});

describe("FitBadge", () => {
  it("says the fit in words, never a number", () => {
    for (const [fit, label] of Object.entries(FIT_LABEL)) {
      const { unmount } = render(<FitBadge fit={fit as keyof typeof FIT_LABEL} />);
      expect(screen.getByText(label)).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/\d|%/);
      unmount();
    }
  });
});

describe("MatchEvidence", () => {
  const view = () => render(<MatchEvidence evaluation={evaluateCandidate(need, facts())} />);

  it("says how much could be checked, and that it rests on what is on Kretopia", () => {
    view();
    expect(screen.getByText(/Checked 3 of 4 criteria\. Based on what is on Kretopia/)).toBeTruthy();
  });

  it("gives every criterion its answer, its importance, where it came from and the real evidence", () => {
    view();
    const craft = within(screen.getByText("Works as Creator").closest("li") as HTMLElement);
    expect(craft.getByText("Required")).toBeTruthy();
    expect(craft.getByText("Met")).toBeTruthy();
    expect(craft.getByText(/From their profile/)).toBeTruthy();
    expect(craft.getByText(/Role: "TikTok creator"/)).toBeTruthy();

    const instagram = within(screen.getByText("Present on Instagram").closest("li") as HTMLElement);
    expect(instagram.getByText("Preferred")).toBeTruthy();
    expect(instagram.getByText("Not met")).toBeTruthy();
    expect(instagram.getByText(/No Instagram link or connected account on their profile/)).toBeTruthy();
  });

  it("shows what could not be checked, and what that means, instead of leaving it out", () => {
    view();
    const audience = within(screen.getByText("Audience: women 18 to 24 in the US").closest("li") as HTMLElement);
    expect(audience.getByText("Not on Kretopia")).toBeTruthy();
    expect(audience.getByText(/Audience data not provided/)).toBeTruthy();
    expect(audience.getByText(/does not prove who follows someone/)).toBeTruthy();
  });

  it("is named for the person it is about", () => {
    view();
    expect(screen.getByRole("region", { name: "How Ana Lopez was checked" })).toBeTruthy();
  });
});
