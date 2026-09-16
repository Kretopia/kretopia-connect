import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MagazineArticleCard } from "../MagazineArticleCard";

const article = {
  id: "a1",
  title: "The Future of Bali's Creative Scene",
  subtitle: "A look at what's next",
  cover_image_url: null,
  category: "art-culture",
  author_name: "Ava Chen",
  read_time_minutes: 5,
  view_count: 120,
  like_count: 12,
  comment_count: 3,
};

describe("MagazineArticleCard", () => {
  it("opens the article on click", () => {
    const onOpen = vi.fn();
    render(<MagazineArticleCard article={article} categoryLabel="Art & Culture" onOpen={onOpen} />);
    screen.getByRole("button").click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the subtitle only in the featured layout", () => {
    const { rerender } = render(
      <MagazineArticleCard article={article} categoryLabel="Art & Culture" featured onOpen={() => {}} />,
    );
    expect(screen.getByText("A look at what's next")).toBeInTheDocument();

    rerender(<MagazineArticleCard article={article} categoryLabel="Art & Culture" onOpen={() => {}} />);
    expect(screen.queryByText("A look at what's next")).not.toBeInTheDocument();
  });

  it("only renders the edit control when canEdit is true", () => {
    const onEdit = vi.fn();
    const { rerender } = render(
      <MagazineArticleCard article={article} categoryLabel="Art & Culture" onOpen={() => {}} />,
    );
    expect(screen.queryByLabelText("Edit article")).not.toBeInTheDocument();

    rerender(
      <MagazineArticleCard article={article} categoryLabel="Art & Culture" canEdit onEdit={onEdit} onOpen={() => {}} />,
    );
    expect(screen.getByLabelText("Edit article")).toBeInTheDocument();
  });

  it("shows like and comment counts when present", () => {
    render(<MagazineArticleCard article={article} categoryLabel="Art & Culture" onOpen={() => {}} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
