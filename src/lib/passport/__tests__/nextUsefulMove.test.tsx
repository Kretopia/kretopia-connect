import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeHidden, LATER_MS, milestones, nextUsefulMove, type MoveInput } from "@/lib/passport/nextUsefulMove";
import { NextUsefulMoveCard } from "@/components/passport/NextUsefulMoveCard";

const usable = { full_name: "Ana Lima", role: "Colorist", bio: "Grades features and ads." };
const input = (over: Partial<MoveInput> = {}): MoveInput => ({ profile: usable, creditCount: 1, cosignStates: [], ...over });

describe("next useful move: one deterministic step from real state", () => {
  it("walks Passport -> proof -> ask -> waiting -> confirmation, in that order", () => {
    expect(nextUsefulMove(input({ profile: { ...usable, bio: " " } }))?.id).toBe("finish_passport");
    expect(nextUsefulMove(input({ creditCount: 0 }))?.id).toBe("add_proof");
    expect(nextUsefulMove(input())?.id).toBe("request_cosign");
    expect(nextUsefulMove(input({ cosignStates: ["pending"] }))?.id).toBe("await_cosign");
    expect(nextUsefulMove(input({ cosignStates: ["declined", "accepted"] }))?.id).toBe("view_confirmation");
  });

  it("a sent request is not Co-Signed; only an accepted confirmation is", () => {
    expect(milestones(input({ cosignStates: ["pending", "declined", "expired"] })).co_signed).toBe(false);
    expect(milestones(input({ cosignStates: ["accepted"] })).co_signed).toBe(true);
  });

  it("a move put aside is skipped without a louder replacement, and later steps never jump ahead", () => {
    expect(nextUsefulMove(input({ creditCount: 0 }), new Set(["add_proof"]))).toBeNull();
    expect(nextUsefulMove(input(), new Set(["request_cosign"]))).toBeNull();
  });

  it("'Later' expires after a week; 'Not relevant' stays", () => {
    const now = 1_000_000;
    expect([...activeHidden({ add_proof: { until: now + LATER_MS }, request_cosign: { until: null } }, now)].sort()).toEqual(["add_proof", "request_cosign"]);
    expect([...activeHidden({ add_proof: { until: now - 1 } }, now)]).toEqual([]);
  });

  it("asking someone links to the page where the person chooses; nothing is sent from the suggestion", () => {
    expect(nextUsefulMove(input())?.to).toBe("/credits?action=co_sign");
  });
});

describe("pilot card", () => {
  beforeEach(() => localStorage.clear());

  it("shows the three steps and the move; Later hides it, remembered per user, with no penalty", () => {
    const onUse = vi.fn();
    const { unmount } = render(<MemoryRouter><NextUsefulMoveCard userId="u1" input={input()} onUse={onUse} /></MemoryRouter>);
    expect(screen.getByText("Passport Live")).toBeInTheDocument();
    expect(screen.getByText("Ask a collaborator to confirm a credit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(onUse).toHaveBeenCalledWith("request_cosign", "later");
    expect(screen.getByText("Nothing to do here right now.")).toBeInTheDocument();
    unmount();
    render(<MemoryRouter><NextUsefulMoveCard userId="u1" input={input()} /></MemoryRouter>);
    expect(screen.queryByText("Ask a collaborator to confirm a credit")).not.toBeInTheDocument();
  });

  it("is off unless FEATURE_PILOT_NEXT_MOVE is set, and only the owner's view mounts it", () => {
    const profile = readFileSync(resolve(__dirname, "../../../pages/Profile.tsx"), "utf8");
    expect(profile).toContain('isFeatureEnabled("FEATURE_PILOT_NEXT_MOVE")');
    expect(profile).toMatch(/\{nextMoveEnabled && \(\s*<NextUsefulMoveCard/);
  });
});

describe("the credit-confirmed notification opens that credit", () => {
  it("the trigger's link is the page's reader (prepared paste script, not applied)", () => {
    const root = resolve(__dirname, "../../../..");
    const apply = readFileSync(resolve(root, "docs/security/activation/A1_cosign_notification_link/02_apply.sql"), "utf8");
    expect(apply).toContain("'/credits?credit=' || NEW.credit_id::text");
    expect(apply).toContain("confirmed your credit on");
    expect(apply).not.toMatch(/verified your work/);
    const page = readFileSync(resolve(root, "src/pages/CreditsDashboard.tsx"), "utf8");
    expect(page).toContain('searchParams.get("credit")');
    expect(page).toContain("document.getElementById(`credit-${focusCredit}`)");
    expect(readFileSync(resolve(root, "src/components/credits/CreditsStampsPanel.tsx"), "utf8")).toContain("id={`credit-${c.id}`}");
  });
});
