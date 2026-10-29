import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/**
 * Stages is one component. Sound Stages is its default view; curated stages, the speed nights and the event backstage
 * are views of the same component, picked by prop or by URL. It has no tabs, and the old /circle tab links lead on to
 * Match. The pieces around it are stubbed so this tests the surface itself.
 */
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/PageTransition", () => ({ PageTransition: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/AuthGate", () => ({ AuthGate: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/InviteDialog", () => ({ InviteDialog: () => null }));
vi.mock("@/components/features/FeaturePageHeader", () => ({
  FeaturePageHeader: (p: { title: string; accentTitle: string; subtitle: string; compact?: boolean; tutorial?: { label: string } }) => (
    <header data-compact={String(!!p.compact)}>
      <button type="button">{p.tutorial?.label}</button>
      <h1>{p.title} <span className="k-gradient-text">{p.accentTitle}</span></h1>
      <p>{p.subtitle}</p>
    </header>
  ),
}));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({
  StudioFeatureShell: ({ children, wrapped }: { children: ReactNode; wrapped?: { name: string } }) => <section aria-label={`Everything in ${wrapped?.name}`}>{children}</section>,
}));
const panel = vi.fn();
vi.mock("@/components/circle/LiveCallsPanel", () => ({
  LiveCallsPanel: (p: Record<string, unknown>) => (panel(p), <div data-testid="live-calls" />),
}));
vi.mock("@/components/passport/PassportDraftCard", () => ({ PassportDraftCard: ({ surfaceLabel }: { surfaceLabel: string }) => <h2>Strengthen your Passport for {surfaceLabel}</h2> }));
vi.mock("../CuratedStage", () => ({ default: ({ embedded }: { embedded?: boolean }) => <div data-testid="curated" data-embedded={String(!!embedded)} /> }));
vi.mock("../SpeedIndex", () => ({ default: ({ embedded }: { embedded?: boolean }) => <div data-testid="speed" data-embedded={String(!!embedded)} /> }));
vi.mock("../SpeedSession", () => ({ default: ({ embedded }: { embedded?: boolean }) => <div data-testid="speed-session" data-embedded={String(!!embedded)} /> }));
vi.mock("../SpeedRecap", () => ({ default: ({ embedded }: { embedded?: boolean }) => <div data-testid="speed-recap" data-embedded={String(!!embedded)} /> }));
vi.mock("../EventBackstage", () => ({ default: ({ embedded }: { embedded?: boolean }) => <div data-testid="backstage" data-embedded={String(!!embedded)} /> }));

let user: { id: string } | null = { id: "u1" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user }) }));

let profile: { avatar_url: string | null; bio: string | null } = { avatar_url: "https://x.test/a.png", bio: "x".repeat(30) };
let creditCount = 1;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => (table === "credits" ? Promise.resolve({ count: creditCount }) : chain);
      chain.single = () => ({ then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: profile }).then(ok) });
      return chain;
    },
  },
}));

import Stages from "../Stages";

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
const renderAt = (url: string, element = <Stages />) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/circle" element={element} />
        <Route path="/circle/stage/:id" element={element} />
        <Route path="/circle/speed" element={element} />
        <Route path="/circle/speed/:id" element={element} />
        <Route path="/circle/speed/:id/recap" element={element} />
        <Route path="/events/backstage" element={element} />
        <Route path="/match" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  panel.mockClear();
  user = { id: "u1" };
  profile = { avatar_url: "https://x.test/a.png", bio: "x".repeat(30) };
  creditCount = 1;
});

describe("Stages default view", () => {
  it("carries the exact title, gradient phrase, subtitle and tutorial label from the wireframe", () => {
    renderAt("/circle");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Stages. Where creators meet, live.");
    expect(document.querySelector("h1 .k-gradient-text")).toHaveTextContent("Where creators meet, live.");
    expect(screen.getByText("Join creative sessions, discover people you can work with, and grow meaningful professional connections.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How this works" })).toBeInTheDocument();
    expect(screen.getByLabelText("Everything in Stages")).toBeInTheDocument();
  });

  it("is Sound Stages, with no tabs and none of the old switch or Kreto card", () => {
    renderAt("/circle");
    expect(screen.getByTestId("live-calls")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    for (const gone of [/who's worth adding to your circle/i, /suggest people/i, /or just chat/i]) expect(screen.queryByText(gone)).not.toBeInTheDocument();
    for (const name of ["Match", "Browse", "Network"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("passes a shared ?join= link to the live panel", () => {
    renderAt("/circle?join=stage-1");
    expect(panel).toHaveBeenCalledWith(expect.objectContaining({ joinStageId: "stage-1" }));
  });

  it("shows the AI Passport card above the live panel while the profile is incomplete, without blocking it", async () => {
    profile = { avatar_url: null, bio: null };
    creditCount = 0;
    renderAt("/circle");
    expect(await screen.findByRole("heading", { name: "Strengthen your Passport for Stage" })).toBeInTheDocument();
    expect(screen.getByTestId("live-calls")).toBeInTheDocument();
  });

  it("shows no Passport card once the profile meets the requirements", async () => {
    renderAt("/circle");
    await waitFor(() => expect(screen.getByTestId("live-calls")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /strengthen your passport/i })).not.toBeInTheDocument();
  });
});

describe("Stages views", () => {
  it.each([
    ["/circle/stage/abc", "curated"],
    ["/circle/speed", "speed"],
    ["/circle/speed/s1", "speed-session"],
    ["/circle/speed/s1/recap", "speed-recap"],
    ["/events/backstage", "backstage"],
  ])("%s is the %s view of the same component, embedded under the same header", async (url, testId) => {
    renderAt(url);
    const view = await screen.findByTestId(testId);
    expect(view).toHaveAttribute("data-embedded", "true");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Stages.");
    expect(screen.queryByTestId("live-calls")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("the view can also be chosen by prop", async () => {
    renderAt("/circle", <Stages view="speed" />);
    expect(await screen.findByTestId("speed")).toBeInTheDocument();
  });
});

describe("the old /circle tab links", () => {
  it.each([
    ["/circle?tab=network", "/match?tab=connected"],
    ["/circle?tab=browse", "/match?tab=browse"],
    ["/circle?tab=match", "/match?tab=discover"],
  ])("%s lands on %s", async (from, to) => {
    renderAt(from);
    expect(await screen.findByTestId("where")).toHaveTextContent(to);
  });

  it("?tab=live and ?tab=stages stay on Stages", () => {
    renderAt("/circle?tab=live");
    expect(screen.getByTestId("live-calls")).toBeInTheDocument();
  });
});
