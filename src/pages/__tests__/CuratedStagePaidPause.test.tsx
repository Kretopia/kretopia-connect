import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Paid Stage tickets are paused until the backend seats paid buyers (kretopia-app, 2026-11-25): a paid Stage says tickets open
 * soon and never sends anyone to checkout, while a free Stage is unchanged. The flag turns sales back on.
 */
const m = vi.hoisted(() => ({
  stage: null as null | Record<string, unknown>,
  invoke: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "fan", email: "fan@example.com" }, loading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/project/VideoCallSheet", () => ({ VideoCallSheet: () => null }));
vi.mock("@/components/circle/ApplyToStageSheet", () => ({ ApplyToStageSheet: () => null }));
vi.mock("@/components/circle/StageHostConsole", () => ({ StageHostConsole: () => null }));
vi.mock("@/components/circle/InviteToStageDialog", () => ({ InviteToStageDialog: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const c: Record<string, unknown> = {};
    for (const k of ["select", "eq", "in", "order", "limit"]) c[k] = () => c;
    c.maybeSingle = async () => ({ data: table === "curated_stages" ? m.stage : null, error: null });
    c.single = c.maybeSingle;
    return c;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: chain,
      rpc: async () => ({ data: null, error: null }),
      channel: () => channel,
      removeChannel: () => {},
      functions: { invoke: (...a: unknown[]) => m.invoke(...a) },
    },
  };
});

import CuratedStage from "../CuratedStage";

const STAGE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const stage = (over: Record<string, unknown> = {}) => ({
  id: STAGE, host_user_id: "host", type: "showcase", title: "Paid Night", blurb: null, cover_url: null,
  starts_at: new Date(Date.now() + 86_400_000).toISOString(), ends_at: null, capacity: 50, is_paid: true, price_cents: 1500,
  currency: "eur", status: "scheduled", rsvp_count: 0, visibility: "public", application_required: false, ...over,
});
const open = () => render(<MemoryRouter initialEntries={[`/circle/stage/${STAGE}`]}><Routes><Route path="/circle/stage/:id" element={<CuratedStage />} /></Routes></MemoryRouter>);

beforeEach(() => {
  m.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("paid Stage tickets, paused", () => {
  it("a paid Stage says tickets open soon, and nothing starts a checkout", async () => {
    m.stage = stage();
    open();
    const button = await screen.findByRole("button", { name: "Tickets open soon" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Nothing has been charged/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Get ticket/ })).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(m.invoke).not.toHaveBeenCalledWith("checkout-stage-ticket", expect.anything());
  });

  it("a free Stage is unchanged", async () => {
    m.stage = stage({ is_paid: false, price_cents: null });
    open();
    expect(await screen.findByRole("button", { name: "Save my spot" })).toBeEnabled();
    expect(screen.queryByText("Tickets open soon")).not.toBeInTheDocument();
  });

  it("the flag reopens sales", async () => {
    vi.stubEnv("VITE_FEATURE_PAID_STAGE_TICKETS", "true");
    m.stage = stage();
    open();
    fireEvent.click(await screen.findByRole("button", { name: /Get ticket/ }));
    expect(m.invoke).toHaveBeenCalledWith("checkout-stage-ticket", { body: { stage_id: STAGE } });
  });
});
