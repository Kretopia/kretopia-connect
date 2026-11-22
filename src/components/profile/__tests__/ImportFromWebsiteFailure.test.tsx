import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** A failed import stays on screen with what it means, keeps the link, and offers the manual path; it never claims success. */
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const tracked = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/analytics", () => ({ analytics: { importFailed: (c: string) => tracked.push(c) } }));
const invoke = vi.hoisted(() => ({ fn: null as unknown as () => Promise<unknown> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: () => invoke.fn() } } }));

import { ImportFromWebsiteDialog } from "../ImportFromWebsiteDialog";

const setup = (onAddManually = vi.fn(), onOpenChange = vi.fn()) => {
  render(<ImportFromWebsiteDialog open onOpenChange={onOpenChange} onImport={vi.fn()} onAddManually={onAddManually} />);
  fireEvent.change(screen.getByLabelText("Website URL"), { target: { value: "https://ethan.example/work" } });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
  return { onAddManually, onOpenChange };
};

beforeEach(() => { toast.mockReset(); tracked.length = 0; });

describe("website import failures", () => {
  it("Safari's 'Load failed' becomes a dropped-connection message; the link stays; no success toast", async () => {
    invoke.fn = async () => ({ data: null, error: new TypeError("Load failed") });
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("The connection dropped before the import finished. Your link is kept");
    expect(screen.queryByText(/Load failed/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Website URL")).toHaveValue("https://ethan.example/work");
    expect(toast).not.toHaveBeenCalled();
    expect(tracked).toEqual(["network"]);
  });

  it("a timeout offers the manual path, which closes the import and opens Add credit", async () => {
    invoke.fn = async () => ({ data: { success: false, code: "timeout", error: "x" }, error: null });
    const { onAddManually, onOpenChange } = setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(/took too long/);
    fireEvent.click(screen.getByRole("button", { name: "Add work manually" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAddManually).toHaveBeenCalledTimes(1);
  });
});
