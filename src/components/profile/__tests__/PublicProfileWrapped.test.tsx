import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { PublicProfileWrapped } from "../PublicProfileWrapped";

const stats = [
  { id: "credits", label: "Credits", value: 12 },
  { id: "confirmed", label: "Confirmed", value: 5 },
  { id: "features", label: "Features", value: 2 },
  { id: "awards", label: "Awards", value: 0 },
] as const;

const renderIt = (verified = true) =>
  render(
    <MemoryRouter>
      <PublicProfileWrapped
        userId="11111111-2222-3333-4444-555555555555"
        fullName="Maya Laurent"
        verified={verified}
        stats={[...stats]}
        passport={<article aria-label="Passport card">the passport</article>}
      >
        <section aria-label="Record">the record</section>
      </PublicProfileWrapped>
    </MemoryRouter>,
  );

describe("PublicProfileWrapped", () => {
  it("is one Wrapped surface named for the person's Passport", () => {
    renderIt();
    const region = screen.getByRole("region", { name: /Maya's Creative Passport/ });
    expect(within(region).getByText("Kretopia · Creative Passport")).toBeInTheDocument();
    expect(within(region).getByText("Verified on Kretopia")).toBeInTheDocument();
    expect(within(region).getByText(/KRT-11111/)).toBeInTheDocument();
  });

  it("does not claim a verification it does not have", () => {
    renderIt(false);
    expect(screen.queryByText("Verified on Kretopia")).not.toBeInTheDocument();
    expect(screen.getByText("On Kretopia")).toBeInTheDocument();
  });

  it("shows the four counts as plain figures, a zero included, never as links", () => {
    renderIt();
    const list = screen.getByRole("list", { name: "Passport record" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).queryAllByRole("link")).toHaveLength(0);
    expect(within(list).queryAllByRole("button")).toHaveLength(0);
    expect(within(list).getByText("12")).toBeInTheDocument();
    expect(within(list).getByText("Awards")).toBeInTheDocument();
  });

  it("puts the Passport before the record: it is the highlighted block", () => {
    renderIt();
    const passport = screen.getByLabelText("Passport card");
    const record = screen.getByLabelText("Record");
    expect(Boolean(passport.compareDocumentPosition(record) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  // The title used the logo's blue-violet-pink-orange gradient; on this page one measured brand accent is used instead.
  it("colours only 'Creative Passport' in the title, with the brand pink and no gradient", () => {
    renderIt();
    const title = document.getElementById("public-passport-title") as HTMLElement;
    expect(title).toHaveTextContent("Maya's Creative Passport");
    const accent = title.querySelector("[data-epk-accent]") as HTMLElement;
    expect(accent).toHaveTextContent("Creative Passport");
    expect(accent.className).toContain("--k-pink");
    expect(title.querySelector(".k-gradient-text")).toBeNull();
    expect(document.querySelector(".k-gradient-text, .k-gradient-title")).toBeNull();
  });

  it("carries the Kretopia lockup", () => {
    renderIt();
    expect(document.querySelector('img[alt="Kretopia"]')).toBeInTheDocument();
  });
});
