import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PassportCollaborationCta } from "../PassportCollaborationCta";

afterEach(cleanup);

const handlers = () => ({
  onConnect: vi.fn(),
  onSignIn: vi.fn(),
  onMessage: vi.fn(),
  onPropose: vi.fn(),
  onInvite: vi.fn(),
  onClaimCredits: vi.fn(),
});
const group = () => within(screen.getByRole("group", { name: "Work with Nova" }));

describe("Passport collaboration entry", () => {
  it("draws Message, Start a project and Claim Credits as three matching buttons", () => {
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} isSignedIn connectionStatus="connected" {...handlers()} />);
    const buttons = group().getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Message", "Start a project", "Claim Credits"]);
    // same shape: one class list for the three
    expect(new Set(buttons.map((b) => b.className)).size).toBe(1);
  });

  it("opens a connection request instead of project actions before the connection is accepted", () => {
    const h = handlers();
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} isSignedIn {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /Connect with Nova/ }));
    expect(h.onConnect).toHaveBeenCalledTimes(1);
    // Message and Start a project wait for the connection and say so; they cannot be pressed
    expect(group().getByRole("button", { name: "Message" })).toBeDisabled();
    expect(group().getByRole("button", { name: "Start a project" })).toBeDisabled();
    fireEvent.click(group().getByRole("button", { name: "Message" }));
    fireEvent.click(group().getByRole("button", { name: "Start a project" }));
    expect(h.onMessage).not.toHaveBeenCalled();
    expect(h.onPropose).not.toHaveBeenCalled();
    expect(screen.getByText(/open once you are connected with Nova/)).toBeInTheDocument();
  });

  it("cannot send another request while the recipient's acceptance is pending", () => {
    const h = handlers();
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} isSignedIn connectionStatus="pending" {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /Request pending/ }));
    expect(h.onConnect).not.toHaveBeenCalled();
    expect(screen.getByText(/open once Nova accepts your request/)).toBeInTheDocument();
  });

  it("does not need a connection to claim a credit", () => {
    const h = handlers();
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} isSignedIn {...h} />);
    fireEvent.click(group().getByRole("button", { name: "Claim Credits" }));
    expect(h.onClaimCredits).toHaveBeenCalledTimes(1);
    expect(h.onSignIn).not.toHaveBeenCalled();
  });

  it("routes an accepted connection through the message, proposal, invitation and claim workflows", () => {
    const h = handlers();
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} isSignedIn connectionStatus="connected" {...h} />);
    fireEvent.click(group().getByRole("button", { name: "Message" }));
    fireEvent.click(group().getByRole("button", { name: "Start a project" }));
    fireEvent.click(group().getByRole("button", { name: "Claim Credits" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite to an existing project" }));
    expect(h.onMessage).toHaveBeenCalledTimes(1);
    expect(h.onPropose).toHaveBeenCalledTimes(1);
    expect(h.onClaimCredits).toHaveBeenCalledTimes(1);
    expect(h.onInvite).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Connect with Nova/ })).toBeNull();
  });

  it("sends a signed-out visitor to sign in from any of the three, and runs none of the flows", () => {
    const h = handlers();
    render(<PassportCollaborationCta firstName="Nova" isOwner={false} isSignedIn={false} {...h} />);
    for (const name of ["Message", "Start a project", "Claim Credits"]) fireEvent.click(group().getByRole("button", { name }));
    expect(h.onSignIn).toHaveBeenCalledTimes(3);
    expect(h.onMessage).not.toHaveBeenCalled();
    expect(h.onPropose).not.toHaveBeenCalled();
    expect(h.onClaimCredits).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to message, start a project or claim a credit.")).toBeInTheDocument();
  });

  it("draws nothing for the owner: no message to oneself, no project with oneself, no claim on one's own record", () => {
    const { container } = render(<PassportCollaborationCta firstName="Nova" isOwner isSignedIn connectionStatus="connected" {...handlers()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
