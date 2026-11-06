import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({ tier: "pro", navigate: vi.fn(), generate: vi.fn(), track: vi.fn(), error: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: world.error, success: world.success } }));
vi.mock("react-router-dom", () => ({ useNavigate: () => world.navigate }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ subscriptionInfo: { tier: world.tier } }) }));
// Premium is not enforced in the real config yet (everyone has Pro-level access), so the plan check is stood in for here.
vi.mock("@/lib/subscriptionConfig", () => ({ hasProAccess: (tier: string) => tier !== "free" }));
vi.mock("@/lib/epkPdfGenerator", () => ({ generateEPKPdf: world.generate }));
vi.mock("@/lib/deckMetrics", () => ({ trackDeckEvent: world.track }));

import { useEpkPdfDownload } from "../useEpkPdfDownload";

const data = { profile: { full_name: "Dee Marshall" } };

describe("useEpkPdfDownload", () => {
  beforeEach(() => {
    world.tier = "pro";
    world.navigate.mockReset();
    world.generate.mockReset().mockResolvedValue(new Blob());
    world.track.mockReset();
    world.error.mockReset();
    world.success.mockReset();
  });

  it("asks for the Creator plan, and offers the way to it, when the plan does not include the PDF", async () => {
    world.tier = "free";
    const { result } = renderHook(() => useEpkPdfDownload("u1", data));
    expect(result.current.isPro).toBe(false);
    await act(async () => { await result.current.download(); });
    expect(world.generate).not.toHaveBeenCalled();
    expect(world.error).toHaveBeenCalledWith("Creator plan required", expect.objectContaining({ action: expect.objectContaining({ label: "Upgrade" }) }));
    world.error.mock.calls[0][1].action.onClick();
    expect(world.navigate).toHaveBeenCalledWith("/subscription");
  });

  it("says so, and makes nothing, when the Passport's data is not there yet", async () => {
    const { result } = renderHook(() => useEpkPdfDownload("u1", null));
    await act(async () => { await result.current.download(); });
    expect(world.generate).not.toHaveBeenCalled();
    expect(world.error).toHaveBeenCalledWith("Profile data not ready. Please try again.");
  });

  it("makes the PDF from the data, counts the download, confirms it, and is busy only while it works", async () => {
    let finish: (blob: Blob) => void = () => undefined;
    world.generate.mockImplementation(() => new Promise<Blob>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useEpkPdfDownload("u1", data));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.download(); });
    await waitFor(() => expect(result.current.generating).toBe(true));
    expect(world.generate).toHaveBeenCalledWith(data);
    await act(async () => { finish(new Blob()); await pending; });
    expect(result.current.generating).toBe(false);
    expect(world.track).toHaveBeenCalledWith("epk_pdf_downloaded", "passport", { profile_user_id: "u1" });
    expect(world.success).toHaveBeenCalledWith("EPK PDF downloaded!");
    expect(world.error).not.toHaveBeenCalled();
  });

  it("reports a failure, counts nothing, and is not left busy", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    world.generate.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useEpkPdfDownload("u1", data));
    await act(async () => { await result.current.download(); });
    expect(world.error).toHaveBeenCalledWith("Failed to generate PDF. Please try again.");
    expect(world.track).not.toHaveBeenCalled();
    expect(world.success).not.toHaveBeenCalled();
    expect(result.current.generating).toBe(false);
    quiet.mockRestore();
  });
});
