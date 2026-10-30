import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const callbacks = vi.hoisted(() => ({ invite: vi.fn(), scene: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/useNetworkStats", () => ({ useNetworkStats: () => ({ stats: { degree1: 2, degree2: 150, degree3: 0, totalReach: 152 }, loading: false, error: null }) }));
vi.mock("@/hooks/useReferralNetwork", () => ({ useReferralNetwork: () => ({ referralCount: 0, tier: { label: "Member", tagline: "" } }) }));
vi.mock("../KretoNetworkScene", () => ({ KretoNetworkScene: (props: unknown) => { callbacks.scene(props); return <div />; } }));
vi.mock("../NetworkHealthScore", () => ({ NetworkHealthScore: () => null }));
vi.mock("../PathFinder", () => ({ PathFinder: () => <input aria-label="Path search" /> }));
vi.mock("../DegreeExplorerDrawer", () => ({ DegreeExplorerDrawer: ({ open, initialDegree }: { open: boolean; initialDegree: number }) => open ? <p>Degree {initialDegree}</p> : null }));
import { NetworkVisualization } from "../NetworkVisualization";

describe("Connected workspace", () => {
  it("passes actual accepted profiles to the scene and opens the requested real degree", async () => {
    const connections = [{ user_id: "a", full_name: "Ana", avatar_url: null, role: "Editor" }];
    render(<MemoryRouter><NetworkVisualization connections={connections} onInvite={callbacks.invite} /></MemoryRouter>);
    await waitFor(() => expect(callbacks.scene).toHaveBeenCalled());
    expect(callbacks.scene.mock.calls.at(-1)?.[0].connections).toEqual(connections);
    fireEvent.click(screen.getByRole("button", { name: "View 2nd degree connections" }));
    expect(screen.getByText("Degree 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View 3rd degree connections" })).toBeDisabled();
  });
  it("keeps optional path and circle tools progressive and invite explicit", () => {
    callbacks.invite.mockClear();
    render(<MemoryRouter><NetworkVisualization onInvite={callbacks.invite} /></MemoryRouter>);
    expect(screen.queryByLabelText("Path search")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Find Connection Path" }));
    expect(screen.getByLabelText("Path search")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Creative Circle" }));
    expect(screen.queryByLabelText("Path search")).toBeNull();
    expect(callbacks.invite).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: /^Invite$/ })[0]);
    expect(callbacks.invite).toHaveBeenCalledTimes(1);
  });
});