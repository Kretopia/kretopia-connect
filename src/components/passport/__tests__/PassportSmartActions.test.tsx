import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PassportSmartActions } from "../PassportSmartActions";

type Pdf = { onDownload: () => void; busy?: boolean; locked?: boolean };
const setup = (pdf?: Pdf) => {
  const h = { onEdit: vi.fn(), onShare: vi.fn(), onShowQR: vi.fn(), onDownloadEPK: vi.fn() };
  render(<PassportSmartActions {...h} pdf={pdf} />);
  return h;
};

describe("PassportSmartActions", () => {
  it("puts Edit, Share, QR and the press kit on one line", () => {
    setup();
    const list = screen.getByRole("list", { name: "Passport actions" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    // one row: a four-column grid, no wrapping container
    expect(list.className).toContain("grid-cols-4");
  });

  it("adds the PDF to the same line, as a fifth button, when the card can make it", () => {
    setup({ onDownload: vi.fn() });
    const list = screen.getByRole("list", { name: "Passport actions" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(list.className).toContain("grid-cols-5");
    expect(within(list).getByRole("button", { name: "Download PDF" })).toHaveTextContent("PDF");
  });

  it("draws no PDF button when there is nothing to make one with", () => {
    setup();
    expect(screen.queryByRole("button", { name: /PDF/ })).toBeInTheDocument(); // the press kit's name has "PDF" in it
    expect(screen.queryByRole("button", { name: "Download PDF" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Generating PDF" })).toBeNull();
  });

  it("names the actions", () => {
    setup();
    expect(screen.getByRole("button", { name: "Edit Passport" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share Passport" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show QR code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download press kit PDF" })).toBeInTheDocument();
  });

  it("the Edit button says Edit and nothing else: no percentage, no strength", () => {
    setup({ onDownload: vi.fn() });
    const edit = screen.getByRole("button", { name: "Edit Passport" });
    expect(edit).toHaveTextContent(/^Edit$/);
    expect(edit.textContent).not.toMatch(/\d|%/);
    expect(edit.getAttribute("aria-label")).not.toMatch(/Strength|\d/);
    expect(edit.getAttribute("title") ?? "").not.toMatch(/Strength|\d/);
    expect(edit.querySelector(".k-gradient-text")).toBeNull();
  });

  it("every icon draws in the text colour, none in the logo gradient", () => {
    const { container } = render(<PassportSmartActions onEdit={() => {}} onShare={() => {}} onShowQR={() => {}} onDownloadEPK={() => {}} pdf={{ onDownload: () => {} }} />);
    const icons = container.querySelectorAll("button svg");
    expect(icons).toHaveLength(5);
    for (const icon of icons) {
      expect(icon.getAttribute("stroke")).not.toMatch(/url\(/);
      expect(icon.getAttribute("stroke") ?? "currentColor").toBe("currentColor");
    }
    // the gradient definitions that used to colour them are gone, and the K image no longer stands in the Edit tile
    expect(container.querySelector("linearGradient")).toBeNull();
    expect(container.querySelector('img[src*="kretopia-k-mark"]')).toBeNull();
    for (const button of container.querySelectorAll("button")) expect(button.className).toContain("text-foreground");
  });

  it("each action calls its own handler once", () => {
    const onDownload = vi.fn();
    const h = setup({ onDownload });
    fireEvent.click(screen.getByRole("button", { name: "Edit Passport" }));
    fireEvent.click(screen.getByRole("button", { name: "Share Passport" }));
    fireEvent.click(screen.getByRole("button", { name: "Show QR code" }));
    fireEvent.click(screen.getByRole("button", { name: "Download press kit PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onShare).toHaveBeenCalledTimes(1);
    expect(h.onShowQR).toHaveBeenCalledTimes(1);
    expect(h.onDownloadEPK).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("is disabled and says so while the PDF is being made", () => {
    const onDownload = vi.fn();
    setup({ onDownload, busy: true });
    const generating = screen.getByRole("button", { name: "Generating PDF" });
    expect(generating).toBeDisabled();
    fireEvent.click(generating);
    expect(onDownload).not.toHaveBeenCalled();
  });

  it("shows a crown, and says which plan, when the PDF needs one", () => {
    const { container } = render(<PassportSmartActions onEdit={() => {}} onShare={() => {}} onShowQR={() => {}} onDownloadEPK={() => {}} pdf={{ onDownload: () => {}, locked: true }} />);
    expect(screen.getByRole("button", { name: "Download PDF" })).toHaveAttribute("title", "Download PDF (Creator plan)");
    expect(container.querySelectorAll("button svg")).toHaveLength(6); // five icons and the crown
  });

  it("every target is at least 64 px tall", () => {
    setup({ onDownload: vi.fn() });
    for (const b of screen.getAllByRole("button")) expect(b.className).toContain("min-h-[64px]");
  });
});
