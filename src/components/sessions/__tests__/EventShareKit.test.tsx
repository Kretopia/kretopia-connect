import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPublicUrl } from "@/lib/publicLink";

/** The Event share kit: the code opens the public event page, and the share sheet gets that link plus a message, never an identifier. */
const qr = vi.hoisted(() => ({ options: [] as Array<Record<string, any>> }));
vi.mock("qr-code-styling", () => ({
  default: class {
    constructor(options: Record<string, unknown>) { qr.options.push(options); }
    append() {}
    download() {}
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), insert: async () => ({ error: null }) }) },
}));
vi.mock("@/lib/eventActions", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/eventActions")>()), logShareClick: vi.fn().mockResolvedValue(undefined) }));

import { EventShareKit } from "../EventShareKit";

const EVENT = { id: "9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b", title: "Studio Night", start_time: "2099-01-01T20:00:00Z", category: "music", venue_name: "Studio Nine" };
const share = vi.fn();
// How it is used: mounted closed, then opened.
const openKit = () => {
  const view = render(<EventShareKit event={EVENT} open={false} onOpenChange={() => {}} />);
  view.rerender(<EventShareKit event={EVENT} open onOpenChange={() => {}} />);
  return view;
};

beforeEach(() => {
  qr.options.length = 0;
  share.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
});
afterEach(() => { Reflect.deleteProperty(navigator, "share"); });

describe("EventShareKit", () => {
  it("makes a QR of the absolute public event link, with a quiet zone and error correction", async () => {
    openKit();
    await waitFor(() => expect(qr.options.length).toBeGreaterThan(0));
    const { data, margin, qrOptions } = qr.options[0];
    expect(data).toBe(`https://www.kretopia.com/share/event/${EVENT.id}/`);
    expect(isPublicUrl(data)).toBe(true);
    expect(margin).toBeGreaterThanOrEqual(16);
    expect(["Q", "H"]).toContain(qrOptions.errorCorrectionLevel);
  });

  it("the native share sheet gets the same link, and a message that is for people and does not repeat it", async () => {
    openKit();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [data] = share.mock.calls[0];
    expect(data.url).toBe(`https://www.kretopia.com/share/event/${EVENT.id}/`);
    expect(data.title).toBe("Studio Night");
    expect(data.text).toContain("Studio Night");
    expect(data.text).not.toContain(data.url);
    expect(data.text).not.toMatch(/^[0-9a-f-]{16,}$/i);
  });
});
