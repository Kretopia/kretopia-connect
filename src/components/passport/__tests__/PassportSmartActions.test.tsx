import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PassportSmartActions } from "../PassportSmartActions";

const setup = (strength = 72) => {
  const h = { onEdit: vi.fn(), onShare: vi.fn(), onShowQR: vi.fn(), onDownloadEPK: vi.fn() };
  render(<PassportSmartActions strength={strength} {...h} />);
  return h;
};

describe("PassportSmartActions", () => {
  it("merges Strength and Edit into one tile, then Share, QR and the press kit on one line", () => {
    setup();
    const list = screen.getByRole("list", { name: "Passport actions" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    // one row: a four-column grid, no wrapping container
    expect(list.className).toContain("grid-cols-4");
  });

  it("keeps the accessible names the three actions always had", () => {
    setup();
    expect(screen.getByRole("button", { name: /^Edit Profile/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share Passport" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show QR code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download press kit PDF" })).toBeInTheDocument();
  });

  it("shows the Passport's real strength, and pressing it opens the editor (the way to raise it)", () => {
    const h = setup(72);
    const strength = screen.getByRole("button", { name: /Passport Strength 72%/ });
    expect(strength).toHaveTextContent("72%");
    fireEvent.click(strength);
    expect(h.onEdit).toHaveBeenCalledTimes(1);
  });

  it("clamps what it shows to 0-100", () => {
    setup(140);
    expect(screen.getByRole("button", { name: /Passport Strength 100%/ })).toBeInTheDocument();
  });

  it("each action calls its own handler once", () => {
    const h = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Edit Profile/ }));
    fireEvent.click(screen.getByRole("button", { name: "Share Passport" }));
    fireEvent.click(screen.getByRole("button", { name: "Show QR code" }));
    fireEvent.click(screen.getByRole("button", { name: "Download press kit PDF" }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onShare).toHaveBeenCalledTimes(1);
    expect(h.onShowQR).toHaveBeenCalledTimes(1);
    expect(h.onDownloadEPK).toHaveBeenCalledTimes(1);
  });

  it("every target is at least 44 px tall, and Kretopia's K sits uncovered in the strength tile", () => {
    setup();
    for (const b of screen.getAllByRole("button")) expect(b.className).toContain("min-h-[64px]");
    const ring = screen.getByRole("button", { name: /Passport Strength/ });
    expect(ring.querySelector('img[src*="kretopia-k-mark"]')).toBeInTheDocument();
    // no ring/loader drawn over the K: the only icon is the small edit badge
    expect(ring.querySelectorAll("svg")).toHaveLength(1);
  });
});
