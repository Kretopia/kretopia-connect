import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TalentMatchRow, type TalentMatchSummary } from "../TalentMatchRow";

const ana: TalentMatchSummary = {
  user_id: "t-1", full_name: "Ana Lopez", role: "Editor", avatar_url: null, location: "Paris",
  headline: "Fast cutter", match_reasons: ["Edits music videos", "Works in Paris", "A third reason"],
};

const draw = (over: Partial<React.ComponentProps<typeof TalentMatchRow>> = {}) => {
  const handlers = { onViewPassport: vi.fn(), onShortlist: vi.fn(), onMessage: vi.fn() };
  render(
    <MemoryRouter>
      <TalentMatchRow talent={ana} rank={1} shortlisted={false} saving={false} {...handlers} {...over} />
    </MemoryRouter>,
  );
  return { ...handlers, row: screen.getByTestId("talent-match-t-1") };
};
const part = (root: HTMLElement, name: string) => root.querySelector<HTMLElement>(`[data-card-part="${name}"]`);

describe("TalentMatchRow: one of Kreto's matches, as a row of the shared card", () => {
  it("says who they are by rank, role and place, with Kreto's headline and at most two reasons, and no percentage", () => {
    const { row } = draw({ rank: 3 });
    expect(within(row).getByText("#3")).toBeInTheDocument();
    expect(within(row).getByText("Ana Lopez")).toBeInTheDocument();
    expect(part(row, "meta")).toHaveTextContent("Editor · Paris");
    expect(part(row, "description")).toHaveTextContent('"Fast cutter"');
    expect(part(row, "tags")).toHaveTextContent("Edits music videos");
    expect(part(row, "tags")).toHaveTextContent("Works in Paris");
    expect(part(row, "tags")).not.toHaveTextContent("A third reason");
    expect(row.textContent).not.toMatch(/%|Excellent/);
  });

  it("leaves out what Kreto did not give: no headline, no reasons, no role or place", () => {
    const { row } = draw({ talent: { user_id: "t-1", full_name: "Ana Lopez" } });
    for (const name of ["meta", "description", "tags"]) expect(part(row, name), name).toBeNull();
  });

  it("opens their Passport from the row (a real link) and from View Passport", () => {
    const { row, onViewPassport } = draw();
    expect(within(row).getByRole("link", { name: "Ana Lopez" })).toHaveAttribute("href", "/profile/t-1");
    fireEvent.click(within(row).getByRole("button", { name: "View Passport" }));
    expect(onViewPassport).toHaveBeenCalledTimes(1);
  });

  it("offers Shortlist until they are kept, and then Message", () => {
    const first = draw();
    fireEvent.click(within(first.row).getByRole("button", { name: /Shortlist/ }));
    expect(first.onShortlist).toHaveBeenCalledTimes(1);
    expect(within(first.row).queryByRole("button", { name: /Message/ })).toBeNull();
  });

  it("says Message once they are shortlisted, and Message does not shortlist again", () => {
    const { row, onMessage, onShortlist } = draw({ shortlisted: true });
    fireEvent.click(within(row).getByRole("button", { name: /Message/ }));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onShortlist).not.toHaveBeenCalled();
    expect(within(row).queryByRole("button", { name: /Shortlist/ })).toBeNull();
  });

  it("cannot be shortlisted twice while it is being saved", () => {
    const { row, onShortlist } = draw({ saving: true });
    const button = within(row).getByRole("button", { name: /Shortlist/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onShortlist).not.toHaveBeenCalled();
  });
});
