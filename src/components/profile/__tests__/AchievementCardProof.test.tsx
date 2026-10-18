import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/passport/HoloCard", () => ({ HoloCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import { AchievementCard } from "../AchievementCard";

const renderCard = (props: { verificationStatus?: string; endorsementCount?: number }) =>
  render(<AchievementCard variant="credit" title="Sud EP" subtitle="Editor" year={2025} {...(props as object)} />);

describe("Passport credit card: the same proof words as Credits", () => {
  it("self-declared", () => {
    renderCard({ verificationStatus: "unverified", endorsementCount: 0 });
    expect(screen.getByText("Self-declared")).toBeInTheDocument();
    expect(screen.queryByText(/Self-claimed/)).toBeNull();
  });

  it("co-signed with the number of collaborators, not 'Vouched'", () => {
    renderCard({ verificationStatus: "unverified", endorsementCount: 2 });
    expect(screen.getByText("Co-signed · 2")).toBeInTheDocument();
    expect(screen.queryByText(/Vouched/)).toBeNull();
  });

  it("pending, even when collaborators have already co-signed: it does not count yet", () => {
    renderCard({ verificationStatus: "pending_review", endorsementCount: 3 });
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByText(/Co-signed/)).toBeNull();
  });

  it("verified", () => {
    renderCard({ verificationStatus: "verified", endorsementCount: 1 });
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});
