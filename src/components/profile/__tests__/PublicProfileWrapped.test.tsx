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
    // The eyebrow is the short feature label every Kretopia panel has ("Scout", "Credits", "Discover"), not the title said twice.
    expect(document.getElementById("public-passport-title")?.previousElementSibling).toHaveTextContent(/^Passport$/);
    expect(within(region).queryByText("Kretopia · Creative Passport")).not.toBeInTheDocument();
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

  // The Kretopia title, as on Scout, Today and the other panels: the text in the foreground colour (white in Midnight), then one phrase in
  // the logo's own linear gradient (.k-gradient-text, defined from the logo's four stops). It was the brand's Signal Teal for a while;
  // the product owner asked for the Kretopia title back, so this pins the new decision rather than the old one.
  it("sets the title the Kretopia way: the person's text in white, then 'Creative Passport' in the logo gradient", () => {
    renderIt();
    const title = document.getElementById("public-passport-title") as HTMLElement;
    expect(title).toHaveTextContent("Maya's Creative Passport");
    expect(title.className).toContain("text-foreground");
    const accents = title.querySelectorAll(".k-gradient-text");
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent("Creative Passport");
    // the white part is the heading's own text, outside the gradient span
    expect((title.textContent ?? "").replace("Creative Passport", "").trim()).toBe("Maya's");
    // and no leftover of the teal accent
    expect(title.querySelector("[data-epk-accent]")).toBeNull();
    expect(title.innerHTML).not.toContain("--passport-accent");
  });

  it("carries the Kretopia lockup", () => {
    renderIt();
    expect(document.querySelector('img[alt="Kretopia"]')).toBeInTheDocument();
  });
});
