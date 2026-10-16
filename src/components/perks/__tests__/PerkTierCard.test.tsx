import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Shield } from "lucide-react";
import { getAllTiers } from "@/lib/statusEngine";
import { PerkTierCard } from "../PerkTierCard";

const tiers = getAllTiers();
const byTier = (t: string) => tiers.find((x) => x.tier === t)!;

describe("PerkTierCard", () => {
  it("leads with the distinct social-proof name, not the shared group label", () => {
    render(<PerkTierCard tier={byTier("freelancer")} icon={Shield} state="unlocked" verifiedCredits={9} />);
    expect(screen.getByRole("heading", { name: "Verified Creator" })).toBeInTheDocument();
    expect(screen.getByText("Unlocked")).toBeInTheDocument();
  });

  it("shows the engine's own credit gate and the viewer's real progress toward it", () => {
    render(<PerkTierCard tier={byTier("thriver")} icon={Shield} state="next" verifiedCredits={7} />);
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("13 more verified credits — you have 7")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax", "20");
    expect(bar).toHaveAttribute("aria-valuenow", "7");
  });

  it("does not say a reached tier still needs unlocking", () => {
    render(<PerkTierCard tier={byTier("freelancer")} icon={Shield} state="current" verifiedCredits={7} />);
    expect(screen.getByText("verified credits — reached")).toBeInTheDocument();
    expect(screen.queryByText(/to unlock/)).toBeNull();
  });

  it("offers the primary action only on the next tier, and it fires", () => {
    const onAction = vi.fn();
    const { rerender } = render(<PerkTierCard tier={byTier("thriver")} icon={Shield} state="next" verifiedCredits={7} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: /Add a verified credit/ }));
    expect(onAction).toHaveBeenCalledTimes(1);

    for (const state of ["current", "unlocked", "locked"] as const) {
      rerender(<PerkTierCard tier={byTier("thriver")} icon={Shield} state={state} verifiedCredits={7} onAction={onAction} />);
      expect(screen.queryByRole("button")).toBeNull();
    }
  });

  it("states upper-tier award/press gates exactly as the engine does", () => {
    render(<PerkTierCard tier={byTier("celebrity")} icon={Shield} state="locked" verifiedCredits={7} />);
    expect(screen.getByText("plus 2 awards or 3 press features")).toBeInTheDocument();
    render(<PerkTierCard tier={byTier("icon")} icon={Shield} state="locked" verifiedCredits={7} />);
    expect(screen.getByText("plus 3 awards and 5 press features")).toBeInTheDocument();
  });

  it("does not invent a requirement for the starting tier, and shows no progress for reached tiers", () => {
    render(<PerkTierCard tier={byTier("hobbyist")} icon={Shield} state="current" verifiedCredits={3} />);
    expect(screen.getByText(/Starts here/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("lists every perk once and credits Kretopia as provider", () => {
    const tier = byTier("professional");
    render(<PerkTierCard tier={tier} icon={Shield} state="locked" verifiedCredits={7} />);
    for (const perk of tier.perks) expect(screen.getAllByText(perk)).toHaveLength(1);
    expect(screen.getByText("Provided by Kretopia")).toBeInTheDocument();
  });

  it("says the credits requirement is met instead of a negative remainder", () => {
    render(<PerkTierCard tier={byTier("celebrity")} icon={Shield} state="next" verifiedCredits={95} />);
    expect(screen.getByText("Credits requirement met")).toBeInTheDocument();
  });
});
