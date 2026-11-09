import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventHostCard } from "../EventHostCard";

const host = {
  full_name: "Maya Santos",
  username: "maya",
  id_verified: true,
  hostedCount: 4,
  avg_response_hours: 2,
};

describe("EventHostCard", () => {
  it("routes contact through the host Passport only for signed-in viewers", () => {
    const onOpenPassport = vi.fn();
    const onSignIn = vi.fn();

    const { rerender } = render(
      <EventHostCard host={host} isAuthenticated={false} onOpenPassport={onOpenPassport} onSignIn={onSignIn} />,
    );
    expect(screen.queryByRole("button", { name: "Contact host" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to contact" }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText(/4 events hosted · Usually within 2 hours/)).toBeInTheDocument();

    rerender(
      <EventHostCard host={host} isAuthenticated onOpenPassport={onOpenPassport} onSignIn={onSignIn} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Contact host" }));
    expect(onOpenPassport).toHaveBeenCalledWith("maya");
  });
});
