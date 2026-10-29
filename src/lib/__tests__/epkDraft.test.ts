import { describe, expect, it } from "vitest";
import { buildEPKDefaults, epkDraftPrompt, validateEPKFile } from "../epkDraft";
import type { EPKPdfInput } from "../epkPdfGenerator";
const input: EPKPdfInput = { profile: { full_name: "Maya", role: "Designer", professional_skills: ["Motion"], passion_skills: ["Film"] }, credits: [{ project_name: "Nord", role: "Lead", year: 2026 }], awards: [], pressLinks: [], industryStats: [], reviews: [] };
describe("EPK factual drafts", () => {
  it("enriches defaults with actual expertise and selected work", () => {
    const draft = buildEPKDefaults(input);
    expect(draft.topics.practice).toContain("Motion");
    expect(draft.topics.portfolio).toBe("Nord — Lead (2026)");
    expect(draft.topics.recognition).toBe("");
  });
  it("retains the user's existing biography", () => {
    expect(buildEPKDefaults({ ...input, profile: { ...input.profile, bio: "My real biography" } }).bio).toBe("My real biography");
  });
  it("requires factual, unverified-safe AI drafts", () => {
    const prompt = epkDraftPrompt(input, "Bio", "My story");
    expect(prompt).toContain("Do not convert pending or unverified credits into verified claims");
    expect(prompt).toContain("My story");
  });
  it("accepts a user's PDF and rejects other file types", () => {
    expect(validateEPKFile({ name: "kit.pdf", type: "application/pdf", size: 100 })).toBeNull();
    expect(validateEPKFile({ name: "kit.exe", type: "application/octet-stream", size: 100 })).not.toBeNull();
  });
});