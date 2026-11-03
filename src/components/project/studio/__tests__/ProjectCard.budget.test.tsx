import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { expectWithinBudget } from "@/test/cardBudget";
import { ProjectCard, type ProjectCardProps } from "../ProjectCard";

const LONG = "A very long project name for a very long-running programme of work that never seems to end ".repeat(4);

const base = (over: Partial<ProjectCardProps> = {}): ProjectCardProps => ({
  title: LONG,
  coverUrl: null,
  accent: "#ff5599",
  monogram: "AV",
  status: { label: "Active", tone: "bg-primary/15 text-primary" },
  workspaceLabel: "Film",
  client: LONG,
  nextAction: LONG,
  progress: 50,
  deadline: "Nov 30",
  pay: { label: "Awaiting payment", dot: "bg-amber-500" },
  onOpen: vi.fn(),
  onMove: vi.fn(),
  ...over,
});

const renderCard = (props: Partial<ProjectCardProps> = {}) => render(<MemoryRouter><ProjectCard {...base(props)} /></MemoryRouter>);

describe("the project card keeps to the card budget", () => {
  it("whatever the project holds", () => {
    const { container } = renderCard();
    expectWithinBudget(container);
  });

  it("holds three facts at most: where it stands, when it is due, and money (only when this person may see it)", () => {
    const { container } = renderCard();
    const tags = container.querySelector('[data-card-part="tags"]')!;
    expect(tags.children).toHaveLength(3);
    expect(tags).toHaveTextContent("50% complete");
    expect(tags).toHaveTextContent("Due Nov 30");
    expect(tags).toHaveTextContent("Awaiting payment");
  });

  it("leaves out the facts it does not have, and says nothing about money it may not show", () => {
    const { container } = renderCard({ deadline: null, pay: null });
    const tags = container.querySelector('[data-card-part="tags"]')!;
    expect(tags.children).toHaveLength(1);
    expect(container).not.toHaveTextContent(/payment|Invoiced/);
  });

  it("is one target: the whole card opens the project, and Move to… does not", () => {
    const onOpen = vi.fn();
    const onMove = vi.fn();
    const { container } = renderCard({ title: "Carnival Film", onOpen, onMove });
    fireEvent.click(screen.getByText("Carnival Film"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-card-part="title"]')!.className).toContain("after:absolute");
    fireEvent.click(screen.getByRole("button", { name: "Move Carnival Film to a folder" }));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("has no secondary action when there is nowhere to move it", () => {
    const { container } = renderCard({ onMove: undefined });
    expect(container.querySelector('[data-card-part="secondary"]')).toBeNull();
  });

  it("wears its picture when it has one, and Kreto's workspace scene tinted with its mood when it does not", () => {
    const { container, rerender } = renderCard({ coverUrl: "https://cdn.example/cover.jpg" });
    expect(container.querySelector('[data-card-part="cover"] img')).toHaveAttribute("src", "https://cdn.example/cover.jpg");
    rerender(<MemoryRouter><ProjectCard {...base()} /></MemoryRouter>);
    expect(container.querySelector('[data-card-part="cover"]')).toHaveTextContent("AV");
  });
});
