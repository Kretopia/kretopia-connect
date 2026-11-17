import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PassportDirectoryCard, type DirectoryPassport } from "../PassportDirectoryCard";

const person: DirectoryPassport = {
  user_id: "12345678-aaaa-bbbb-cccc-000000000000",
  username: "sam.rivera",
  full_name: "Sam Rivera",
  role: "Sound designer",
  avatar_url: null,
  cover_image_url: null,
  location: "Port of Spain",
  verification_tier: "verified",
  level: 4,
};

const setup = (props: Partial<Parameters<typeof PassportDirectoryCard>[0]> = {}) => {
  const onMessage = vi.fn();
  render(
    <MemoryRouter>
      <PassportDirectoryCard passport={person} credits={7} cosigns={1} onMessage={onMessage} {...props} />
    </MemoryRouter>,
  );
  return { onMessage };
};

describe("PassportDirectoryCard", () => {
  it("shows the record and opens the Passport by handle", () => {
    setup();
    expect(screen.getByText("Sam Rivera")).toBeInTheDocument();
    expect(screen.getByText("@sam.rivera")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("credits")).toBeInTheDocument();
    expect(screen.getByText("co-sign")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Passport" })).toHaveAttribute("href", "/@sam.rivera");
  });

  it("messages the person from the card", () => {
    const { onMessage } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Message/ }));
    expect(onMessage).toHaveBeenCalledWith(person);
  });

  it("your own card goes to /profile and has no Message", () => {
    setup({ isMe: true });
    expect(screen.getByRole("link", { name: "Open my Passport" })).toHaveAttribute("href", "/profile");
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Message/ })).not.toBeInTheDocument();
  });
  it("does not message or start a project without an accepted connection", () => {
    const onProject = vi.fn();
    const { onMessage } = setup({ connected: false, onProject });
    expect(screen.getByRole("button", { name: "Message Sam Rivera" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Quick look" }));
    fireEvent.click(screen.getByRole("button", { name: "Start a project" }));
    expect(onProject).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });
  it("opens project preparation with the accepted collaborator, never a different user", () => {
    const onProject = vi.fn();
    setup({ connected: true, onProject });
    fireEvent.click(screen.getByRole("button", { name: "Quick look" }));
    fireEvent.click(screen.getByRole("button", { name: "Start a project" }));
    expect(onProject).toHaveBeenCalledWith(person);
  });
});
