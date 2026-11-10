import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The shared branded QR: it draws a link, and leaves itself empty for anything that is not one. */
const qr = vi.hoisted(() => ({ options: [] as Array<Record<string, any>> }));
vi.mock("qr-code-styling", () => ({
  default: class {
    constructor(options: Record<string, unknown>) { qr.options.push(options); }
    append() {}
    async getRawData() { return new Blob(["png"]); }
  },
}));

import { KretopiaQRCode } from "../KretopiaQRCode";

beforeEach(() => {
  qr.options.length = 0;
  vi.stubGlobal("Image", class { onload: (() => void) | null = null; onerror: (() => void) | null = null; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
});
afterEach(() => vi.unstubAllGlobals());

describe("KretopiaQRCode", () => {
  it("draws a public https link", async () => {
    render_(`https://www.kretopia.com/profile/9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b`);
    await waitFor(() => expect(qr.options.length).toBeGreaterThan(0));
    expect(qr.options[0].data).toBe("https://www.kretopia.com/profile/9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b");
  });

  it("draws nothing for a bare token, uuid or hash, and says so through onReady(null)", async () => {
    for (const bare of ["255ec7525f6ed8a3c3b584859cad351e", "9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b", "ABC123"]) {
      const onReady = vi.fn();
      render_(bare, onReady);
      await waitFor(() => expect(onReady).toHaveBeenCalledWith(null));
    }
    expect(qr.options).toHaveLength(0);
  });

  it("draws nothing for a path, http, a host a stranger cannot reach, or an unsafe scheme", async () => {
    for (const bad of ["/profile/abc", "http://www.kretopia.com/profile/abc", "https://localhost:5173/profile/abc", "javascript:alert(1)"]) {
      const onReady = vi.fn();
      render_(bad, onReady);
      await waitFor(() => expect(onReady).toHaveBeenCalledWith(null));
    }
    expect(qr.options).toHaveLength(0);
  });
});

function render_(data: string, onReady?: (blob: Blob | null) => void) {
  return render(<KretopiaQRCode data={data} size={128} onReady={onReady} />);
}
