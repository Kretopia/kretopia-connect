import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventHostBlock } from "../EventHostBlock";

const host = { full_name: "Maya Santos", id_verified: true, hostedCount: 4 };

const draw = (props: Partial<Parameters<typeof EventHostBlock>[0]> = {}) => {
  const onContact = vi.fn();
  const onSignIn = vi.fn();
  render(<EventHostBlock host={host} isHost={false} isAuthenticated onContact={onContact} onSignIn={onSignIn} {...props} />);
  return { onContact, onSignIn };
};

describe("EventHostBlock: who hosts, once", () => {
  it("shows the host's identity, verified state and track record under the #host anchor", () => {
    draw();
    const block = document.getElementById("host")!;
    expect(block).toHaveTextContent("Hosted by");
    expect(block).toHaveTextContent("Maya Santos");
    expect(block).toHaveTextContent("4 events hosted");
    expect(screen.getByLabelText("Verified host")).toBeInTheDocument();
  });

  it("does not claim a verification the host does not have", () => {
    draw({ host: { ...host, id_verified: false } });
    expect(screen.queryByLabelText("Verified host")).not.toBeInTheDocument();
  });

  it("sends a visitor to sign in before Contact host does anything", () => {
    const { onContact, onSignIn } = draw({ isAuthenticated: false });
    fireEvent.click(screen.getByRole("button", { name: "Contact host" }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(onContact).not.toHaveBeenCalled();
  });

  it("lets a signed-in member contact the host through their public Passport when no other channel is shared", () => {
    const { onContact, onSignIn } = draw();
    fireEvent.click(screen.getByRole("button", { name: "Contact host" }));
    expect(onContact).toHaveBeenCalledOnce();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("offers the host's own public channels in the same menu, http(s) only, never a phone or an email", async () => {
    const { onContact } = draw({ host: { ...host, instagram_url: "@mayasantos", website_url: "javascript:alert(1)" } });
    fireEvent.keyDown(screen.getByRole("button", { name: "Contact host" }), { key: "Enter" });

    expect(await screen.findByRole("menuitem", { name: "Open host Instagram" })).toHaveAttribute("href", "https://instagram.com/mayasantos");
    expect(screen.queryByRole("menuitem", { name: /website/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /email|phone/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Message on Kretopia" }));
    expect(onContact).toHaveBeenCalledOnce();
  });

  it("shows the host no contact control: there is nobody to contact, and the booking control already says they host", () => {
    draw({ isHost: true });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.getElementById("host")).not.toHaveTextContent(/hosting/i);
  });
});
