import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PassportShareSheet } from "../PassportShareSheet";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ toast }));
// qr-code-styling needs a canvas, which jsdom does not have: the mock keeps the payload visible to the test.
vi.mock("../PassportRetrospectiveDialog", () => ({
  PassportRetrospectiveDialog: ({ userId, name }: { userId: string; name: string }) => <div data-testid="retro-dialog" data-user={userId} data-name={name} />,
}));
vi.mock("@/components/brand/KretopiaQRCode", () => ({
  KretopiaQRCode: ({ data }: { data: string }) => <div data-testid="kretopia-qr" data-value={data} />,
}));

const USER = "00000000-0000-4000-8000-000000000000";
const profile = { full_name: "Ana Lopez", role: "Photographer" };

const open = (canPublishSite = true) => render(<PassportShareSheet userId={USER} profile={profile} canPublishSite={canPublishSite} defaultOpen />);
const card = (label: string) => within(screen.getByRole("heading", { name: label }).closest("section") as HTMLElement);

beforeEach(() => {
  toast.mockClear();
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
});
afterEach(cleanup);

describe("Passport share sheet", () => {
  it("gives every target a labelled Share and Copy link, never icon-only controls in the first row", () => {
    open();
    for (const label of ["EPK / Media kit", "Personal website", "Passport profile"]) {
      const target = card(label);
      expect(target.getByRole("button", { name: `Share ${label}` })).toHaveTextContent("Share");
      expect(target.getByRole("button", { name: `Copy link to ${label}` })).toHaveTextContent("Copy link");
    }
  });

  // Regression: the EPK and the website both wore the same globe, in a row of eight unlabelled 32 px icons.
  it("tells the EPK and the website apart with different glyphs", () => {
    open();
    const glyph = (label: string) => screen.getByRole("heading", { name: label }).closest("section")!.querySelector("svg.lucide")!.getAttribute("class");
    expect(glyph("EPK / Media kit")).toContain("lucide-file-text");
    expect(glyph("Personal website")).toContain("lucide-globe");
  });

  it("keeps the other channels one disclosure away, labelled, with the right links", () => {
    open();
    const epk = card("EPK / Media kit");
    expect(epk.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    fireEvent.click(epk.getByRole("button", { name: "More ways to share" }));

    expect(epk.getByRole("link", { name: "Share EPK / Media kit on WhatsApp" })).toHaveTextContent("WhatsApp");
    expect(epk.getByRole("link", { name: "Share EPK / Media kit on WhatsApp" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(epk.getByRole("link", { name: "Share EPK / Media kit on LinkedIn" }).getAttribute("href")).toContain("linkedin.com/sharing/share-offsite");
    expect(epk.getByRole("link", { name: "Share EPK / Media kit on X" })).toHaveTextContent("X");
    expect(epk.getByRole("link", { name: "Share EPK / Media kit by email" }).getAttribute("href")).toMatch(/^mailto:/);
    expect(epk.getByRole("button", { name: "Copy link for Instagram: EPK / Media kit" })).toHaveTextContent("Instagram");
    expect(epk.getByRole("button", { name: "Show QR code for EPK / Media kit" })).toHaveTextContent("QR code");
  });

  it("copies the target's public link and says so", async () => {
    open();
    const epk = card("EPK / Media kit");
    fireEvent.click(epk.getByRole("button", { name: "Copy link to EPK / Media kit" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledOnce());
    expect((navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(USER);
    await waitFor(() => expect(epk.getByRole("button", { name: "Copy link to EPK / Media kit" })).toHaveTextContent("Copied"));
  });

  it("shows the Kretopia QR for the chosen target only, and can hide it", () => {
    open();
    const epk = card("EPK / Media kit");
    fireEvent.click(epk.getByRole("button", { name: "More ways to share" }));
    fireEvent.click(epk.getByRole("button", { name: "Show QR code for EPK / Media kit" }));
    const qr = screen.getByTestId("kretopia-qr");
    expect(qr.getAttribute("data-value")).toContain(USER);
    expect(screen.getAllByTestId("kretopia-qr")).toHaveLength(1);
    expect(epk.getByRole("img", { name: "QR code for EPK / Media kit" })).toBeTruthy();
    fireEvent.click(epk.getByRole("button", { name: "Hide QR code for EPK / Media kit" }));
    expect(screen.queryByTestId("kretopia-qr")).toBeNull();
  });

  it("offers 'Your year on Kretopia' first, and opens it for this person after closing the sheet", () => {
    const onOpenChange = vi.fn();
    render(<PassportShareSheet userId={USER} profile={profile} canPublishSite defaultOpen onOpenChange={onOpenChange} />);
    const year = within(screen.getByRole("heading", { name: "Your year on Kretopia" }).closest("section") as HTMLElement);
    expect(screen.queryByTestId("retro-dialog")).toBeNull();
    fireEvent.click(year.getByRole("button", { name: "Create image" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("retro-dialog")).toHaveAttribute("data-user", USER);
    expect(screen.getByTestId("retro-dialog")).toHaveAttribute("data-name", "Ana Lopez");
  });

  it("offers an upgrade, not share controls, for a paid target without a paid plan", () => {
    open(false);
    const site = card("Personal website");
    expect(site.getByRole("link", { name: "Upgrade to publish" }).getAttribute("href")).toBe("/subscription");
    expect(site.queryByRole("button", { name: /Share Personal website|Copy link/ })).toBeNull();
    expect(card("EPK / Media kit").getByRole("button", { name: "Copy link to EPK / Media kit" })).toBeTruthy();
  });
});
