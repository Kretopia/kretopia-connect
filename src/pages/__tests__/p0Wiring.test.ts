import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-level guards for the P0 destination and wording fixes whose pages are too large to mount in a unit test.
const read = (p: string) => readFileSync(resolve(__dirname, "../../..", p), "utf8");

describe("P0 destinations", () => {
  it("/profile/edit opens the edit dialog on /profile instead of matching /profile/:userId", () => {
    const app = read("src/App.tsx");
    const edit = app.indexOf('<Route path="/profile/edit" element={<Navigate to="/profile?edit=true" replace />} />');
    expect(edit).toBeGreaterThan(-1);
    expect(app.indexOf('<Route path="/profile/:userId"')).toBeGreaterThan(edit);
    expect(read("src/pages/Profile.tsx")).toMatch(/params\.get\("edit"\) !== "true"[\s\S]*setIsEditOpen\(true\)/);
  });

  it("Today's own-Passport actions open the person's /profile, not the directory", () => {
    for (const f of ["src/components/today/TodayCommandCenter.tsx", "src/components/today/TodayMiniPassport.tsx", "src/components/today/today.selectors.ts"]) {
      expect(read(f), f).not.toMatch(/(to|href)[=:] ?"\/passport"/);
    }
  });

  it("the co-sign action opens Credits at the Stamps section, where each stamp asks for a co-sign", () => {
    expect(read("src/lib/passport/standing.ts")).toContain('deeplink: "/credits?action=co_sign"');
    expect(read("src/pages/CreditsDashboard.tsx")).toMatch(/get\("action"\) === "co_sign"[\s\S]*getElementById\("stamps"\)/);
  });
});

describe("P0 wording and results", () => {
  it("onboarding does not promise verified stamps while it saves them as pending", () => {
    const src = read("src/pages/Onboarding.tsx");
    expect(src).not.toMatch(/turn it into verified/);
    expect(src).toContain("not verified until it is confirmed");
    expect(src).toContain('verification_status: "pending"');
  });

  it("a failed drag-to-approve is put back and never announced", () => {
    const src = read("src/components/project/DeliverablesBoard.tsx");
    expect(src).not.toMatch(/let moved = true/);
    expect(src).toMatch(/if \(moveError\) \{[\s\S]*status: moving\.status[\s\S]*return;\s*\}/);
  });

  it("the Stripe return on a project page never says the payment was received", () => {
    const src = read("src/pages/ThriveDesk.tsx");
    expect(src).not.toContain('"Payment received"');
    expect(src).toContain("milestoneReturnNotice(paymentStatus)");
  });

  it("a manual bank-transfer record is worded as a record, not as provider-confirmed", () => {
    const src = read("src/components/project/finance/MarkPaidBankTransferDialog.tsx");
    expect(src).not.toContain('toast.success("Marked as paid"');
    expect(src).toContain("not confirmed by a payment provider");
  });
});
