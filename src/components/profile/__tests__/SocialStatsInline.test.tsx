import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialStatsInline } from "../SocialStatsInline";

const query = vi.fn();
const channel = { on: vi.fn(), subscribe: vi.fn() };
channel.on.mockReturnValue(channel);
channel.subscribe.mockReturnValue(channel);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: query }) }),
    channel: () => channel,
    removeChannel: vi.fn(),
  },
}));

describe("Passport Reach", () => {
  beforeEach(() => { query.mockReset(); });

  it("shows the connected creator's synced audience, including zero, not profile counters", async () => {
    query.mockResolvedValue({ data: [
      { platform: "youtube", platform_data: { subscribers: 1240 }, last_synced_at: "2026-09-28T00:00:00Z" },
      { platform: "instagram", platform_data: { followers: 0 }, last_synced_at: null },
    ], error: null });
    render(<SocialStatsInline userId="creator-a" />);
    expect(query).toHaveBeenCalledWith("user_id", "creator-a");
    expect(await screen.findByText("1.2K")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
  });

  it("never invents reach when there is no synced account", async () => {
    query.mockResolvedValue({ data: [], error: null });
    render(<SocialStatsInline userId="creator-b" />);
    await waitFor(() => expect(screen.getByText("No synced audience metrics yet.")).toBeInTheDocument());
  });
});