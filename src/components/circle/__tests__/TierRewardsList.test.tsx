import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Zap } from "lucide-react";
import { TierRewardsList } from "../TierRewardsList";
import type { NetworkTierMeta } from "@/lib/referralEngine";

const makeTier = (tier: string, minReferrals: number): NetworkTierMeta =>
  ({
    tier,
    label: `Tier ${tier}`,
    tagline: `${tier} tagline`,
    minReferrals,
    icon: Zap,
    color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
    ringClass: "ring-primary",
    perks: [`${tier} perk`],
    rewards: { freeProMonths: 0, feeDiscount: 0, commissionRate: 0, statusBonusPoints: 0 },
  }) as unknown as NetworkTierMeta;

const tiers = ["spark", "connector", "catalyst", "networker", "mogul", "icon"].map((t, i) => makeTier(t, i * 5));

describe("TierRewardsList", () => {
  it("shows only the first three tiers, in order, until expanded", () => {
    render(<TierRewardsList tiers={tiers} activeTier="spark" referralCount={0} />);
    expect(screen.getAllByText(/^Tier /).map((n) => n.textContent)).toEqual(["Tier spark", "Tier connector", "Tier catalyst"]);
    const toggle = screen.getByRole("button", { name: "See more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("reveals every tier exactly once on See more, then collapses on Show less", () => {
    render(<TierRewardsList tiers={tiers} activeTier="spark" referralCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "See more" }));
    expect(screen.getAllByText(/^Tier /).map((n) => n.textContent)).toEqual(tiers.map((t) => t.label));

    const less = screen.getByRole("button", { name: "Show less" });
    expect(less).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(less);
    expect(screen.getAllByText(/^Tier /)).toHaveLength(3);
    expect(screen.getByRole("button", { name: "See more" })).toBeInTheDocument();
  });

  it("renders no toggle when everything already fits", () => {
    render(<TierRewardsList tiers={tiers.slice(0, 3)} activeTier="spark" referralCount={0} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByText(/^Tier /)).toHaveLength(3);
  });

  it("marks the active tier with You and earlier tiers as Unlocked", () => {
    render(<TierRewardsList tiers={tiers} activeTier="connector" referralCount={5} />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getAllByText("Unlocked")).toHaveLength(1);
  });
});
