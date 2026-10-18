import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const engagement = vi.hoisted(() => ({
  liked: false,
  likeCount: 0,
  commentCount: 0,
  toggleLike: vi.fn(),
  loadComments: vi.fn(),
}));

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ isEditorOrAdmin: false }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useMagazineArticleEngagement", () => ({
  useMagazineArticleEngagement: () => ({
    liked: engagement.liked,
    likeCount: engagement.likeCount,
    commentCount: engagement.commentCount,
    comments: [],
    commentsLoading: false,
    posting: false,
    loadComments: engagement.loadComments,
    toggleLike: engagement.toggleLike,
    addComment: vi.fn(),
  }),
}));
vi.mock("../MagazineEditor", () => ({ MagazineEditor: () => null }));
vi.mock("@/components/brand/KretopiaQRCode", () => ({ KretopiaQRCode: () => null }));
vi.mock("@/components/BrandLogo", () => ({ BrandLogo: () => <span data-testid="logo" /> }));

import { MagazineArticleViewer } from "../MagazineArticleViewer";
import { MagazineArticleModal } from "../MagazineArticleModal";

const article = {
  id: "a1",
  title: "The Power of PR",
  subtitle: "Earned media",
  content: "Short body.",
  cover_image_url: null,
  category: "business",
  author_name: "Kretopia",
  author_avatar_url: null,
  read_time_minutes: 4,
  view_count: 7,
  like_count: 0,
  comment_count: 0,
  created_at: "2026-04-01T00:00:00Z",
  slug: "the-power-of-pr",
};

const renderViewer = (props: Partial<React.ComponentProps<typeof MagazineArticleViewer>> = {}) =>
  render(
    <MemoryRouter>
      <MagazineArticleViewer article={article} onBack={() => {}} {...props} />
    </MemoryRouter>,
  );

describe("magazine reader: the like and comment counters have names", () => {
  it("names the like button with its count, singular and plural, and keeps its pressed state", () => {
    engagement.likeCount = 0;
    const { unmount } = renderViewer();
    expect(screen.getByRole("button", { name: "Like this story, 0 likes" })).toHaveAttribute("aria-pressed", "false");
    unmount();

    engagement.likeCount = 1;
    engagement.liked = true;
    renderViewer();
    expect(screen.getByRole("button", { name: "Like this story, 1 like" })).toHaveAttribute("aria-pressed", "true");
    engagement.liked = false;
  });

  it("names the comments button with its count and says whether the list is open", () => {
    engagement.likeCount = 0;
    engagement.commentCount = 3;
    renderViewer();
    const button = screen.getByRole("button", { name: "Show comments, 3 comments" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(engagement.loadComments).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Hide comments, 3 comments" })).toHaveAttribute("aria-expanded", "true");
    engagement.commentCount = 0;
  });

  it("no button in the reader is named only by a bare number", () => {
    engagement.likeCount = 0;
    engagement.commentCount = 0;
    renderViewer();
    for (const b of screen.getAllByRole("button")) {
      expect((b.getAttribute("aria-label") ?? b.textContent ?? "").trim()).not.toMatch(/^\d+$/);
    }
  });

  it("Share is still there, named and openable", () => {
    renderViewer();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("only reserves room for the dialog's close button when it is inside the dialog", () => {
    const { container, unmount } = renderViewer();
    expect(container.querySelector(".sticky")).not.toHaveClass("pr-16");
    unmount();
    const inside = renderViewer({ inDialog: true });
    expect(inside.container.querySelector(".sticky")).toHaveClass("pr-16");
  });
});

describe("magazine reader dialog: the close control is a real tap target", () => {
  it("is 44px square, away from the share button's column, and still named Close", () => {
    render(
      <MemoryRouter>
        <MagazineArticleModal article={article} onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    // the classes live on the dialog content (they style its direct child button)
    const content = close.parentElement!;
    expect(content.className).toContain("[&>button]:h-11");
    expect(content.className).toContain("[&>button]:w-11");
    expect(content.className).toContain("[&>button>svg]:h-5");
  });
});
