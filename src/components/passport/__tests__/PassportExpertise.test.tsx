import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildExpertise } from "@/lib/passport/expertise";
import { PassportExpertise } from "../PassportExpertise";

const full = buildExpertise({
  jobTitle: "Director of Photography",
  subRoles: ["Colorist"],
  professionalSkills: ["Lighting design", "Colour grading"],
  passionSkills: ["Surfing"],
  credentials: [{ id: "c1", title: "IMDb Pro rank", value: "#1,204", issuer: "IMDb" }],
  awards: [{ id: "a1", title: "Best Cinematography", organization: "Lyon Festival", year: 2024 }],
  press: [{ id: "p1", title: "Dee lights a short", publication: "Frame Weekly", url: "https://example.com/a" }],
});

describe("PassportExpertise", () => {
  it("sets Expertise out as a CV: a labelled row for roles, skills, interests, credentials, awards and where the work was featured", () => {
    const { container } = render(<PassportExpertise expertise={full} />);
    expect(screen.getByRole("heading", { level: 3, name: "Expertise" })).toBeInTheDocument();
    const labels = [...container.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(labels).toEqual(["Roles", "Skills", "Interests", "Credentials", "Awards", "Featured in"]);
    expect(screen.getByText("Director of Photography · Colorist")).toBeInTheDocument();
    const skills = within(screen.getByRole("list", { name: "Skills" }));
    expect(skills.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Lighting design", "Colour grading"]);
    expect(screen.getByText("Surfing")).toBeInTheDocument();
    expect(screen.getByText("#1,204")).toBeInTheDocument();
    expect(screen.getByText(/Best Cinematography/)).toBeInTheDocument();
    expect(screen.getByText(/Lyon Festival, 2024/)).toBeInTheDocument();
  });

  it("folds Featured In and Awards into the section: no separate region, no second heading", () => {
    render(<PassportExpertise expertise={full} />);
    expect(screen.queryByRole("region", { name: "Featured in and awards" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Featured In" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Awards" })).toBeNull();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("opens the press the owner confirmed in a new tab, without leaking the opener", () => {
    render(<PassportExpertise expertise={full} />);
    const link = screen.getByRole("link", { name: /Dee lights a short/ });
    expect(link).toHaveAttribute("href", "https://example.com/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("opens in a new tab");
  });

  it("draws only the rows that have something", () => {
    const { container } = render(<PassportExpertise expertise={buildExpertise({ role: "Editor", professionalSkills: ["Avid"] })} />);
    expect([...container.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Roles", "Skills"]);
  });

  it("draws no section at all for a visitor when there is nothing to show", () => {
    const { container } = render(<PassportExpertise expertise={buildExpertise({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the owner an edit action that opens the Passport editor, and says what it edits", () => {
    const onEditRoles = vi.fn();
    render(<PassportExpertise expertise={full} onEditRoles={onEditRoles} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit roles" }));
    expect(onEditRoles).toHaveBeenCalledTimes(1);
  });

  it("tells the owner what to add when the record is empty, and offers no edit to a visitor", () => {
    const { unmount } = render(<PassportExpertise expertise={buildExpertise({})} onEditRoles={() => {}} />);
    expect(screen.getByText(/Add your roles/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit roles" })).toBeInTheDocument();
    unmount();
    render(<PassportExpertise expertise={full} />);
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
  });
});
