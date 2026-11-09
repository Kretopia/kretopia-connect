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
  it("gates the Kretopia contact action but leaves host-published channels available", () => {
    const onContactViaKretopia = vi.fn();
    const onSignIn = vi.fn();

    const { rerender } = render(
      <EventHostCard host={host} isAuthenticated={false} onContactViaKretopia={onContactViaKretopia} onSignIn={onSignIn} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Contact via Kretopia" }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText(/4 events hosted · Usually within 2 hours/)).toBeInTheDocument();

    rerender(
      <EventHostCard host={host} isAuthenticated onContactViaKretopia={onContactViaKretopia} onSignIn={onSignIn} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Contact via Kretopia" }));
    expect(onContactViaKretopia).toHaveBeenCalledWith("maya");
  });

  it("exposes only supplied public channels without inventing phone or email access", () => {
    render(
      <EventHostCard
        host={{ ...host, instagram_url: "@mayasantos", website_url: "javascript:alert(1)" }}
        isAuthenticated={false}
        onContactViaKretopia={vi.fn()}
        onSignIn={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Open host Instagram" })).toHaveAttribute("href", "https://instagram.com/mayasantos");
    expect(screen.queryByRole("link", { name: /email|phone/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contact via Kretopia" })).not.toBeInTheDocument();
  });

  it("shows Kretopia contact as the only option when no public channel exists", () => {
    render(
      <EventHostCard
        host={host}
        isAuthenticated
        onContactViaKretopia={vi.fn()}
        onSignIn={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Contact via Kretopia" })).toBeInTheDocument();
  });
});
