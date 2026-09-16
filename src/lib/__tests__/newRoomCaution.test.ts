import { describe, it, expect } from "vitest";
import { getNewRoomCautionReasons } from "../newRoomCaution";

/**
 * KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md's approved caution decision: only
 * flag a draft when it has a real, specific unresolved detail -- never for
 * every normal draft. These are the two real signals VoiceFirstCreateModal
 * has for that today (a raw/unstructured fallback, an unconfident type
 * inference); missing deliverables is a real third signal but has its own
 * dedicated inline message elsewhere, so it's deliberately not duplicated
 * through this function -- see newRoomCaution.ts's own doc comment.
 */
describe("getNewRoomCautionReasons", () => {
  it("returns no reasons for a clean, confidently-typed, non-degraded draft", () => {
    expect(getNewRoomCautionReasons("photo_shoot", false)).toEqual([]);
  });

  it("flags a degraded (raw fallback) draft", () => {
    const reasons = getNewRoomCautionReasons("photo_shoot", true);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/couldn't structure this one/i);
  });

  it("flags an unconfident ('general') type inference", () => {
    const reasons = getNewRoomCautionReasons("general", false);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/wasn't confident about the project type/i);
  });

  it("flags both when a draft is both degraded and unconfidently typed", () => {
    expect(getNewRoomCautionReasons("general", true)).toHaveLength(2);
  });

  // Note: this function can't tell "type inferred as general" apart from
  // "user deliberately chose general" -- that distinction is the caller's
  // job (VoiceFirstCreateModal only calls this when the type came from
  // auto-inference, not from an explicit user pick).
});
