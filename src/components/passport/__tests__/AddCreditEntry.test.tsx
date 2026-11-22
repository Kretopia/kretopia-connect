import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * "Add credit" had no reachable form: the owner's Passport offered only "Your record" (/credits), whose "Add your first credit"
 * went to /profile?add=credit, which nothing read, so people bounced between the two pages. The Passport now has one obvious
 * Add credit action, and every ?add=credit link lands on a page that opens the form.
 */
vi.mock("@/components/agent/SurfaceProactiveCards", () => ({ SurfaceProactiveCards: () => null }));
vi.mock("../PassportMomentum", () => ({ PassportMomentum: () => null }));
vi.mock("../RecentlyWorkedWith", () => ({ RecentlyWorkedWith: () => null }));
vi.mock("../ThriveRemembersChip", () => ({ ThriveRemembersChip: () => null }));
vi.mock("@/lib/analytics", () => ({ analytics: { trustActionStarted: vi.fn() } }));

import { PassportOverview } from "../PassportOverview";

const standing = { nextActions: [] } as unknown as Parameters<typeof PassportOverview>[0]["standing"];
const renderOverview = (onAddCredit?: () => void) =>
  render(
    <MemoryRouter>
      <PassportOverview userId="u1" credits={[]} verified={0} cosigns={0} standing={standing} onReviewCredits={vi.fn()} onAddCredit={onAddCredit} />
    </MemoryRouter>,
  );

describe("one obvious Add credit entry point", () => {
  it("the owner's Passport overview shows Add credit and opens the form in place", () => {
    const onAddCredit = vi.fn();
    renderOverview(onAddCredit);
    fireEvent.click(screen.getByRole("button", { name: /Add credit/ }));
    expect(onAddCredit).toHaveBeenCalledTimes(1);
  });

  it("without an owner handler (someone else's view) there is no Add credit button", () => {
    renderOverview();
    expect(screen.queryByRole("button", { name: /Add credit/ })).not.toBeInTheDocument();
  });

  it("every /profile?add=credit link has a reader on the Profile page that opens the form and drops the parameter", () => {
    const root = resolve(__dirname, "../../../..");
    const profile = readFileSync(resolve(root, "src/pages/Profile.tsx"), "utf8");
    expect(profile).toMatch(/searchParams\.get\("add"\) !== "credit"/);
    expect(profile).toContain("setAddCreditOpen(true)");
    expect(profile).toContain('next.delete("add")');
    expect(profile).toMatch(/<ICDBCreditForm open=\{addCreditOpen\}[^>]*onSuccess=\{fetchData\}/);
    for (const linker of ["src/pages/CreditsDashboard.tsx", "src/components/credits/CreditsStampsPanel.tsx"]) {
      expect(readFileSync(resolve(root, linker), "utf8")).toContain('"/profile?add=credit"');
    }
  });
});
