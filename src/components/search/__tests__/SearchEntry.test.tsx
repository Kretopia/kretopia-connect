import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SearchEntry } from "../SearchEntry";

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/search" element={<SearchEntry />} />
        <Route path="/scout" element={<p>scout page</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

describe("the /search route", () => {
  it("resolves the generic search address to Discover", () => {
    renderAt("/search");
    expect(screen.getByText("scout page")).toBeInTheDocument();
    expect(screen.queryByText("results page")).toBeNull();
    expect(screen.getByTestId("where")).toHaveTextContent("/scout");
  });

  it("keeps tab and mode on the way", () => {
    renderAt("/search?tab=people&mode=sourced&utm_source=footer");
    expect(screen.getByText("scout page")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/scout");
  });

  it("keeps a search with a term on the results page, with its term", () => {
    renderAt("/search?q=ux%20designer");
    expect(screen.getByText("scout page")).toBeInTheDocument();
    expect(screen.queryByText("results page")).toBeNull();
    expect(screen.getByTestId("where")).toHaveTextContent("/scout?q=ux%20designer");
  });

  it("sends a blank term to Discover", () => {
    renderAt("/search?q=%20");
    expect(screen.getByText("scout page")).toBeInTheDocument();
  });
});
