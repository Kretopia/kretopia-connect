import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const reads: string[] = [];
const profileRow = { user_id: "u1", full_name: "Dee Marshall", role: "Cinematographer", bio: "I light films.", avatar_url: null, username: "dee" };

vi.mock("@/integrations/supabase/client", () => {
  const make = (table: string) => {
    reads.push(table);
    const result = () => ({ data: table === "public_profiles_safe" ? profileRow : null, error: null, count: 0 });
    const chain: unknown = new Proxy(() => undefined, {
      get: (_t, prop) => {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ ...result(), data: table === "public_profiles_safe" ? profileRow : [] });
        if (prop === "maybeSingle" || prop === "single") return async () => result();
        return () => chain;
      },
      apply: () => chain,
    });
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => make(table),
      rpc: () => make("rpc"),
      channel: () => make("channel"),
      removeChannel: () => undefined,
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) },
      functions: { invoke: async () => ({ data: null, error: null }) },
    },
  };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => <div data-testid="seo" /> }));

import { PublicPassportView } from "../PublicPassportView";

const renderView = (embedded: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PublicPassportView userId="u1" embedded={embedded} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("PublicPassportView: one Passport for visitors and for its owner", () => {
  beforeEach(() => {
    reads.length = 0;
  });

  it("draws the same document embedded in the owner's page, minus the page-level extras", async () => {
    const page = renderView(false);
    expect((await screen.findAllByText("Dee Marshall")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("seo")).toBeInTheDocument();
    expect(screen.getByText(/Operating System for Creative Careers/i)).toBeInTheDocument();
    page.unmount();

    renderView(true);
    expect((await screen.findAllByText("Dee Marshall")).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("seo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Operating System for Creative Careers/i)).not.toBeInTheDocument();
  });

  it("reads the profile only through the public-safe view, never the private profiles table", async () => {
    renderView(true);
    await screen.findAllByText("Dee Marshall");
    await waitFor(() => expect(reads).toContain("public_profiles_safe"));
    expect(reads).not.toContain("profiles");
  });
});
