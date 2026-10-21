import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { canvasToBlob, downloadBlob, retroFileName, shareOrDownloadImage } from "../passport/retrospectiveExport";

const blob = new Blob(["png"], { type: "image/png" });
const setNav = (value: Partial<Navigator>) => Object.defineProperty(globalThis, "navigator", { value, configurable: true });
const realNavigator = globalThis.navigator;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  Object.defineProperty(globalThis, "navigator", { value: realNavigator, configurable: true });
  vi.restoreAllMocks();
});

describe("file name", () => {
  it("names the picture by year and card", () => expect(retroFileName(2026, "credits")).toBe("kretopia-2026-credits.png"));
});

describe("canvasToBlob", () => {
  const canvasWith = (result: Blob | null) => ({ toBlob: (cb: (b: Blob | null) => void, type?: string) => { expect(type).toBe("image/png"); cb(result); } }) as unknown as HTMLCanvasElement;

  it("returns the canvas as a PNG", async () => expect(await canvasToBlob(canvasWith(blob))).toBe(blob));
  it("refuses when the image could not be created", async () => {
    await expect(canvasToBlob(canvasWith(null))).rejects.toThrow("could not be created");
  });
});

describe("shareOrDownloadImage", () => {
  const meta = { title: "My year" };

  it("hands the file to the native share sheet when it can carry one", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    setNav({ share, canShare: () => true } as unknown as Navigator);
    expect(await shareOrDownloadImage(blob, "a.png", meta)).toBe("shared");
    expect(share.mock.calls[0][0]).toMatchObject({ title: "My year", files: [expect.any(File)] });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("saves the picture when the browser cannot share files", async () => {
    setNav({ share: vi.fn(), canShare: () => false } as unknown as Navigator);
    expect(await shareOrDownloadImage(blob, "a.png", meta)).toBe("downloaded");
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    setNav({} as Navigator);
    expect(await shareOrDownloadImage(blob, "a.png", meta)).toBe("downloaded");
  });

  it("does nothing more when the person closes the share sheet", async () => {
    setNav({ share: vi.fn(async () => { throw new DOMException("closed", "AbortError"); }), canShare: () => true } as unknown as Navigator);
    expect(await shareOrDownloadImage(blob, "a.png", meta)).toBe("cancelled");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("saves the picture when sharing fails for another reason", async () => {
    setNav({ share: vi.fn(async () => { throw new Error("denied"); }), canShare: () => true } as unknown as Navigator);
    expect(await shareOrDownloadImage(blob, "a.png", meta)).toBe("downloaded");
  });
});

describe("downloadBlob", () => {
  it("clicks a temporary link carrying the file name, then cleans up", () => {
    downloadBlob(blob, "kretopia-2026-cover.png");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
