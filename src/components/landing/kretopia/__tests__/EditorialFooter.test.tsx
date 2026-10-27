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
      ["Contact", "mailto:support@kretopia.com"],
      ["Terms of Service", "/terms"],
      ["Privacy Policy", "/privacy"],
    ]);
    expect(within(legal).queryByRole("link", { name: "Legal" })).not.toBeInTheDocument();
    expect(within(legal).queryByRole("link", { name: "Privacy" })).not.toBeInTheDocument();
  });
});
