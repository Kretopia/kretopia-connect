import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PassportCollaborationCta } from "../PassportCollaborationCta";

afterEach(cleanup);
describe("Passport collaboration entry", () => {
  it("opens connection request instead of project actions before connection acceptance", () => {
    const connect = vi.fn();
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} onConnect={connect} />);
    fireEvent.click(screen.getByRole("button", { name: /Connect with Nova/ }));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Start a Project" })).toBeNull();
  });
  it("cannot send another request while recipient acceptance is pending", () => {
    const connect = vi.fn();
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} connectionStatus="pending" onConnect={connect} />);
    fireEvent.click(screen.getByRole("button", { name: /Request pending/ }));
    expect(connect).not.toHaveBeenCalled();
  });
  it("routes accepted connections through the proposal and invitation workflows", () => {
    const propose = vi.fn(); const invite = vi.fn();
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} connectionStatus="connected" onPropose={propose} onInvite={invite} />);
    fireEvent.click(screen.getByRole("button", { name: "Start a Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite to Project" }));
    expect(propose).toHaveBeenCalledTimes(1); expect(invite).toHaveBeenCalledTimes(1);
  });
});