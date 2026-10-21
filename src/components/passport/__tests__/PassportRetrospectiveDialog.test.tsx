import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  inputs: vi.fn(),
  earliest: vi.fn(),
  toBlob: vi.fn(),
  draw: vi.fn(),
  download: vi.fn(),
  share: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  qrAuto: true,
  qrCallbacks: [] as Array<() => void>,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }));
vi.mock("@/lib/passport/retrospectiveData", () => ({ loadRetrospectiveInputs: m.inputs, loadEarliestActivity: m.earliest }));
vi.mock("@/lib/passport/retrospectiveExport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/passport/retrospectiveExport")>()),
  canvasToBlob: m.toBlob,
  downloadBlob: m.download,
  shareOrDownloadImage: m.share,
}));
vi.mock("@/lib/passport/retrospectiveCanvas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/passport/retrospectiveCanvas")>()),
  drawRetrospectiveCard: m.draw,
}));
vi.mock("@/components/brand/KretopiaLoader", () => ({ KretopiaLoader: () => <span role="progressbar" aria-label="Loading" /> }));
vi.mock("@/components/brand/KretopiaQRCode", () => ({
  KretopiaQRCode: ({ data, onReady }: { data: string; onReady?: (blob: Blob | null) => void }) => {
    if (onReady) { const ready = () => onReady(new Blob(["qr"])); if (m.qrAuto) queueMicrotask(ready); else m.qrCallbacks.push(ready); }
    return <div data-testid="qr" data-value={data} />;
  },
}));
// Radix Select needs pointer APIs jsdom lacks; a native select exposes the same value/onChange contract.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select aria-label="Year" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));

import { PassportRetrospectiveDialog } from "../PassportRetrospectiveDialog";

// jsdom has no 2D canvas and loads no images: a context object and an Image that "loads" at once stand in for them.
const fakeContext = {} as CanvasRenderingContext2D;
class InstantImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = "";
  set src(_value: string) { queueMicrotask(() => this.onload?.()); }
}

const THIS_YEAR = new Date().getUTCFullYear();
const dated = (month: number) => `${THIS_YEAR}-${String(month).padStart(2, "0")}-10T10:00:00Z`;
const ACTIVE = {
  credits: [
    { created_at: dated(2), source: "manual", verification_status: "verified" },
    { created_at: dated(3), source: "manual" },
    { created_at: dated(4), source: "portfolio", media_type: "video" },
  ],
  received: [{ responded_at: dated(5) }],
  given: [],
  truncated: false,
};
const EMPTY = { credits: [], received: [], given: [], truncated: false };

const cardImage = () => screen.getByRole("img", { name: /./ });
const view = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PassportRetrospectiveDialog open onOpenChange={vi.fn()} userId="user-1" name="Maya Laurent" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const preview = () => within(screen.getByRole("group", { name: "Year cards" }));
// The card region exists only once the data has loaded; the card's words are its accessible name.
const ready = async () => { await screen.findByRole("group", { name: "Year cards" }); await preview().findByRole("img", { name: new RegExp(`${THIS_YEAR} so far`) }); };
const label = () => cardImage().getAttribute("aria-label") ?? "";
const blob = new Blob(["png"]);

beforeEach(() => {
  Object.values(m).forEach((v) => typeof v === "function" && "mockReset" in v && (v as ReturnType<typeof vi.fn>).mockReset());
  m.qrAuto = true;
  m.qrCallbacks = [];
  m.earliest.mockResolvedValue(`${THIS_YEAR - 1}-06-01T00:00:00Z`);
  m.inputs.mockResolvedValue(ACTIVE);
  m.toBlob.mockResolvedValue(blob);
  vi.stubGlobal("Image", InstantImage);
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeContext as never);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Your year on Kretopia", () => {
  it("shows a loader, then the cover card for the current year as 'so far'", async () => {
    view();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    await ready();
    expect(label()).toBe(`Your year on Kretopia. ${THIS_YEAR} so far. Maya Laurent`);
    expect(screen.getByText("Card 1 of 5")).toBeTruthy();
    expect(m.draw).toHaveBeenCalledWith(fakeContext, expect.objectContaining({ kind: "cover", headline: `${THIS_YEAR} so far` }), expect.objectContaining({ assets: expect.any(Object) }));
    expect(m.inputs).toHaveBeenCalledWith(expect.anything(), "user-1", THIS_YEAR);
  });

  it("flips through the real cards with the buttons or the arrow keys, and stops at both ends", async () => {
    view();
    await ready();
    expect(screen.getByRole("button", { name: "Previous card" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(label()).toBe(`${THIS_YEAR} so far. 2. credits added to your Passport. 1 of them verified or co-signed`);
    fireEvent.keyDown(screen.getByRole("group", { name: "Year cards" }), { key: "ArrowRight" });
    expect(label()).toContain("co-sign received");
    fireEvent.keyDown(screen.getByRole("group", { name: "Year cards" }), { key: "ArrowLeft" });
    expect(label()).toContain("credits added to your Passport");
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByRole("button", { name: "Next card" })).toBeDisabled();
    expect(screen.getByText("Card 5 of 5")).toBeTruthy();
  });

  it("says plainly when there is nothing to show, and offers no picture to make", async () => {
    m.inputs.mockResolvedValue(EMPTY);
    view();
    expect(await screen.findByText(`Nothing to show for ${THIS_YEAR} yet.`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Download image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    expect(screen.getByRole("link", { name: "Add a credit" }).getAttribute("href")).toBe("/credits");
  });

  it("offers a retry when the activity cannot be loaded", async () => {
    m.inputs.mockRejectedValueOnce(new Error("network")).mockResolvedValue(ACTIVE);
    view();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Couldn't load your activity for ${THIS_YEAR}.`);
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await ready();
    expect(label()).toContain(`${THIS_YEAR} so far`);
    expect(m.inputs).toHaveBeenCalledTimes(2);
  });

  it("loads the chosen year and words an empty past year without 'yet'", async () => {
    view();
    await ready();
    m.inputs.mockResolvedValue(EMPTY);
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: String(THIS_YEAR - 1) } });
    expect(await screen.findByText(`Nothing to show for ${THIS_YEAR - 1}.`)).toBeTruthy();
    expect(m.inputs).toHaveBeenLastCalledWith(expect.anything(), "user-1", THIS_YEAR - 1);
  });

  it("notes a very large history instead of silently counting short", async () => {
    m.inputs.mockResolvedValue({ ...ACTIVE, truncated: true });
    view();
    expect(await screen.findByText(/counts may be slightly short/)).toBeTruthy();
  });
});

