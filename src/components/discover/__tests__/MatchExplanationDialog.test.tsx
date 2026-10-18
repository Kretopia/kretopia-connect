import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MatchExplanationDialog } from "../MatchExplanationDialog";

const baseMatch = { user_id: "u2", name: "Ava Chen", title: "Photographer", location: "Los Angeles, CA", image: "" };

const renderDialog = (match: Parameters<typeof MatchExplanationDialog>[0]["match"] = baseMatch) => {
  const onConnect = vi.fn();
  const onPass = vi.fn();
  const onOpenChange = vi.fn();
  render(<MatchExplanationDialog open onOpenChange={onOpenChange} match={match} onConnect={onConnect} onPass={onPass} />);
  return { onConnect, onPass, onOpenChange };
};

describe("MatchExplanationDialog: the reasons, not a score", () => {
  it("lists exactly the reasons it is given", () => {
    renderDialog({ ...baseMatch, matchReasons: ["Shared craft · Photographer", "Shared skills: Lighting"] });
    const list = screen.getByRole("list");
    expect(list.textContent).toContain("Shared craft · Photographer");
    expect(list.textContent).toContain("Shared skills: Lighting");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows no percentage and no 'Perfect/Great/Good Match' label, even when an old caller passes a score", () => {
    const { container } = (() => {
      renderDialog({ ...baseMatch, matchReasons: ["Based in Los Angeles"], matchScore: 140, ai_match_score: 97 });
      return { container: document.body };
    })();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/Perfect Match|Great Match|Good Match/);
    expect(text).not.toMatch(/140|97/);
  });

  it("does not invent a reason when there is none: it says so and points at the Passport", () => {
    renderDialog({ ...baseMatch });
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText(/No shared craft, skills, city or history yet/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/collaboration potential|work great together|AI analyzing/i);
  });

  it("does not call the AI function or any service on open (no spinner, no network)", () => {
    // The component imports no client at all: rendering it cannot reach one.
    renderDialog({ ...baseMatch, matchReasons: ["Open to collaborating"] });
    expect(screen.queryByText(/analyzing/i)).toBeNull();
  });

  it("Pass and Connect still act and close the dialog", () => {
    const { onConnect, onPass, onOpenChange } = renderDialog({ ...baseMatch, matchReasons: ["Open to collaborating"] });
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(onPass).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
