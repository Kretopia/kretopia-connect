// Read-only check: does a deliverable's "approved" status still apply to the
// files it currently holds?
//
// No schema is involved. There is no recorded version to compare:
// project_deliverables.version is always 1 and deliverable_versions has no
// writer. Instead the rule compares timestamps that already exist --
// reviewed_at (set when the review decision is made) against each submitted
// file's uploaded_at. Any file uploaded AFTER the review is "newer" than what
// was reviewed, so the approval no longer applies to the current set of files.
//
// Limits (see docs/roadmap/exact-version-approval-mvp.md): timestamps come
// from client clocks, files without uploaded_at cannot be placed in time, and
// this never changes the stored status -- it only changes what the UI claims.

export interface ApprovalInput {
  status: string;
  reviewed_at?: string | null;
  submission_files?: Array<{ uploaded_at?: string | null }> | null;
}

export type ApprovalValidity =
  | { state: "not_approved" }
  /** Approved, but no review time was recorded, so it can't be tied to any files. */
  | { state: "unknown" }
  | { state: "valid"; reviewedAt: string; coveredFiles: number; undatedFiles: number }
  | { state: "stale"; reviewedAt: string; coveredFiles: number; newerFiles: number; undatedFiles: number };

const toMs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
};

export function evaluateApproval(d: ApprovalInput): ApprovalValidity {
  if (d.status !== "approved") return { state: "not_approved" };

  const reviewedMs = toMs(d.reviewed_at);
  if (reviewedMs === null || !d.reviewed_at) return { state: "unknown" };

  let coveredFiles = 0;
  let newerFiles = 0;
  let undatedFiles = 0;
  for (const f of d.submission_files ?? []) {
    const uploadedMs = toMs(f?.uploaded_at);
    if (uploadedMs === null) undatedFiles++;
    else if (uploadedMs > reviewedMs) newerFiles++;
    else coveredFiles++;
  }

  return newerFiles > 0
    ? { state: "stale", reviewedAt: d.reviewed_at, coveredFiles, newerFiles, undatedFiles }
    : { state: "valid", reviewedAt: d.reviewed_at, coveredFiles, undatedFiles };
}