describe("making the picture", () => {
  it("downloads the card on screen, drawn from the real-size copy, under a clear file name", async () => {
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Download image" }));
    await waitFor(() => expect(m.download).toHaveBeenCalledOnce());
    // the picture is the very canvas that is on screen, at the Story size
    const canvas = m.toBlob.mock.calls[0][0] as HTMLCanvasElement;
    expect(canvas).toBe(cardImage());
    expect([canvas.width, canvas.height]).toEqual([1080, 1920]);
    expect(m.download).toHaveBeenCalledWith(blob, `kretopia-${THIS_YEAR}-cover.png`);
    expect(m.success).toHaveBeenCalledWith(expect.stringMatching(/saved/i));
  });

  it("shares through the device, and says so only when the picture was saved instead", async () => {
    view();
    await ready();
    m.share.mockResolvedValueOnce("shared");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(m.share).toHaveBeenCalledOnce());
    expect(m.share).toHaveBeenCalledWith(blob, `kretopia-${THIS_YEAR}-cover.png`, { title: `My ${THIS_YEAR} on Kretopia` });
    expect(m.success).not.toHaveBeenCalled();

    m.share.mockResolvedValueOnce("downloaded");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(m.success).toHaveBeenCalledOnce());
  });

  it("reports a failure to draw and lets the person try again", async () => {
    m.toBlob.mockRejectedValueOnce(new Error("canvas"));
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Download image" }));
    await waitFor(() => expect(m.error).toHaveBeenCalledOnce());
    expect(m.download).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Download image" })).toBeEnabled());
  });

  it("waits for the Passport QR before the closing card can be saved or shared", async () => {
    m.qrAuto = false;
    view();
    await ready();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(label()).toContain("See the work behind the numbers");
    expect(screen.getByTestId("qr").getAttribute("data-value")).toContain("/epk/user-1");
    expect(screen.getByRole("button", { name: "Download image" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    act(() => m.qrCallbacks.forEach((cb) => cb()));
    await waitFor(() => expect(screen.getByRole("button", { name: "Download image" })).toBeEnabled());
    // once the QR bitmap exists it is part of the drawing
    await waitFor(() => expect(m.draw).toHaveBeenLastCalledWith(fakeContext, expect.objectContaining({ kind: "closing" }), expect.objectContaining({ assets: expect.objectContaining({ qr: expect.any(InstantImage) }) })));
  });

  it("does not put a QR into any card but the closing one", async () => {
    view();
    await ready();
    expect(screen.queryByTestId("qr")).toBeNull();
    expect(m.draw).toHaveBeenLastCalledWith(fakeContext, expect.objectContaining({ kind: "cover" }), expect.objectContaining({ assets: expect.objectContaining({ qr: null }) }));
  });

  it("can still save the closing card, without the code, if the QR cannot be drawn", async () => {
    m.qrAuto = false;
    view();
    await ready();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByRole("button", { name: "Download image" })).toBeDisabled();
    // the QR library reports failure with a null bitmap
    vi.stubGlobal("Image", class { onload: (() => void) | null = null; onerror: (() => void) | null = null; crossOrigin = ""; set src(_v: string) { queueMicrotask(() => this.onerror?.()); } });
    act(() => m.qrCallbacks.forEach((cb) => cb()));
    await waitFor(() => expect(screen.getByRole("button", { name: "Download image" })).toBeEnabled());
  });
});
