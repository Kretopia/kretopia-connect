import { describe, expect, it } from "vitest";
import { describeCosignRequest, groupCosignRequests, leadingCosignRequest, type CosignRequestRow } from "../cosignRequests";

const NOW = new Date("2026-10-21T12:00:00Z");
const row = (over: Partial<CosignRequestRow> = {}): CosignRequestRow => ({
  credit_id: "c1", token: "tok", endorser_name: "Ada Lovelace", status: "pending",
  requested_at: "2026-10-18T12:00:00Z", responded_at: null, ...over,
});

describe("co-sign requests", () => {
  it("groups by credit, newest first, and drops a status it does not know instead of guessing", () => {
    const grouped = groupCosignRequests([
      row({ requested_at: "2026-10-01T00:00:00Z", status: "declined" }),
      row({ requested_at: "2026-10-10T00:00:00Z", status: "pending" }),
      row({ credit_id: "c2", status: "weird" }),
      row({ credit_id: "c3", status: null }),
    ]);
    expect(grouped.get("c1")!.map((r) => r.state)).toEqual(["pending", "declined"]);
    expect(grouped.has("c2")).toBe(false);
    expect(grouped.has("c3")).toBe(false);
  });

  it("says who, what state and when, for every state", () => {
    const [pending] = groupCosignRequests([row()]).get("c1")!;
    expect(describeCosignRequest(pending, NOW)).toBe("Request sent to Ada Lovelace · Pending, asked 3 days ago");
    expect(describeCosignRequest({ ...pending, requestedAt: NOW.toISOString() }, NOW)).toBe("Request sent to Ada Lovelace · Pending, asked today");
    expect(describeCosignRequest({ ...pending, requestedAt: "2026-10-20T12:00:00Z" }, NOW)).toContain("asked 1 day ago");
    const answered = { ...pending, respondedAt: "2026-10-19T09:00:00Z" };
    expect(describeCosignRequest({ ...answered, state: "accepted" }, NOW)).toMatch(/^Co-signed by Ada Lovelace on .*2026/);
    expect(describeCosignRequest({ ...answered, state: "declined" }, NOW)).toMatch(/^Ada Lovelace declined on .*2026/);
    expect(describeCosignRequest({ ...pending, state: "expired" }, NOW)).toBe("Request to Ada Lovelace expired without an answer");
  });

  it("never shows an email or an invented name for a signer without a name", () => {
    const [request] = groupCosignRequests([row({ endorser_name: null })]).get("c1")!;
    expect(request.signer).toBe("a collaborator");
    expect(groupCosignRequests([row({ endorser_name: "   " })]).get("c1")![0].signer).toBe("a collaborator");
  });

  it("leads with a yes, then a request still waiting, then the latest no", () => {
    const list = groupCosignRequests([
      row({ status: "declined", requested_at: "2026-10-20T00:00:00Z" }),
      row({ status: "pending", requested_at: "2026-10-15T00:00:00Z" }),
    ]).get("c1")!;
    expect(leadingCosignRequest(list)!.state).toBe("pending");
    const withYes = groupCosignRequests([row({ status: "accepted", requested_at: "2026-09-01T00:00:00Z" }), row({ status: "pending" })]).get("c1")!;
    expect(leadingCosignRequest(withYes)!.state).toBe("accepted");
    expect(leadingCosignRequest(undefined)).toBeNull();
    expect(leadingCosignRequest([])).toBeNull();
  });
});
