import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const me = { id: "u1" }; // one stable object: the pages reload whenever the user object changes
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: me }) }));
vi.mock("@/hooks/useFirstTimeUser", () => ({ useFirstTimeUser: () => ({ isFirstTime: false, loading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: [], error: null }) : () => chain),
    apply: () => chain,
  });
  return { supabase: { from: () => chain, rpc: () => chain, channel: () => chain, removeChannel: () => undefined } };
});

import PerksTab from "../PerksTab";
import Shortlists from "../Shortlists";

const wrap = (node: JSX.Element) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);

describe("feature pages share the one page header", () => {
  it("Perks: title, subtitle and the help trigger come from the shared header", async () => {
    const { container } = render(wrap(<PerksTab />));
    expect(container.querySelector(".feature-reference-header")).not.toBeNull();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Perks.");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Earned, not bought.");
    expect(screen.getByText(/What each ThriveStatus tier unlocks/)).toBeInTheDocument();
    // Help: the tour is replayable from the header, and it is still the Perks tour.
    expect(screen.getByRole("button", { name: /How this works/i })).toBeInTheDocument();
  });

  it("Shortlists: the shared header names the page and creating a list stays one tap away", async () => {
    const { container } = render(wrap(<Shortlists />));
    expect(container.querySelector(".feature-reference-header")).not.toBeNull();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("My Shortlists");
    const header = container.querySelector(".feature-reference-header") as HTMLElement;
    expect(within(header).getByText("Private lists of creators you want to hire")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New/ }));
    expect(await screen.findByText("Create shortlist")).toBeInTheDocument();
  });
});

describe("pages converted to the shared header no longer draw one by hand", () => {
  const read = (file: string) => readFileSync(join(process.cwd(), "src/pages", file), "utf8");

  it.each([
    ["PerksTab.tsx", "Perks"],
    ["TalentManager.tsx", "Talent Manager"],
    ["OpportunityDashboard.tsx", "Applicants"],
    ["Shortlists.tsx", "My Shortlists"],
  ])("%s uses FeaturePageHeader and StudioFeatureShell", (file, title) => {
    const source = read(file);
    expect(source).toContain("<FeaturePageHeader");
    expect(source).toContain("<StudioFeatureShell");
    expect(source).toContain(title);
    // The old hand-rolled title style is gone.
    expect(source).not.toMatch(/text-3xl sm:text-4xl font-black tracking-\[-0\.03em\] leading-\[1\.05\]/);
    expect(source).not.toMatch(/via-primary\/30 to-transparent/);
  });

  it("only Shortlists keeps an <h1>: the open list's own name, which is content and not a page header", () => {
    for (const file of ["PerksTab.tsx", "TalentManager.tsx", "OpportunityDashboard.tsx"]) expect(read(file), file).not.toContain("<h1");
    expect(read("Shortlists.tsx").match(/<h1/g)).toHaveLength(1);
  });
});
