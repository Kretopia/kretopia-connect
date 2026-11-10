import { render, waitFor, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPassUrl, isPublicUrl } from "@/lib/publicLink";

/**
 * The Event pass QR. It used to encode the check-in token alone, so a phone that scanned it offered "255ec752…" to copy and send. It encodes
 * the pass's public link now. Only the QR library is stood in for: its options are what the code is made from.
 */
const qr = vi.hoisted(() => ({ options: [] as Array<Record<string, any>> }));
vi.mock("qr-code-styling", () => ({
  default: class {
    constructor(options: Record<string, unknown>) { qr.options.push(options); }
    append() {}
    download() {}
  },
}));
vi.mock("@/components/BrandLogo", () => ({ BrandLogo: () => null }));

import { EventPassCard } from "../EventPassCard";

const TOKEN = "255ec7525f6ed8a3c3b584859cad351e";
const EVENT_ID = "9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b";
const props = { eventId: EVENT_ID, eventTitle: "Studio Night", startTime: "2099-01-01T20:00:00Z", token: TOKEN, loading: false };

// Byte-mode capacity at error-correction level Q, versions 1 to 14 (a version has 17 + 4v modules a side).
const CAPACITY_Q = [11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258];
const modulesFor = (bytes: number) => 17 + 4 * (CAPACITY_Q.findIndex((capacity) => capacity >= bytes) + 1);

beforeEach(() => {
  qr.options.length = 0;
  document.documentElement.style.setProperty("--foreground", "0 0% 10%");
  document.documentElement.style.setProperty("--background", "0 0% 100%");
  // The logo is a branding touch: let it "load" so the code is drawn with it, the harder case.
  vi.stubGlobal("Image", class { onload: (() => void) | null = null; onerror: (() => void) | null = null; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
});
afterEach(() => vi.unstubAllGlobals());

describe("EventPassCard: the QR carries a link, never the bare token", () => {
  it("encodes the absolute public pass URL, and not the token alone", async () => {
    render(<EventPassCard {...props} />);
    await waitFor(() => expect(qr.options.length).toBeGreaterThan(0));
    const data = qr.options[0].data as string;
    expect(data).toBe(buildPassUrl(EVENT_ID, TOKEN));
    expect(data).toMatch(/^https:\/\/www\.kretopia\.com\/event\/[^/]+\/pass\?token=/);
    expect(isPublicUrl(data)).toBe(true);
    expect(data).not.toBe(TOKEN);
    expect(qr.options.every((o) => o.data !== TOKEN)).toBe(true);
  });

  it("is made to be read from a screen: error correction Q or better, a quiet zone of about four modules, modules not too small", async () => {
    render(<EventPassCard {...props} />);
    await waitFor(() => expect(qr.options.length).toBeGreaterThan(0));
    const { data, width, margin, qrOptions } = qr.options[0] as { data: string; width: number; margin: number; qrOptions: { errorCorrectionLevel: string } };
    expect(["Q", "H"]).toContain(qrOptions.errorCorrectionLevel);
    const modules = modulesFor(new TextEncoder().encode(data).length);
    const pixelsPerModule = (width - 2 * margin) / modules;
    const whitePad = 12; // the card draws the code on a white p-3 square
    expect(pixelsPerModule).toBeGreaterThanOrEqual(3.5);
    expect((margin + whitePad) / pixelsPerModule).toBeGreaterThanOrEqual(4);
    expect(qr.options[0].backgroundOptions.color).toBe("#ffffff");
  });

  it("draws no code when there is no token, or when it is not known which event the pass is for", async () => {
    const { rerender } = render(<EventPassCard {...props} token={null} />);
    rerender(<EventPassCard {...props} eventId="" />);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(qr.options).toHaveLength(0);
  });

  it("labels the code for assistive technology", () => {
    render(<EventPassCard {...props} />);
    expect(screen.getByRole("img", { name: /pass qr code/i })).toBeInTheDocument();
  });
});
