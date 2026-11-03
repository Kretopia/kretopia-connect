import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { BackToPassport } from "../BackToPassport";
import { returnState } from "@/lib/passportReturn";

const Probe = () => {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}{location.search}|{JSON.stringify(location.state)}</output>;
};

const renderAt = (state: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/production", search: "?name=Heat", state }]}>
      <Routes>
        <Route path="/production" element={<><BackToPassport /><Probe /></>} />
        <Route path="/passport/:id" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("BackToPassport", () => {
  it("is an obvious, labelled link to the Passport it was opened from, tab and filters included", () => {
    renderAt(returnState("/passport/abc?tab=stamps&filter=verified", "Passport", 480));
    const link = screen.getByRole("link", { name: "Back to Passport" });
    expect(link).toHaveAttribute("href", "/passport/abc?tab=stamps&filter=verified");
    expect(link).toHaveTextContent("Passport");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is reachable by keyboard: a link, in the tab order", () => {
    renderAt(returnState("/passport/abc", "Passport", 0));
    const link = screen.getByRole("link", { name: "Back to Passport" });
    link.focus();
    expect(document.activeElement).toBe(link);
    expect(link.getAttribute("tabindex")).not.toBe("-1");
  });

  it("goes to the Passport and hands over how far down the page it was, rather than stepping back in history", () => {
    renderAt(returnState("/passport/abc?tab=stamps", "Passport", 480));
    fireEvent.click(screen.getByRole("link", { name: "Back to Passport" }));
    const where = screen.getByTestId("where").textContent!;
    expect(where.startsWith("/passport/abc?tab=stamps|")).toBe(true);
    expect(JSON.parse(where.split("|")[1])).toEqual({ restoreScrollTop: 480 });
  });

  it("names the Passport it returns to", () => {
    renderAt(returnState("/passport/abc", "Ethan's Passport", 0));
    expect(screen.getByRole("link", { name: "Back to Ethan's Passport" })).toBeInTheDocument();
  });

  it.each([
    ["no state (the view was not opened from a Passport)", undefined],
    ["an external address", { returnTo: { path: "https://evil.example", label: "Passport", scrollTop: 0 } }],
  ])("renders nothing for %s", (_name, state) => {
    renderAt(state);
    expect(screen.queryByRole("link", { name: /Back to/ })).toBeNull();
  });
});
