import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ userId: "owner-1" as string | null, firstTime: false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.userId ? { id: auth.userId } : null }) }));
vi.mock("@/hooks/useFirstTimeUser", () => ({ useFirstTimeUser: () => ({ isFirstTime: auth.firstTime, loading: false }) }));
vi.mock("../../features/FeatureTutorialDialogContent", async () => {
  const { DialogContent } = await import("@/components/ui/dialog");
  return { FeatureTutorialDialogContent: () => <DialogContent aria-describedby={undefined}>the tour</DialogContent> };
});

import { PassportPageHeader } from "../PassportPageHeader";

const OWNER = "owner-1";
const OTHER = "someone-else";

const renderHeader = (props: React.ComponentProps<typeof PassportPageHeader>) =>
  render(
    <MemoryRouter>
      <PassportPageHeader {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  auth.userId = OWNER;
  auth.firstTime = false;
});

describe("PassportPageHeader: one header for the private and the public Passport", () => {
  it("says the same thing on both surfaces: same title, same line under it, same tour trigger", () => {
    const privateView = renderHeader({ surface: "private", viewerId: OWNER, passportOwnerId: OWNER });
    const heading = screen.getByRole("heading", { level: 1 });
    const privateText = heading.textContent;
    const privateSubtitle = privateView.container.querySelector("p")?.textContent;
    expect(privateText).toContain("Passport.");
    expect(privateText).toContain("Work, verified.");
    expect(screen.getByRole("button", { name: /How this works/i })).toBeInTheDocument();
    privateView.unmount();

    const publicView = renderHeader({ surface: "public", viewerId: OTHER, passportOwnerId: OWNER });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(privateText);
    expect(publicView.container.querySelector("p")?.textContent).toBe(privateSubtitle);
    expect(screen.getByRole("button", { name: /How this works/i })).toBeInTheDocument();
  });

  it("sets the title the Kretopia way: white first line, the second in the logo gradient", () => {
    renderHeader({ surface: "public", viewerId: null, passportOwnerId: OWNER });
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.querySelector(".k-gradient-text")).toHaveTextContent("Work, verified.");
  });

  it("private view: 'View my public Passport' opens the public Passport of the signed-in account", () => {
    renderHeader({ surface: "private", viewerId: OWNER, passportOwnerId: OWNER });
    const link = screen.getByRole("link", { name: "View my public Passport" });
    expect(link).toHaveAttribute("href", `/epk/${OWNER}`);
    expect(screen.queryByRole("link", { name: /Back to my private Passport/ })).toBeNull();
  });

  it("private view: the identity comes from the signed-in account, not from the Passport id the page holds", () => {
    renderHeader({ surface: "private", viewerId: OWNER, passportOwnerId: OTHER });
    expect(screen.getByRole("link", { name: "View my public Passport" })).toHaveAttribute("href", `/epk/${OWNER}`);
  });

  it("public view of one's own Passport: 'Back to my private Passport', and no redundant 'view public' action", () => {
    renderHeader({ surface: "public", viewerId: OWNER, passportOwnerId: OWNER });
    expect(screen.getByRole("link", { name: "Back to my private Passport" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: /View my public Passport/ })).toBeNull();
  });

  it("public view of somebody else's Passport, or as a visitor: no link at all, and nothing that mentions a private Passport", () => {
    for (const viewerId of [OTHER, null]) {
      const { container, unmount } = renderHeader({ surface: "public", viewerId, passportOwnerId: OWNER });
      expect(screen.queryByRole("link")).toBeNull();
      expect(container.innerHTML).not.toMatch(/private Passport/i);
      expect(container.innerHTML).not.toContain('href="/profile"');
      unmount();
    }
  });

  it("the tour opens by itself for a new member on their private Passport, never on somebody else's public one", () => {
    auth.firstTime = true;
    const privateView = renderHeader({ surface: "private", viewerId: OWNER, passportOwnerId: OWNER });
    expect(screen.getByText("the tour")).toBeInTheDocument();
    privateView.unmount();
    localStorage.clear();

    renderHeader({ surface: "public", viewerId: OWNER, passportOwnerId: OTHER });
    expect(screen.queryByText("the tour")).toBeNull();
    // still one press away
    expect(screen.getByRole("button", { name: /How this works/i })).toBeInTheDocument();
  });
});
