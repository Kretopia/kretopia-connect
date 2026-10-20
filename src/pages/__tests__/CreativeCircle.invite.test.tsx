import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rows: [] as Array<{ invite_code: string }> }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
vi.mock("@/hooks/useReferralNetwork", () => ({
  useReferralNetwork: () => ({ tier: { tier: "none", minReferrals: 0 }, referralCount: 0, longestChain: 0, commissionEarned: 0 }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain: any = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, then: (resolve: (v: unknown) => void) => resolve({ data: h.rows }) };
      return chain;
    },
  },
}));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => null }));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({ StudioFeatureShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/passport/HoloCard", () => ({ HoloCard: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/brand/KretoCharacter", () => ({ KretoCharacter: () => null }));
vi.mock("@/components/circle/TierRewardsList", () => ({ TierMedallion: () => null, TierRewardsList: () => null }));

import CreativeCircle from "../CreativeCircle";

const renderPage = () => render(<MemoryRouter><CreativeCircle /></MemoryRouter>);

describe("Creative Circle: invite friends", () => {
  beforeEach(() => { h.rows = []; });

  it("has an Invite friends button that takes you to the invite card with the personal link", async () => {
    h.rows = [{ invite_code: "ABC123" }];
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderPage();
    expect(await screen.findByText("www.kretopia.com/join/ABC123")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite friends" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Invite friends/ }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("invite-friends"));
  });

  it("says plainly that there is no link yet instead of showing a fake one", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Complete your profile to get your invite link")).toBeInTheDocument());
    expect(screen.queryByText(/kretopia\.com\/join/)).toBeNull();
  });
});
