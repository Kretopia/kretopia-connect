import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";

describe("EditorialFooter legal column", () => {
  it("points at the Terms of Service and the Privacy Policy, in place of Legal and Privacy", () => {
    render(
      <MemoryRouter>
        <EditorialFooter />
      </MemoryRouter>,
    );
    const legal = screen.getByRole("navigation", { name: "Legal" });
    const links = within(legal).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["About", "/about"],
      ["Contact", "/contact"],
      ["Terms of Service", "/terms"],
      ["Privacy Policy", "/privacy"],
      ["Community", "/community-guidelines"],
    ]);
    expect(within(legal).queryByRole("link", { name: "Legal" })).not.toBeInTheDocument();
    expect(within(legal).queryByRole("link", { name: "Privacy" })).not.toBeInTheDocument();
  });
});

describe("EditorialFooter balanced variant", () => {
  const linksOf = (variant?: "balanced") => {
    const { unmount } = render(
      <MemoryRouter>
        <EditorialFooter variant={variant} />
      </MemoryRouter>,
    );
    const columns = screen.getAllByRole("navigation").map((nav) => ({
      heading: nav.getAttribute("aria-label"),
      links: within(nav).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")]),
    }));
    unmount();
    return columns;
  };

  it("holds the same links as the default footer, none added or dropped", () => {
    const all = (cols: ReturnType<typeof linksOf>) => cols.flatMap((c) => c.links.map((l) => `${l[0]}|${l[1]}`)).sort();
    expect(all(linksOf("balanced"))).toEqual(all(linksOf()));
  });

  it("evens the columns out to 4 / 4 / 4 / 5", () => {
    expect(linksOf("balanced").map((c) => c.links.length)).toEqual([4, 4, 4, 5]);
  });

  it("leaves the default footer as it was, since other pages share it", () => {
    expect(linksOf().map((c) => c.links.length)).toEqual([5, 3, 4, 5]);
  });

  it("Pricing still opens the real public pricing page", () => {
    const pricing = linksOf("balanced").flatMap((c) => c.links).find((l) => l[0] === "Pricing");
    expect(pricing?.[1]).toBe("/pricing");
  });
});

