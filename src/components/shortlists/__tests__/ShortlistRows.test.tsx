import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ShortlistCreatorRow, ShortlistRow } from "../ShortlistRows";

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const draw = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={["/shortlists"]}>
      <Routes>
        <Route path="/shortlists" element={ui} />
        <Route path="/profile/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
const part = (root: HTMLElement, name: string) => root.querySelector<HTMLElement>(`[data-card-part="${name}"]`);

describe("ShortlistRow: one of the viewer's shortlists, as a row of the shared card", () => {
  it("names the list and counts its creators, in the singular for one", () => {
    const { unmount } = draw(<ShortlistRow name="Summer campaign DPs" itemCount={1} onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Summer campaign DPs" })).toBeInTheDocument();
    expect(screen.getByText("1 creator")).toBeInTheDocument();
    unmount();
    draw(<ShortlistRow name="Summer campaign DPs" itemCount={4} onOpen={vi.fn()} />);
    expect(screen.getByText("4 creators")).toBeInTheDocument();
  });

  it("opens the list from the row, as a real button a keyboard can reach", () => {
    const onOpen = vi.fn();
    draw(<ShortlistRow name="Summer campaign DPs" itemCount={4} onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: "Summer campaign DPs" });
    expect(button.className).toContain("after:absolute");
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the first three people in it, or a bookmark when it is empty", () => {
    const { container, unmount } = draw(<ShortlistRow name="Empty" itemCount={0} onOpen={vi.fn()} />);
    expect(container.querySelector("svg.lucide-bookmark")).not.toBeNull();
    unmount();
    const full = draw(<ShortlistRow name="Full" itemCount={5} previewAvatars={["a.jpg", "b.jpg", "c.jpg", "d.jpg"]} onOpen={vi.fn()} />);
    expect(full.container.querySelector("svg.lucide-bookmark")).toBeNull();
    // Radix draws the picture only once it has loaded, so what a test can count is the avatars themselves (each wears the card-coloured ring)
    expect(part(full.container.querySelector("article")!, "lead")!.querySelectorAll(".border-background")).toHaveLength(3);
  });
});

describe("ShortlistCreatorRow: a creator in a shortlist, as a row of the shared card", () => {
  const draftRow = (over: Partial<React.ComponentProps<typeof ShortlistCreatorRow>> = {}) => {
    const onRemove = vi.fn();
    draw(<ShortlistCreatorRow id="i1" fullName="Ana Lopez" jobTitle="Editor" avatarUrl={null} profilePath="/profile/ana" onRemove={onRemove} {...over} />);
    return { onRemove, row: screen.getByTestId("shortlist-item-i1") };
  };

  it("names the creator and their job title, and opens their Passport from the row", () => {
    const { row } = draftRow();
    expect(part(row, "meta")).toHaveTextContent("Editor");
    const link = within(row).getByRole("link", { name: "Ana Lopez" });
    expect(link).toHaveAttribute("href", "/profile/ana");
    fireEvent.click(link);
    expect(screen.getByTestId("where")).toHaveTextContent("/profile/ana");
  });

  it("removes them from the list with the trash icon, and only that: the Passport does not open", () => {
    const { row, onRemove } = draftRow();
    fireEvent.click(within(row).getByRole("button", { name: "Remove from list" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("where")).toBeNull();
  });

  it("does not invent a name or a title for someone whose profile is gone", () => {
    const { row } = draftRow({ fullName: null, jobTitle: null });
    expect(within(row).getByText("Unknown creator")).toBeInTheDocument();
    expect(part(row, "meta")).toBeNull();
  });
});
