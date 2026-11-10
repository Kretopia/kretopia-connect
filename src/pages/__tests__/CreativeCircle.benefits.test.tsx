import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Creative Circle as the home of Perks (its Member benefits) and of the Founding status. The page, its Founding panel and its benefits
 * entry are the real ones; the database, the hooks that read it and the 3D and tier decorations are stood in for.
 */
const quest = (current: number, target: number) => ({ current, target, completed: current >= target });
const h = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  founding: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/hooks/useFoundingMemberProgress", () => ({ useFoundingMemberProgress: () => h.founding }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
vi.mock("@/hooks/useReferralNetwork", () => ({
  useReferralNetwork: () => ({ tier: { tier: "none", minReferrals: 0 }, referralCount: 0, totalNetworkSize: 0, longestChain: 0, commissionEarned: 0 }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, then: (resolve: (v: unknown) => void) => resolve({ data: [] }) };
      return chain;
    },
  },
}));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => null }));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({ StudioFeatureShell: ({ children }: { children?: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/passport/HoloCard", () => ({ HoloCard: ({ children }: { children?: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/brand/KretoCharacter", () => ({ KretoCharacter: () => null }));
vi.mock("@/components/circle/TierRewardsList", () => ({ TierMedallion: () => null, TierRewardsList: () => null }));
vi.mock("react-dom-confetti", () => ({ default: () => null }));

import CreativeCircle from "../CreativeCircle";

const draw = (entry = "/creative-circle") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/creative-circle" element={<CreativeCircle />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  h.user = { id: "user-1" };
  h.founding = {
    loading: false,
    completedCount: 1,
    allComplete: false,
    badgeAwarded: false,
    progress: { claim_profile: quest(1, 1), log_credits: quest(1, 3), invite_signups: quest(0, 3) },
  };
});

describe("Creative Circle: Member benefits", () => {
  it("offers Perks as Member benefits, and the link goes to the Perks page", () => {
    draw();
    const benefits = screen.getByRole("link", { name: /Member benefits/ });
    expect(benefits).toHaveAttribute("href", "/perks");
    expect(benefits).toHaveTextContent(/Perks by ThriveStatus tier/);
  });
});

describe("Creative Circle: the Founding status", () => {
  it("shows where the member stands: the milestones, their progress and what to do next", () => {
    draw();
    const founding = document.getElementById("founding") as HTMLElement;
    expect(founding).toBeInTheDocument();
    expect(within(founding).getByRole("heading", { name: "Founding status" })).toBeInTheDocument();
    expect(within(founding).getByText("1 of 3 milestones complete")).toBeInTheDocument();
    expect(within(founding).getAllByRole("listitem")).toHaveLength(3);
    // the finished step offers nothing; the two open ones say what to do and where
    expect(within(founding).queryByRole("link", { name: "Verify profile" })).not.toBeInTheDocument();
    expect(within(founding).getByRole("link", { name: "Add a credit" })).toHaveAttribute("href", "/profile");
    expect(within(founding).getByRole("link", { name: "Invite friends" })).toHaveAttribute("href", "/profile?tab=invite");
  });

  it("once the badge is awarded, says it is live and sends the member to their Passport", () => {
    h.founding = {
      loading: false,
      completedCount: 3,
      allComplete: true,
      badgeAwarded: true,
      progress: { claim_profile: quest(1, 1), log_credits: quest(3, 3), invite_signups: quest(3, 3) },
    };
    draw();
    const founding = document.getElementById("founding") as HTMLElement;
    expect(within(founding).getByText("Your badge is live.")).toBeInTheDocument();
    expect(within(founding).getByRole("link", { name: "View my profile" })).toHaveAttribute("href", "/profile");
    expect(within(founding).queryByRole("link", { name: "Add a credit" })).not.toBeInTheDocument();
  });

  it("the old /founding-member address (now /creative-circle#founding) brings the status into view", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    draw("/creative-circle#founding");
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("founding"));
  });

  it("does not scroll anywhere when it is opened without the hash", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    draw("/creative-circle");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("Creative Circle: the gate is kept", () => {
  // The route is behind ProtectedRoute (see consolidationRoutes.test.tsx); and the page itself draws nothing for a visitor without an account.
  it("a visitor who is not signed in is shown neither the benefits nor the Founding status", () => {
    h.user = null;
    const { container } = draw();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link", { name: /Member benefits/ })).not.toBeInTheDocument();
    expect(document.getElementById("founding")).toBeNull();
  });
});
