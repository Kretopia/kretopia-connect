import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PassportCollaborationActions, PassportCollaborationCta } from "../PassportCollaborationCta";

afterEach(cleanup);

const handlers = () => ({
  onConnect: vi.fn(),
  onSignIn: vi.fn(),
  onMessage: vi.fn(),
  onPropose: vi.fn(),
  onInvite: vi.fn(),
  onClaimCredits: vi.fn(),
});
type Props = ComponentProps<typeof PassportCollaborationCta>;
/** The two halves of the entry are drawn in different places on the Passport (At a glance, and under the header) but are one set of rules. */
const both = (props: Props) =>
  render(
    <>
      <PassportCollaborationActions {...props} />
      <PassportCollaborationCta {...props} />
    </>,
  );
const group = () => within(screen.getByRole("group", { name: "Work with Nova" }));

describe("Passport collaboration entry", () => {
  it("draws Message, Start a project and Claim Credits as three matching buttons", () => {
    both({ firstName: "Nova", isOwner: false, isSignedIn: true, connectionStatus: "connected", ...handlers() });
    const buttons = group().getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Message", "Start a project", "Claim Credits"]);
    // same shape: one class list for the three
    expect(new Set(buttons.map((b) => b.className)).size).toBe(1);
  });

  it("opens a connection request instead of project actions before the connection is accepted", () => {
    const h = handlers();
    both({ firstName: "Nova", isOwner: false, isSignedIn: true, ...h });
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
    both({ firstName: "Nova", isOwner: false, isSignedIn: true, connectionStatus: "pending", ...h });
    fireEvent.click(screen.getByRole("button", { name: /Request pending/ }));
    expect(h.onConnect).not.toHaveBeenCalled();
    expect(screen.getByText(/open once Nova accepts your request/)).toBeInTheDocument();
  });

  it("does not need a connection to claim a credit", () => {
    const h = handlers();
    both({ firstName: "Nova", isOwner: false, isSignedIn: true, ...h });
    fireEvent.click(group().getByRole("button", { name: "Claim Credits" }));
    expect(h.onClaimCredits).toHaveBeenCalledTimes(1);
    expect(h.onSignIn).not.toHaveBeenCalled();
  });

  it("routes an accepted connection through the message, proposal, invitation and claim workflows", () => {
    const h = handlers();
    both({ firstName: "Nova", isOwner: false, isSignedIn: true, connectionStatus: "connected", ...h });
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
    both({ firstName: "Nova", isOwner: false, isSignedIn: false, ...h });
    for (const name of ["Message", "Start a project", "Claim Credits"]) fireEvent.click(group().getByRole("button", { name }));
    expect(h.onSignIn).toHaveBeenCalledTimes(3);
    expect(h.onMessage).not.toHaveBeenCalled();
    expect(h.onPropose).not.toHaveBeenCalled();
    expect(h.onClaimCredits).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to message, start a project or claim a credit.")).toBeInTheDocument();
  });

  it("draws nothing for the owner: no message to oneself, no project with oneself, no claim on one's own record", () => {
    const { container } = both({ firstName: "Nova", isOwner: true, isSignedIn: true, connectionStatus: "connected", ...handlers() });
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the two halves of the entry", () => {
  const base: Props = { firstName: "Nova", isOwner: false, isSignedIn: true, ...handlers() };

  it("the actions are only the three buttons and what makes them wait: no connect button, no heading, no invitation", () => {
    render(<PassportCollaborationActions {...base} />);
    expect(group().getAllByRole("button").map((b) => b.textContent)).toEqual(["Message", "Start a project", "Claim Credits"]);
    expect(screen.queryByRole("button", { name: /Connect with Nova/ })).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("button", { name: "Invite to an existing project" })).toBeNull();
  });

  it("the rest of the entry has the invitation and the connection request but not the three actions", () => {
    render(<PassportCollaborationCta {...base} />);
    expect(screen.getByRole("region", { name: "Collaborate on Kretopia" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Create something great with Nova/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect with Nova/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Work with Nova" })).toBeNull();
    for (const name of ["Message", "Start a project", "Claim Credits"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.getByText(/subject to confirmation by the person or company concerned/)).toBeInTheDocument();
  });

  it("describes the waiting buttons by their reason, so a screen reader hears why they are disabled", () => {
    render(<PassportCollaborationActions {...base} />);
    const hint = screen.getByText(/open once you are connected with Nova/);
    expect(screen.getByRole("group", { name: "Work with Nova" })).toHaveAttribute("aria-describedby", hint.id);
  });
});
