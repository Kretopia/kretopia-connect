import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  credits: [] as Record<string, unknown>[],
  scrollTo: vi.fn(),
  api: null as null | { scrollTo: (...a: unknown[]) => void },
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  for (const m of ["select", "eq", "order"]) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: world.credits, error: null });
  return { supabase: { from: () => chain, auth: { getUser: () => Promise.resolve({ data: { user: null } }) }, functions: { invoke: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
vi.mock("@/lib/thumbnailExtractor", () => ({ extractThumbnailForStorage: () => null }));
vi.mock("../MediaPlayerModal", () => ({ MediaPlayerModal: () => null }));
vi.mock("../CreditEndorsementDialog", () => ({ CreditEndorsementDialog: () => null }));
vi.mock("@/components/ui/glass/CarouselPositionDots", () => ({ CarouselPositionDots: () => null }));
vi.mock("../AchievementCard", () => ({ AchievementCard: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock("@/components/ui/carousel", async () => {
  const React = await import("react");
  return {
    Carousel: ({ children, setApi }: { children: React.ReactNode; setApi?: (api: unknown) => void }) => {
      React.useEffect(() => {
        world.api = { scrollTo: world.scrollTo };
        setApi?.(world.api);
      }, [setApi]);
      return <div>{children}</div>;
    },
    CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CarouselItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CarouselPrevious: () => null,
    CarouselNext: () => null,
  };
});

import { CreditsSection } from "../CreditsSection";

const credit = (id: string, project_name: string) => ({ id, project_name, role: "Editor", year: 2025, verification_status: "unverified" });

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <CreditsSection userId="u1" isOwnProfile onRefresh={() => {}} />
    </MemoryRouter>,
  );

beforeEach(() => {
  world.credits = [credit("c1", "First"), credit("c2", "Second"), credit("c3", "Third")];
  world.scrollTo.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.useRealTimers());

describe("Passport stamps: arriving from a credit in Credits", () => {
  it("gives every stamp an anchor of its own", async () => {
    renderAt("/profile");
    await screen.findByText("Second");
    for (const id of ["c1", "c2", "c3"]) expect(document.getElementById(`credit-${id}`)).not.toBeNull();
  });

  it("brings the named credit into view and marks it, and no other", async () => {
    renderAt("/profile?credit=c2");
    await screen.findByText("Second");
    await waitFor(() => expect(world.scrollTo).toHaveBeenCalledWith(1, false));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    await waitFor(() => expect(document.getElementById("credit-c2")!.className).toContain("ring-2"));
    expect(document.getElementById("credit-c1")!.className).not.toContain("ring-2");
    expect(document.getElementById("credit-c3")!.className).not.toContain("ring-2");
  });

  it("stops marking it after a moment", async () => {
    renderAt("/profile?credit=c3");
    await screen.findByText("Third");
    await waitFor(() => expect(document.getElementById("credit-c3")!.className).toContain("ring-2"));
    await waitFor(() => expect(document.getElementById("credit-c3")!.className).not.toContain("ring-2"), { timeout: 4000 });
  }, 8000);

  it("does nothing for a credit that is not in the list, or without a ?credit", async () => {
    const { unmount } = renderAt("/profile?credit=missing");
    await screen.findByText("First");
    await act(async () => {});
    expect(world.scrollTo).not.toHaveBeenCalled();
    unmount();

    renderAt("/profile");
    await screen.findByText("First");
    await act(async () => {});
    expect(world.scrollTo).not.toHaveBeenCalled();
  });
});
