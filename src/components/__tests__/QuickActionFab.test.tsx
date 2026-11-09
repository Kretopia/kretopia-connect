import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { account_type: "creator" } }) }) }) }) },
}));

import { ModalSurfaceProvider } from "@/components/ui/ModalSurfaceProvider";
import QuickActionFab from "../QuickActionFab";

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const draw = (branded: boolean) =>
  render(
    <MemoryRouter initialEntries={["/discover"]}>
      <ModalSurfaceProvider branded={branded}>
        <Routes>
          <Route path="/discover" element={<QuickActionFab />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </ModalSurfaceProvider>
    </MemoryRouter>,
  );
const open = () => fireEvent.click(screen.getByRole("button", { name: "Open quick actions" }));
const sheet = () => screen.getByRole("dialog", { name: "Quick actions" });
const panel = () => sheet().firstElementChild as HTMLElement;
// While the sheet is open the ＋ itself is named "Close quick actions" too; the backdrop is the one that covers the page.
const backdrop = () => screen.getAllByRole("button", { name: "Close quick actions" }).find((b) => b.className.includes("inset-0"))!;

describe("QuickActionFab: the action sheet is a modal, so a member's wears the Passport QR modal's surface", () => {
  it("takes the QR modal's backdrop, border, aura and title, and keeps its own width and slide", () => {
    draw(true);
    open();
    expect(backdrop().className).toContain("bg-black/80");
    expect(backdrop().className).not.toContain("bg-background/70");
    expect(panel().className).toContain("border-energy/30");
    expect(panel().className).toContain("shadow-glow");
    expect(panel().className).not.toContain("shadow-2xl");
    expect(panel().className).toContain("max-w-md");
    expect(within(sheet()).getByText("Quick actions").className).toContain("text-2xl");
    expect(sheet().className).toContain("slide-in-from-bottom-4");
    // the close control has the dialog's look: faint until hovered, a ring on focus
    expect(within(sheet()).getByRole("button", { name: "Close" }).className).toContain("opacity-70");
  });

  it("is what it always was without a member: the page-coloured veil, a plain border and the small title", () => {
    draw(false);
    open();
    expect(backdrop().className).toContain("bg-background/70");
    expect(panel().className).toContain("border-border/60");
    expect(panel().className).not.toContain("shadow-glow");
    expect(within(sheet()).getByText("Quick actions").className).toContain("text-sm");
  });

  it("still closes on Escape, on the backdrop and on its close button, and opening an action closes it", () => {
    draw(true);
    open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Quick actions" })).toBeNull();
    open();
    fireEvent.click(backdrop());
    expect(screen.queryByRole("dialog", { name: "Quick actions" })).toBeNull();
    open();
    fireEvent.click(within(sheet()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Quick actions" })).toBeNull();
  });

  it("goes to the page an action names, and the sheet is gone when it gets there", () => {
    draw(true);
    open();
    fireEvent.click(within(sheet()).getByRole("button", { name: /Find a gig/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/opportunities");
  });
});
