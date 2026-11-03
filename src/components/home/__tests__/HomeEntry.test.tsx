import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomeEntry from "../HomeEntry";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: true,
  isComplete: true,
  dashboardLoads: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user, loading: true }) }));
vi.mock("@/hooks/useOnboarding", () => ({ useOnboarding: () => state }));
vi.mock("@/pages/Welcome", () => ({ default: () => <div>Public home</div> }));
vi.mock("../UnifiedHome", () => {
  state.dashboardLoads();
  return { default: () => <div>Signed-in home</div> };
});

function openHome() {
  return render(<MemoryRouter><Suspense fallback={<div>Waiting</div>}><Routes>
    <Route path="/" element={<HomeEntry />} />
    <Route path="/onboarding" element={<div>Onboarding</div>} />
    <Route path="/event/:id" element={<div>Pending event</div>} />
  </Routes></Suspense></MemoryRouter>);
}

describe("first usable home content", () => {
  beforeEach(() => {
    state.user = null;
    state.loading = true;
    state.isComplete = true;
    sessionStorage.clear();
  });

  it("shows public home during session restoration without importing the signed-in dashboard", async () => {
    openHome();
    expect(await screen.findByText("Public home")).toBeInTheDocument();
    expect(state.dashboardLoads).not.toHaveBeenCalled();
  });

  it("shows signed-in home while the onboarding request is still pending", async () => {
    state.user = { id: "owner" };
    openHome();
    expect(await screen.findByText("Signed-in home")).toBeInTheDocument();
  });

  it("retains the redirect for confirmed incomplete onboarding", async () => {
    state.user = { id: "owner" };
    state.loading = false;
    state.isComplete = false;
    openHome();
    expect(await screen.findByText("Onboarding")).toBeInTheDocument();
  });

  it("retains a pending event until onboarding is known, then opens it", async () => {
    state.user = { id: "owner" };
    sessionStorage.setItem("pending_event_join", "real-event");
    const view = openHome();
    expect(await screen.findByText("Signed-in home")).toBeInTheDocument();
    expect(sessionStorage.getItem("pending_event_join")).toBe("real-event");
    state.loading = false;
    view.rerender(<MemoryRouter><Suspense fallback={null}><Routes>
      <Route path="/" element={<HomeEntry />} />
      <Route path="/event/:id" element={<div>Pending event</div>} />
    </Routes></Suspense></MemoryRouter>);
    expect(await screen.findByText("Pending event")).toBeInTheDocument();
    expect(sessionStorage.getItem("pending_event_join")).toBeNull();
  });
});