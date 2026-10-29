import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import { TERMS } from "@/content/legal/terms";
import { PRIVACY } from "@/content/legal/privacy";
import type { LegalBlock, LegalDocument, LegalPart } from "@/content/legal/types";

vi.mock("@/components/SEO", () => ({ SEO: () => null }));

/** The designer's internal "before publication" notes: they were never part of the text and are not shipped. */
const INTERNAL_NOTES = [
  "Legal review required",
  "To complete before publication",
  "Before publication",
  "Training use is not stated here",
  "Cookie inventory required",
  "Previous 30-day promise",
  "supplied Kretopia materials",
  "supplied materials do not establish",
  "source set does not",
];

const plain = (parts: LegalPart[]) => parts.map((p) => (typeof p === "string" ? p : p.strong)).join("");
const textOf = (block: LegalBlock) => (block.type === "p" ? plain(block.content) : block.type === "ul" ? block.items.map(plain).join(" ") : `${block.cap} ${block.text}`);
const everyWord = (doc: LegalDocument) => JSON.stringify(doc);

const renderPage = (page: "terms" | "privacy", entry = `/${page}`) =>
  render(<MemoryRouter initialEntries={[entry]}>{page === "terms" ? <Terms /> : <Privacy />}</MemoryRouter>);

describe.each([
  { page: "terms" as const, doc: TERMS, sections: 15, h1: "Terms for creative work." },
  { page: "privacy" as const, doc: PRIVACY, sections: 16, h1: "Your work. Your data. Your context." },
])("$page document", ({ page, doc, sections, h1 }) => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("is the whole document: every section, numbered in order, with a unique anchor", () => {
    expect(doc.sections).toHaveLength(sections);
    expect(doc.sections.map((s) => s.num)).toEqual(Array.from({ length: sections }, (_, i) => String(i + 1).padStart(2, "0")));
    expect(doc.sections.map((s) => s.id)).toEqual(Array.from({ length: sections }, (_, i) => `s${String(i + 1).padStart(2, "0")}`));
    for (const s of doc.sections) expect(s.blocks.length).toBeGreaterThan(0);
  });

  it("ships none of the designer's internal publication notes", () => {
    const shipped = everyWord(doc);
    for (const note of INTERNAL_NOTES) expect(shipped).not.toContain(note);
  });

  it("wears the shared public page header, then one Wrapped panel with the date", () => {
    renderPage(page);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(h1);
    expect(screen.getByRole("heading", { level: 2, name: new RegExp(doc.panelHeading.accent.replace(".", "\\."), "i") })).toBeInTheDocument();
    expect(screen.getByText("Last updated 7 October 2026")).toBeInTheDocument();
  });

  it("renders every section as a numbered row with its title and its text", () => {
    renderPage(page);
    for (const s of doc.sections) {
      const row = document.getElementById(s.id);
      expect(row, s.id).not.toBeNull();
      expect(within(row as HTMLElement).getByRole("heading", { level: 3, name: s.title })).toBeInTheDocument();
      expect(row).toHaveTextContent(s.num);
      const firstText = s.blocks.map(textOf).find(Boolean)!.slice(0, 40);
      expect(row?.textContent).toContain(firstText);
    }
  });

  it("indexes the sections, and an index link scrolls to its section", () => {
    renderPage(page);
    const index = screen.getByRole("navigation", { name: new RegExp(`${doc.name}: sections`, "i") });
    const links = within(index).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(doc.sections.map((s) => s.title));

    fireEvent.click(links[4]);
    const target = document.getElementById(doc.sections[4].id) as HTMLElement;
    expect(target.scrollIntoView).toHaveBeenCalled();
  });

  it("lands on the section named by the URL hash", async () => {
    renderPage(page, `/${page}#s03`);
    await vi.waitFor(() => expect(document.getElementById("s03")!.scrollIntoView).toHaveBeenCalled());
  });

  it("links the three legal pages in equal tracks and marks this one", () => {
    renderPage(page);
    const links = ["Terms", "Privacy", "Community"].map((name) => screen.getByRole("link", { name }));
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/terms", "/privacy", "/community-guidelines"]);
    const here = links.filter((l) => l.getAttribute("aria-current") === "page");
    expect(here).toHaveLength(1);
    expect(here[0]).toHaveTextContent(page === "terms" ? "Terms" : "Privacy");
  });
});

describe("contact lines", () => {
  it("keeps the mailboxes the documents name", () => {
    const all = (doc: LegalDocument) => doc.sections.flatMap((s) => s.blocks.map(textOf)).join(" ");
    expect(all(PRIVACY)).toContain("privacy@kretopia.com");
    expect(all(TERMS)).toMatch(/@kretopia\.com/);
  });
});
