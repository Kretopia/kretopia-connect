import { describe, expect, it } from "vitest";
import { kretoReplyText } from "../kretoReplyText";

const handoff = "[Open in Executive Producer →](/thrive/generate?intent=pitch_deck&prompt=Pitch%20deck%20for%20Kretopia%3A%20Empowering%20Creative%20Professionals%20platform)";
describe("Kreto human-readable replies", () => {
  it("removes internal handoffs without removing the actual answer", () => {
    const answer = "Start with the problem, then establish the evidence.";
    expect(kretoReplyText(answer + "\n" + handoff)).toBe(answer);
    expect(kretoReplyText(handoff)).toBe("");
  });
  it("never flashes incomplete handoff syntax across streamed prefixes", () => {
    for (let i = 1; i <= handoff.length; i++) {
      expect(kretoReplyText("Answer.\n" + handoff.slice(0, i))).toBe("Answer.");
    }
  });
  it("keeps external source names and removes raw addresses and formatting", () => {
    expect(kretoReplyText("**Evidence** from [source](https://example.org/report).")).toBe("Evidence from source.");
    expect(kretoReplyText("Read /desk/123/thrive/generate?intent=pitch_deck")).toBe("Read");
  });
  it("hides action payloads without mutating the original protocol", () => {
    const raw = 'Answer.<action>{"intent":"Create task"}</action>';
    expect(kretoReplyText(raw)).toBe("Answer.");
    expect(raw).toContain('"intent":"Create task"');
    expect(kretoReplyText('Answer.<plan>{"goal":')).toBe("Answer.");
  });
});