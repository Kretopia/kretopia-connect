import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HingeStyleCard } from "../HingeStyleCard";
import type { SwipeProfile } from "@/hooks/useSwipeProfiles";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
        }),
      }),
    }),
  },
}));

const baseProfile: SwipeProfile = {
  id: "p1",
  user_id: "user-1",
  full_name: "Ava Chen",
  role: "Photographer",
  bio: "Editorial and portrait photographer based in Los Angeles.",
  avatar_url: "https://example.com/ava.jpg",
  location: "Los Angeles, CA",
  level: 3,
  professional_skills: ["Lighting", "Retouching"],
  passion_skills: null,
  badge: null,
  collab_intent: "seeking_collaborators",
};

function renderCard(overrides: Partial<SwipeProfile> = {}) {
  const onLike = vi.fn();
  const onPass = vi.fn();
  const onViewProfile = vi.fn();
  render(
    <TooltipProvider>
      <HingeStyleCard
        profile={{ ...baseProfile, ...overrides }}
        onLike={onLike}
        onPass={onPass}
        onViewProfile={onViewProfile}
      />
    </TooltipProvider>,
  );
  return { onLike, onPass, onViewProfile };
}

describe("HingeStyleCard", () => {
  it("renders the profile's name, role and location", () => {
    renderCard();
    expect(screen.getByText("Ava Chen")).toBeInTheDocument();
    expect(screen.getByText("Photographer")).toBeInTheDocument();
    expect(screen.getByText("Los Angeles, CA")).toBeInTheDocument();
  });

  it("shows common-ground badges derived from _matchSignals", () => {
    renderCard({
      _matchSignals: { sameSector: true, sameCity: true, pastCollab: true, skillOverlapRatio: 0 },
    });
    expect(screen.getByText("Same sector")).toBeInTheDocument();
    expect(screen.getByText("Same city")).toBeInTheDocument();
    expect(screen.getByText("Worked together before")).toBeInTheDocument();
  });

  it("shows no common-ground row when nothing matches", () => {
    renderCard({
      _matchSignals: { sameSector: false, sameCity: false, pastCollab: false, skillOverlapRatio: 0 },
    });
    expect(screen.queryByText("Same sector")).not.toBeInTheDocument();
    expect(screen.queryByText("Same city")).not.toBeInTheDocument();
  });

  it("calls onLike with a 'profile' context when Connect is clicked", async () => {
    const { onLike } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /view ava chen's full profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));
    await waitFor(() => expect(onLike).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1" }), { type: "profile", label: "their profile" }));
  });

  it("calls onPass when the pass button is clicked", async () => {
    const { onPass } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /pass on ava chen/i }));
    await waitFor(() => expect(onPass).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1" })));
  });

  it("supports keyboard nav: ArrowRight connects, ArrowLeft passes, Enter views profile", async () => {
    const { onLike, onPass, onViewProfile } = renderCard();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onViewProfile).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(onLike).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(onPass).toHaveBeenCalledTimes(1));
  });

  it("ignores keyboard nav while focus is in a text field", () => {
    const { onViewProfile } = renderCard();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "Enter" });
    document.body.removeChild(input);
    expect(onViewProfile).not.toHaveBeenCalled();
  });
});
