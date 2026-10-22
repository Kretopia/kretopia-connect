import { describe, expect, it } from "vitest";
import { pendingRoleClaim } from "../roleClaim";
import { classifyCreditEvidence } from "../creditEvidence";

describe("production role consent", () => {
  it("records a claim as pending, never confirmed without recipient acceptance", () => {
    const claim = pendingRoleClaim("requester", "Urban Light", " Photographer ");
    expect(claim).toEqual({ user_id: "requester", project_name: "Urban Light", role: "Photographer", verification_status: "pending" });
    expect(classifyCreditEvidence(claim)).toBe("pending");
  });
});