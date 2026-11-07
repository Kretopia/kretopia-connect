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
  cover_image_url: null,
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

  it("opens the profile without starting a connection", () => {
    const { onLike, onViewProfile } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: /view ava chen's full profile/i }));
    expect(onViewProfile).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1' }));
    expect(onLike).not.toHaveBeenCalled();
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

describe("HingeStyleCard: why you connect (similar and complementary)", () => {
  const chips = () => screen.getByText("Why you connect").parentElement!.textContent ?? "";

  it("names a complementary craft and the skills they bring, not only the shared ones", () => {
    renderCard({
      role: "Fashion stylist",
      _matchSignals: { sameSector: false, sameCity: false, pastCollab: false, skillOverlapRatio: 0, sharedSkills: [], complementaryCraft: true, newSkills: ["wardrobe", "set styling"] },
    });
    expect(chips()).toContain("Complements your craft · Fashion stylist");
    expect(chips()).toContain("Brings skills you don't list: Wardrobe, Set styling");
    expect(chips()).not.toContain("Shared craft");
  });

  it("names a shared craft, the city and shared skills for a similar profile", () => {
    renderCard({
      _matchSignals: { sameSector: true, sameCity: true, pastCollab: false, skillOverlapRatio: 0.5, sharedSkills: ["lighting"] },
    });
    expect(chips()).toContain("Shared craft · Photographer");
    expect(chips()).toContain("Shared skills: Lighting");
    expect(chips()).toContain("Based in Los Angeles");
    expect(chips()).not.toContain("Complements");
  });

  it("puts 'Already interested in you' first when they have swiped right on you", () => {
    renderCard({
      _likedYou: true,
      _matchSignals: { sameSector: true, sameCity: false, pastCollab: false, skillOverlapRatio: 0 },
    });
    expect(chips().indexOf("Already interested in you")).toBeGreaterThanOrEqual(0);
    expect(chips().indexOf("Already interested in you")).toBeLessThan(chips().indexOf("Shared craft"));
  });

  it("does not repeat their openness as a reason: the card already shows it as their intent", () => {
    renderCard({ _matchSignals: { sameSector: true, sameCity: false, pastCollab: false, skillOverlapRatio: 0 } });
    expect(chips()).not.toContain("Open to collaborating");
    expect(screen.getByText(/Seeking collaborators/i)).toBeInTheDocument();
  });

  it("shows no 'Why you connect' block when nothing is true, instead of inventing one", () => {
    renderCard({ _matchSignals: { sameSector: false, sameCity: false, pastCollab: false, skillOverlapRatio: 0 } });
    expect(screen.queryByText("Why you connect")).toBeNull();
  });
});

describe("HingeStyleCard: the shared card shape", () => {
  const draw = (variant?: "default" | "shell") =>
    render(
      <TooltipProvider>
        <HingeStyleCard profile={{ ...baseProfile, sub_roles: ["Editorial"] } as SwipeProfile} onLike={vi.fn()} onPass={vi.fn()} onViewProfile={vi.fn()} variant={variant} />
      </TooltipProvider>,
    );
  const root = () => screen.getByRole("heading", { name: "Ava Chen" }).closest(".w-full.min-w-0") as HTMLElement;

  it("is drawn as it always was unless a surface asks for the shared shape (Discover's swipe lane is unchanged)", () => {
    draw();
    expect(screen.getByRole("heading", { name: "Ava Chen" }).className).toContain("text-2xl");
    expect(root().className).toContain("rounded-lg");
    expect(root().className).not.toContain("rounded-2xl");
    expect(screen.getByText("About").className).toContain("text-[10px]");
  });

  it("takes the Scout hybrid card's radius, title and label scale when asked, with the same content and the same swipe actions", () => {
    draw("shell");
    const title = screen.getByRole("heading", { name: "Ava Chen" });
    expect(title.className).toContain("text-[21px]");
    expect(title.className).toContain("line-clamp-2");
    expect(title.className).not.toContain("text-2xl");
    expect(root().className).toContain("rounded-2xl");
    expect(root().className).not.toContain("rounded-lg");
    expect(screen.getByText("About").className).toContain("text-[9px]");
    // presentation only: what the card says and what its buttons do are untouched
    expect(screen.getByText("Photographer")).toBeInTheDocument();
    expect(screen.getByText("Los Angeles, CA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pass/i })).toBeInTheDocument();
  });

  it("follows the hybrid card's rules for spacing, cover, meta, description, chips and buttons, not only its radius", () => {
    const { container } = draw("shell");
    // cover: 16:9 when stacked, as on every card (the two-column desktop layout keeps its 4:3)
    expect(container.querySelector(".aspect-\\[16\\/9\\]")).not.toBeNull();
    expect(container.querySelector(".aspect-\\[4\\/3\\]")).toBeNull();
    // padding: the shell's, in both columns
    expect(container.querySelectorAll(".p-5").length).toBeGreaterThanOrEqual(2);
    // type: role and place at the meta scale, the bio at the description scale
    expect(screen.getByText("Photographer").closest("div")!.className).toContain("text-xs");
    expect(screen.getByText(/Editorial and portrait photographer/).className).toContain("leading-[1.55]");
    // chips: the shell's pill, still buttons that like the skill
    const chip = screen.getByRole("button", { name: /lighting/i });
    expect(chip.className).toContain("rounded-full");
    expect(chip.className).toContain("text-[10px]");
    // buttons: the shell's icon button for Pass and View, its primary button (brand-gradient border) for Connect
    for (const name of [/pass on/i, /full profile/i]) {
      const icon = screen.getByRole("button", { name });
      expect(icon.className).toContain("rounded-[10px]");
      expect(icon.className).toContain("h-11");
    }
    const connect = screen.getByRole("button", { name: /connect/i });
    expect(connect.className).toContain("rounded-[9px]");
    expect(connect.className).toContain("border-transparent");
    expect(connect.className).not.toContain("cta-solid");
    // the brand-gradient border is an inline background that jsdom cannot parse; it is checked in the browser run instead
  });

  it("keeps every action and the keyboard shortcuts in the shared shape", async () => {
    const onLike = vi.fn();
    const onPass = vi.fn();
    const onViewProfile = vi.fn();
    render(
      <TooltipProvider>
        <HingeStyleCard profile={baseProfile} onLike={onLike} onPass={onPass} onViewProfile={onViewProfile} variant="shell" />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /full profile/i }));
    expect(onViewProfile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => expect(onLike).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1" }), { type: "profile", label: "their profile" }));
    fireEvent.click(screen.getByRole("button", { name: /lighting/i }));
    expect(onLike).toHaveBeenCalledWith(expect.anything(), { type: "skill", label: "lighting" });
    fireEvent.click(screen.getByRole("button", { name: /pass on/i }));
    await waitFor(() => expect(onPass).toHaveBeenCalledTimes(1));
  });

  it("leaves the default variant exactly as it was: no shell token reaches Discover's swipe lane", () => {
    const { container } = draw();
    expect(container.querySelector(".aspect-\\[16\\/9\\]")).toBeNull();
    expect(screen.getByRole("button", { name: /connect/i }).className).toContain("cta-solid");
    expect(screen.getByRole("button", { name: /pass on/i }).className).not.toContain("rounded-[10px]");
    expect(screen.getByRole("button", { name: /lighting/i }).className).not.toContain("text-[10px]");
  });
});
