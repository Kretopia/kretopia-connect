import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MyCredit } from "@/hooks/useMyCredits";

const db = vi.hoisted(() => ({ updates: [] as Array<{ id: string; values: Record<string, unknown> }> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (values: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => {
          db.updates.push({ id, values });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));
vi.mock("@/lib/thumbnailExtractor", () => ({
  resolveCreditThumbnail: () => null,
  extractThumbnailForStorage: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AttachEvidenceDialog } from "../AttachEvidenceDialog";

const credit = (over: Partial<MyCredit> & { id: string; project_name: string }): MyCredit => ({
  role: "Editor",
  year: 2025,
  verification_status: "unverified",
  credit_category: null,
  project_type: null,
  platform: null,
  client_brand: null,
  location: null,
  thumbnail_url: null,
  primary_media_url: null,
  url: null,
  endorsement_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

const credits = [
  credit({ id: "c1", project_name: "Urban Light" }),
  credit({ id: "c2", project_name: "Nova Teaser" }),
  credit({ id: "c3", project_name: "Social Pack" }),
];

describe("AttachEvidenceDialog", () => {
  beforeEach(() => {
    db.updates.length = 0;
  });

  it("attaches one link to several credits in a single confirm", async () => {
    render(
      <AttachEvidenceDialog open onOpenChange={() => {}} credits={credits} onAttached={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText("Evidence link for Urban Light"), {
      target: { value: "https://example.com/urban" },
    });
    fireEvent.change(screen.getByLabelText("Evidence link for Nova Teaser"), {
      target: { value: "example.com/nova" },
    });
    fireEvent.click(screen.getByRole("button", { name: /attach evidence to 2 credits/i }));
    await waitFor(() => expect(db.updates).toHaveLength(2));
    expect(db.updates.find((u) => u.id === "c1")?.values.url).toBe("https://example.com/urban");
    // protocol is added when missing
    expect(db.updates.find((u) => u.id === "c2")?.values.url).toBe("https://example.com/nova");
  });

  it("focuses a single credit when opened from its row", () => {
    render(
      <AttachEvidenceDialog open onOpenChange={() => {}} credits={credits} focusCreditId="c2" onAttached={() => {}} />,
    );
    expect(screen.getByLabelText("Evidence link for Nova Teaser")).toBeInTheDocument();
    expect(screen.queryByLabelText("Evidence link for Urban Light")).not.toBeInTheDocument();
  });

  it("refuses to save without a valid link", () => {
    render(
      <AttachEvidenceDialog open onOpenChange={() => {}} credits={credits} onAttached={() => {}} />,
    );
    const button = screen.getByRole("button", { name: /attach evidence/i });
    expect(button).toBeDisabled();
    expect(db.updates).toHaveLength(0);
  });
});
