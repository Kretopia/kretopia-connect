import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: db.requests, error: null }) }) }) }) },
}));
vi.mock("@/components/passport/HoloCard", () => ({ HoloCard: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({ children }: any) => <div>{children}</div>,
  CarouselContent: ({ children }: any) => <div>{children}</div>,
  CarouselItem: ({ children }: any) => <div>{children}</div>,
  CarouselPrevious: () => null,
  CarouselNext: () => null,
}));
vi.mock("@/components/ui/glass/CarouselPositionDots", () => ({ CarouselPositionDots: () => null }));
vi.mock("../CreditEndorsementDialog", () => ({
  CreditEndorsementDialog: ({ credit, reminder }: any) => <div role="dialog">{reminder ? `reminder for ${credit.project_name}` : `ask for ${credit.project_name}`}</div>,
}));

import { CoSignsSection } from "../CoSignsSection";

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const credit = (id: string, project_name: string, over: Record<string, unknown> = {}) => ({ id, project_name, role: "Editor", year: 2025, verification_status: "unverified", endorsement_count: 0, ...over });

const renderSection = (credits: any[]) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CoSignsSection credits={credits} userId="me" />
    </QueryClientProvider>,
  );
const card = (name: string) => screen.getByText(name).closest("div.rounded-2xl") as HTMLElement;

describe("Co-signs: each credit says where its confirmation stands", () => {
  const credits = [
    credit("n", "Bare claim", { ai_confidence: 0.9 }),
    credit("w", "Waiting doc"),
    credit("a", "Answered clip", { endorsement_count: 1 }),
    credit("d", "Declined reel"),
    credit("v", "Verified film", { verification_status: "verified", source: "youtube" }),
  ];

  it("shows pending, accepted and declined requests with the signer and date, and keeps declined distinct", async () => {
    db.requests = [
      { credit_id: "w", token: "t1", endorser_name: "Ada", status: "pending", requested_at: ago(2), responded_at: null },
      { credit_id: "a", token: "t2", endorser_name: "Grace", status: "accepted", requested_at: ago(9), responded_at: ago(8) },
      { credit_id: "d", token: "t3", endorser_name: "Linus", status: "declined", requested_at: ago(9), responded_at: ago(7) },
    ];
    renderSection(credits);
    expect(await screen.findByText("Request sent to Ada · Pending, asked 2 days ago")).toBeInTheDocument();
    expect(screen.getByText(/^Co-signed by Grace on /)).toBeInTheDocument();
    const declined = screen.getByText(/^Linus declined on /);
    expect(declined.className).toContain("text-destructive");
    expect(within(card("Declined reel")).getByRole("button", { name: "Ask someone else" })).toBeInTheDocument();
    expect(within(card("Waiting doc")).getByRole("button", { name: "Send a reminder" })).toBeInTheDocument();
    expect(within(card("Waiting doc")).queryByRole("button", { name: /Ask/ })).toBeNull();
  });

  it("gives every card its basis, including what the AI check found, without calling it proof", async () => {
    db.requests = [];
    renderSection(credits);
    expect(await screen.findByText("Self-declared · AI-checked: possible public evidence found (not proof)")).toBeInTheDocument();
    expect(screen.getByText("Co-signed by 1 collaborator")).toBeInTheDocument();
    expect(screen.getByText("Verified on YouTube")).toBeInTheDocument();
  });

  it("opens the existing ask flow, and the reminder flow for a request still waiting", async () => {
    db.requests = [{ credit_id: "w", token: "t1", endorser_name: "Ada", status: "pending", requested_at: ago(1), responded_at: null }];
    renderSection(credits);
    fireEvent.click(await screen.findByRole("button", { name: "Send a reminder" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("reminder for Waiting doc");
  });

  it("puts the legend on the page", async () => {
    db.requests = [];
    renderSection(credits);
    expect(await screen.findByText("What do these statuses mean?")).toBeInTheDocument();
  });
});
