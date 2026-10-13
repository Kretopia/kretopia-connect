import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  approvalNeedsListing,
  decideApprovalTarget,
  type ShareVisibleFile,
} from "../../../supabase/functions/_shared/shareLinkScope";

// The listing a link exposes (list_share_link_files). F1 and F2 belong to
// deliverable D1, F3 to D2, F4 to no deliverable.
const listing: ShareVisibleFile[] = [
  { file_id: "F1", deliverable_id: "D1" },
  { file_id: "F2", deliverable_id: "D1" },
  { file_id: "F3", deliverable_id: "D2" },
  { file_id: "F4", deliverable_id: null },
];

const folderLink = { scope: "folder", scopeRefId: "FOLDER-1" };
const deliverableLink = { scope: "deliverable", scopeRefId: "D1" };
const projectLink = { scope: "project", scopeRefId: null };

// What a folder link exposes: only F1 and F4. What a deliverable link
// exposes: only D1's files.
const folderListing = listing.filter((f) => f.file_id === "F1" || f.file_id === "F4");
const deliverableListing = listing.filter((f) => f.deliverable_id === "D1");

describe("decideApprovalTarget: an approval stays inside the link's scope", () => {
  describe("project link", () => {
    it("allows a listed file and any deliverable of the project", () => {
      expect(decideApprovalTarget({ ...projectLink, fileId: "F3", deliverableId: "D2", visibleFiles: listing })).toEqual({ ok: true });
    });

    it("refuses a file the listing does not contain", () => {
      expect(decideApprovalTarget({ ...projectLink, fileId: "F-OTHER", deliverableId: null, visibleFiles: listing }))
        .toEqual({ ok: false, status: 403, error: "file_not_in_scope" });
    });
  });

  describe("folder link", () => {
    it("allows a file of the folder and the deliverable that file belongs to", () => {
      expect(decideApprovalTarget({ ...folderLink, fileId: "F1", deliverableId: "D1", visibleFiles: folderListing })).toEqual({ ok: true });
    });

    it("allows a folder file that has no deliverable", () => {
      expect(decideApprovalTarget({ ...folderLink, fileId: "F4", deliverableId: null, visibleFiles: folderListing })).toEqual({ ok: true });
    });

    it("refuses a file of the project that is outside the folder", () => {
      expect(decideApprovalTarget({ ...folderLink, fileId: "F3", deliverableId: null, visibleFiles: folderListing }))
        .toEqual({ ok: false, status: 403, error: "file_not_in_scope" });
    });

    it("refuses a deliverable none of the folder's files belongs to, even in the same project", () => {
      expect(decideApprovalTarget({ ...folderLink, fileId: null, deliverableId: "D2", visibleFiles: folderListing }))
        .toEqual({ ok: false, status: 403, error: "deliverable_not_in_scope" });
    });

    it("refuses a deliverable approval alone when the folder exposes nothing", () => {
      expect(decideApprovalTarget({ ...folderLink, fileId: null, deliverableId: "D1", visibleFiles: [] }))
        .toEqual({ ok: false, status: 403, error: "deliverable_not_in_scope" });
    });
  });

  describe("deliverable link", () => {
    it("allows the deliverable and one of its own files", () => {
      expect(decideApprovalTarget({ ...deliverableLink, fileId: "F2", deliverableId: "D1", visibleFiles: deliverableListing })).toEqual({ ok: true });
    });

    it("refuses another deliverable of the project", () => {
      expect(decideApprovalTarget({ ...deliverableLink, fileId: null, deliverableId: "D2", visibleFiles: deliverableListing }))
        .toEqual({ ok: false, status: 403, error: "deliverable_not_in_scope" });
    });

    it("refuses a file of the project that is not one of the deliverable's files", () => {
      expect(decideApprovalTarget({ ...deliverableLink, fileId: "F3", deliverableId: "D1", visibleFiles: deliverableListing }))
        .toEqual({ ok: false, status: 403, error: "file_not_in_scope" });
    });

    it("refuses when the link carries no deliverable reference", () => {
      expect(decideApprovalTarget({ scope: "deliverable", scopeRefId: null, fileId: null, deliverableId: "D1", visibleFiles: deliverableListing }))
        .toEqual({ ok: false, status: 403, error: "deliverable_not_in_scope" });
    });
  });

  describe("fail closed", () => {
    it("answers 503 and grants nothing when the listing lookup failed for a file", () => {
      expect(decideApprovalTarget({ ...projectLink, fileId: "F1", deliverableId: null, visibleFiles: null }))
        .toEqual({ ok: false, status: 503, error: "scope_unavailable" });
    });

    it("answers 503 when the listing failed for a folder link's deliverable", () => {
      expect(decideApprovalTarget({ ...folderLink, fileId: null, deliverableId: "D1", visibleFiles: null }))
        .toEqual({ ok: false, status: 503, error: "scope_unavailable" });
    });

    it("refuses an unknown or missing scope instead of treating it as a project link", () => {
      expect(decideApprovalTarget({ scope: "everything", scopeRefId: null, fileId: "F1", deliverableId: null, visibleFiles: listing }))
        .toMatchObject({ ok: false, status: 403 });
      expect(decideApprovalTarget({ scope: null, scopeRefId: null, fileId: null, deliverableId: "D1", visibleFiles: listing }))
        .toMatchObject({ ok: false, status: 403 });
    });
  });

  it("allows an approval that names no file and no deliverable, as before", () => {
    expect(decideApprovalTarget({ ...folderLink, fileId: null, deliverableId: null, visibleFiles: [] })).toEqual({ ok: true });
  });
});

describe("approvalNeedsListing", () => {
  it("needs the listing for any file, and for a deliverable only on a folder link", () => {
    expect(approvalNeedsListing({ scope: "project", fileId: "F1", deliverableId: null })).toBe(true);
    expect(approvalNeedsListing({ scope: "folder", fileId: null, deliverableId: "D1" })).toBe(true);
    expect(approvalNeedsListing({ scope: "deliverable", fileId: null, deliverableId: "D1" })).toBe(false);
    expect(approvalNeedsListing({ scope: "project", fileId: null, deliverableId: "D1" })).toBe(false);
    expect(approvalNeedsListing({ scope: "folder", fileId: null, deliverableId: null })).toBe(false);
  });
});

describe("redeem-project-share wiring", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/redeem-project-share/index.ts"), "utf8");

  it("checks the target against the link's scope before the approval is written", () => {
    const decision = source.indexOf("decideApprovalTarget({");
    const insert = source.indexOf('.from("share_link_approvals")\n        .insert(');
    const statusUpdate = source.indexOf('.from("project_deliverables")\n          .update(');
    expect(decision).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(decision);
    expect(statusUpdate).toBeGreaterThan(decision);
  });

  it("reads the link's own file listing rather than re-deriving the scope", () => {
    expect(source).toContain('rpc("list_share_link_files", { _token: token })');
  });

  it("keeps the earlier same-project checks", () => {
    expect(source).toContain("target.project_id !== link.project_id");
    expect(source).toContain("fileRow.project_id !== link.project_id");
  });
});
