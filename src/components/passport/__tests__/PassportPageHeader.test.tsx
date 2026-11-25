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
    const privateView = renderHeader({ surface: "private" });
    const heading = screen.getByRole("heading", { level: 1 });
    const privateText = heading.textContent;
    const privateSubtitle = privateView.container.querySelector("p")?.textContent;
    expect(privateText).toContain("Passport.");
    expect(privateText).toContain("Work, verified.");
    expect(screen.getByRole("button", { name: /How this works/i })).toBeInTheDocument();
    privateView.unmount();

    const publicView = renderHeader({ surface: "public" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(privateText);
    expect(publicView.container.querySelector("p")?.textContent).toBe(privateSubtitle);
    expect(screen.getByRole("button", { name: /How this works/i })).toBeInTheDocument();
  });

  it("sets the title the Kretopia way: white first line, the second in the logo gradient", () => {
    renderHeader({ surface: "public" });
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.querySelector(".k-gradient-text")).toHaveTextContent("Work, verified.");
  });

  it("has no link between the views: the switch lives on the Passport card, not beside 'How this works'", () => {
    for (const surface of ["private", "public"] as const) {
      const { container, unmount } = renderHeader({ surface });
      expect(screen.queryByRole("link")).toBeNull();
      expect(container.innerHTML).not.toMatch(/View my (public|private) Passport/);
      expect(container.querySelector('[data-testid="feature-header-stickers"]')?.children).toHaveLength(1);
      unmount();
    }
  });

  it("the tour opens by itself for a new member on their private Passport, never on somebody else's public one", () => {
    auth.firstTime = true;
    const privateView = renderHeader({ surface: "private" });
    expect(screen.getByText("the tour")).toBeInTheDocument();
    privateView.unmount();
    localStorage.clear();

    renderHeader({ surface: "public" });
    expect(screen.queryByText("the tour")).toBeNull();
    // still one press away
    expect(screen.getByRole("button", { name: /How this works/i })).toBeInTheDocument();
  });
});
