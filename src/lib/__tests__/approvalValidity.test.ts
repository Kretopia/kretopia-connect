import { describe, expect, it } from "vitest";
import { evaluateApproval } from "../approvalValidity";

const R = "2026-10-03T10:00:00.000Z";
const before = "2026-10-03T09:00:00.000Z";
const after = "2026-10-03T11:00:00.000Z";

describe("evaluateApproval", () => {
  it("ignores non-approved statuses", () => {
    for (const status of ["pending", "submitted", "rejected", "in_progress"]) {
      expect(evaluateApproval({ status, reviewed_at: R, submission_files: [{ uploaded_at: after }] }).state).toBe("not_approved");
    }
  });

  it("is valid when every file predates the review", () => {
    const v = evaluateApproval({ status: "approved", reviewed_at: R, submission_files: [{ uploaded_at: before }, { uploaded_at: R }] });
    expect(v).toMatchObject({ state: "valid", coveredFiles: 2, undatedFiles: 0 });
  });

  it("is stale when a file was uploaded after the review", () => {
    const v = evaluateApproval({ status: "approved", reviewed_at: R, submission_files: [{ uploaded_at: before }, { uploaded_at: after }] });
    expect(v).toMatchObject({ state: "stale", coveredFiles: 1, newerFiles: 1 });
  });

  it("is unknown without a usable review time", () => {
    expect(evaluateApproval({ status: "approved", reviewed_at: null, submission_files: [] }).state).toBe("unknown");
    expect(evaluateApproval({ status: "approved", reviewed_at: "garbage", submission_files: [] }).state).toBe("unknown");
    expect(evaluateApproval({ status: "approved" }).state).toBe("unknown");
  });

  it("does not count undated files as newer", () => {
    const v = evaluateApproval({ status: "approved", reviewed_at: R, submission_files: [{}, { uploaded_at: null }, { uploaded_at: "x" }] });
    expect(v).toMatchObject({ state: "valid", coveredFiles: 0, undatedFiles: 3 });
  });

  it("handles null or empty file lists", () => {
    expect(evaluateApproval({ status: "approved", reviewed_at: R, submission_files: null })).toMatchObject({ state: "valid", coveredFiles: 0 });
    expect(evaluateApproval({ status: "approved", reviewed_at: R, submission_files: [] })).toMatchObject({ state: "valid", coveredFiles: 0 });
  });
});
