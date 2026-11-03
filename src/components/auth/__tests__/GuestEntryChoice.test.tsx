import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { GuestEntryChoice } from "../GuestEntryChoice";

const renderChoice = (props: Partial<React.ComponentProps<typeof GuestEntryChoice>> = {}) => {
  const onContinueAsGuest = vi.fn();
  // No AuthProvider anywhere: the public choice screen must render without a session.
  render(
    <MemoryRouter>
      <GuestEntryChoice
        title="You're invited to a live call"
        signInTo="/meet/abc?t=xyz"
        signInHint="Join with your Kretopia account."
        guestHint="Join with just your name."
        onContinueAsGuest={onContinueAsGuest}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onContinueAsGuest };
};

describe("GuestEntryChoice", () => {
  it("renders with no session at all, and shows the two options before anything else", () => {
    renderChoice();
    expect(screen.getByRole("heading", { level: 1, name: "You're invited to a live call" })).toBeInTheDocument();
    expect(screen.getByRole("group")).toBeInTheDocument();
    expect(screen.getByTestId("entry-sign-in")).toHaveTextContent("Sign in");
    expect(screen.getByTestId("entry-guest")).toHaveTextContent("Continue as guest");
  });

  it("gives the two options exactly the same size, weight and type", () => {
    renderChoice();
    const signIn = screen.getByTestId("entry-sign-in");
    const guest = screen.getByTestId("entry-guest");
    expect(signIn.className).toBe(guest.className);
    // the labels and hints are styled alike too
    const labels = [signIn, guest].map((el) => el.querySelectorAll("span > span")[0]?.className);
    expect(labels[0]).toBe(labels[1]);
    const hints = [signIn, guest].map((el) => el.querySelectorAll("span > span")[1]?.className);
    expect(hints[0]).toBe(hints[1]);
  });

  it("pre-selects and focuses neither option, and carries no warning or countdown", () => {
    renderChoice();
    expect(document.activeElement).toBe(document.body);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("guest-entry-choice").querySelector("[autofocus]")).toBeNull();
    expect(screen.getByTestId("entry-guest")).not.toBeDisabled();
  });

  it("sends 'Sign in' to the sign-in page and brings the person back to the same link", () => {
    renderChoice();
    expect(screen.getByTestId("entry-sign-in")).toHaveAttribute("href", "/auth?redirect=%2Fmeet%2Fabc%3Ft%3Dxyz");
  });

  it("can send 'Sign in' somewhere else in the app, but never off the app", () => {
    renderChoice({ signInUrl: "/auth" });
    expect(screen.getByTestId("entry-sign-in")).toHaveAttribute("href", "/auth");
  });

  it("ignores a sign-in destination that is not an in-app address", () => {
    renderChoice({ signInUrl: "//evil.example/auth" });
    expect(screen.getByTestId("entry-sign-in")).toHaveAttribute("href", "/auth?redirect=%2Fmeet%2Fabc%3Ft%3Dxyz");
  });

  it("continues as a guest with one press, no confirmation step", () => {
    const { onContinueAsGuest } = renderChoice();
    fireEvent.click(screen.getByTestId("entry-guest"));
    expect(onContinueAsGuest).toHaveBeenCalledTimes(1);
  });

  it("shows what is being joined when it is known", () => {
    renderChoice({ context: "Friday casting call" });
    expect(screen.getByText("Friday casting call")).toBeInTheDocument();
  });

  it("is operable by keyboard: both options are in the tab order", () => {
    renderChoice();
    for (const id of ["entry-sign-in", "entry-guest"]) {
      const el = screen.getByTestId(id);
      el.focus();
      expect(document.activeElement).toBe(el);
      expect(el.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("says plainly that the choice lasts for this tab only", () => {
    renderChoice();
    expect(screen.getByText("Your choice is kept for this tab only.")).toBeInTheDocument();
  });
});
