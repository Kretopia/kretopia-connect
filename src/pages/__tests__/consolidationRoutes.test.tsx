import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RedirectKeepingSearch } from "@/components/RedirectKeepingSearch";
import { redirectTarget } from "@/lib/redirectTarget";
import { SCOUT_PATH, scoutFeedTarget } from "@/lib/opportunityRoutes";

const Where = () => {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="where">{pathname + search + hash}</output>;
};

describe("merged discovery destinations", () => {
  it("preserves nested Scout bookmarks, filters and anchor", () => {
    render(<MemoryRouter initialEntries={["/opportunities/scout?tab=all&q=film%20score#results"]}>
      <Routes>
        <Route path="/opportunities/scout" element={<RedirectKeepingSearch to={SCOUT_PATH} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>);
    expect(screen.getByTestId("where").textContent).toBe("/scout?tab=all&q=film+score#results");
  });
  it("opens the former Passport directory on Match's Grid, preserving search and anchor", () => {
    expect(redirectTarget("/match?tab=browse&view=grid", "?q=designer", "#people")).toEqual({
      pathname: "/match", search: "?q=designer&tab=browse&view=grid", hash: "#people",
    });
    // and that is where the app sends /passport
    expect(readFileSync("src/App.tsx", "utf8")).toContain('<Route path="/passport" element={<RedirectKeepingSearch to="/match?tab=browse&view=grid" />} />');
  });
  it("keeps marketplace offers inside Scout", () => {
    expect(scoutFeedTarget("view=marketplace&q=film")).toBe("/scout?q=film&tab=marketplace");
  });
  it("keeps personalised feed bookmarks inside Scout", () => {
    expect(scoutFeedTarget("q=designer")).toBe("/scout?q=designer&tab=scouted");
  });
});
