import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClaimableProject } from "@/lib/passport/claimableProjects";
import { PassportClaimCreditsDialog } from "../PassportClaimCreditsDialog";

const projects: ClaimableProject[] = [
  { id: "c1", name: "Night Train", role: "Director", year: 2024 },
  { id: "c2", name: "Open Road", role: "Editor", year: null },
];

describe("PassportClaimCreditsDialog", () => {
  it("asks which project the visitor worked on, and is not about owning this Passport", () => {
    render(<PassportClaimCreditsDialog open onOpenChange={() => {}} firstName="Nova" projects={projects} onChoose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Claim a credit" });
    expect(within(dialog).getByText(/Worked on one of Nova's projects/)).toBeInTheDocument();
    expect(within(dialog).getByText(/stays pending until the person or company concerned confirms it/)).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/claim (this|nova's) (profile|passport)/i);
    const list = within(screen.getByRole("list", { name: "Nova's projects" }));
    expect(list.getAllByRole("button").map((b) => b.textContent)).toEqual(["Night TrainDirector · 2024", "Open RoadEditor"]);
  });

  it("opens the chosen project, and nothing else, when one is picked", () => {
    const onChoose = vi.fn();
    render(<PassportClaimCreditsDialog open onOpenChange={() => {}} firstName="Nova" projects={projects} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: /Open Road/ }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(projects[1]);
  });

  it("says on the row which projects the visitor already has a credit on, and still lets them open it", () => {
    const onChoose = vi.fn();
    render(<PassportClaimCreditsDialog open onOpenChange={() => {}} firstName="Nova" projects={projects} onChoose={onChoose} alreadyCredited={new Set(["night train"])} />);
    const night = screen.getByRole("button", { name: /Night Train/ });
    expect(night).toHaveTextContent("You already have a credit on this project");
    expect(screen.getByRole("button", { name: /Open Road/ })).not.toHaveTextContent("already have a credit");
    fireEvent.click(night);
    expect(onChoose).toHaveBeenCalledWith(projects[0]);
  });

  it("says plainly that there is nothing to claim a role on when the Passport lists no project", () => {
    render(<PassportClaimCreditsDialog open onOpenChange={() => {}} firstName="Nova" projects={[]} onChoose={() => {}} />);
    expect(screen.getByText(/Nova has no projects listed yet/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("draws nothing while closed", () => {
    render(<PassportClaimCreditsDialog open={false} onOpenChange={() => {}} firstName="Nova" projects={projects} onChoose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
