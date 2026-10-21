// Getting the retrospective picture to the person. Kretopia does not publish to Instagram or any network: the card is
// drawn to a 1080 x 1920 PNG (the vertical Story format, see retrospectiveCanvas.ts), offered to the device's own
// share sheet when that can carry a file, and otherwise saved so it can be posted from the gallery.

export const retroFileName = (year: number, kind: string): string => `kretopia-${year}-${kind}.png`;

/** The canvas as a PNG. */
export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The image could not be created");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Native share with the image attached when the browser supports sharing files; the picture is saved instead when it
 * does not, or when sharing fails for any reason other than the person closing the sheet.
 */
export async function shareOrDownloadImage(blob: Blob, filename: string, meta: { title: string; text?: string }): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator !== "undefined" && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: meta.title, text: meta.text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
