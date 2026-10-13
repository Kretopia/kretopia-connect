// Pure, dependency-free decision for "may this share link record an approval
// on this file or deliverable". Imported by edge functions (Deno) and by tests
// (Vite).
//
// A review link has a scope (project, folder, deliverable). The listing RPC
// list_share_link_files already turns that scope into the exact set of files
// the link exposes; this decision reuses that set as the one definition of
// "in scope" instead of re-deriving the scope rules a second time.
//
// Rule (code-only, no schema): an approval may name only a file the link lists,
// and only a deliverable the link covers: any deliverable of the project for a
// project link, exactly scope_ref_id for a deliverable link, and the
// deliverables of the listed files for a folder link. A failed lookup is not
// "no": it answers 503 and grants nothing. The caller has already checked that
// the ids belong to the link's project.

export type ShareScopeDecision =
  | { ok: true }
  | { ok: false; status: 403 | 503; error: "file_not_in_scope" | "deliverable_not_in_scope" | "scope_unavailable" };

export interface ShareVisibleFile {
  file_id: string;
  deliverable_id: string | null;
}

export interface ApprovalTargetFacts {
  scope: string | null | undefined;
  scopeRefId: string | null | undefined;
  deliverableId: string | null | undefined;
  fileId: string | null | undefined;
  /** Rows of list_share_link_files for this token; null when that lookup failed. */
  visibleFiles: ShareVisibleFile[] | null;
}

/** Whether the decision needs the link's file listing at all. */
export function approvalNeedsListing(f: Pick<ApprovalTargetFacts, "scope" | "deliverableId" | "fileId">): boolean {
  return !!f.fileId || (!!f.deliverableId && f.scope === "folder");
}

export function decideApprovalTarget(f: ApprovalTargetFacts): ShareScopeDecision {
  if (!f.fileId && !f.deliverableId) return { ok: true };

  // A scope this code does not know is not a scope it may widen.
  if (f.scope !== "project" && f.scope !== "folder" && f.scope !== "deliverable") {
    return { ok: false, status: 403, error: f.deliverableId ? "deliverable_not_in_scope" : "file_not_in_scope" };
  }

  if (f.fileId) {
    if (f.visibleFiles === null) return { ok: false, status: 503, error: "scope_unavailable" };
    if (!f.visibleFiles.some((v) => v.file_id === f.fileId)) {
      return { ok: false, status: 403, error: "file_not_in_scope" };
    }
  }

  if (f.deliverableId) {
    if (f.scope === "deliverable") {
      if (!f.scopeRefId || f.scopeRefId !== f.deliverableId) {
        return { ok: false, status: 403, error: "deliverable_not_in_scope" };
      }
    } else if (f.scope === "folder") {
      if (f.visibleFiles === null) return { ok: false, status: 503, error: "scope_unavailable" };
      if (!f.visibleFiles.some((v) => v.deliverable_id === f.deliverableId)) {
        return { ok: false, status: 403, error: "deliverable_not_in_scope" };
      }
    }
    // project scope: every deliverable of the project, already checked upstream.
  }

  return { ok: true };
}
