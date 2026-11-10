import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPassUrl } from "@/lib/publicLink";

/**
 * The check-in desk after the pass QR became a link: a scanned or pasted pass link checks the guest in by the token inside it, and a bare
 * token (an older pass) still works. Only the database is stood in for.
 */
const m = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/integrations/supabase/client", () => {
  // Every query resolves to an empty list; realtime is a chain that does nothing.
  const query: unknown = new Proxy({}, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }) : () => query),
  });
  const channel: Record<string, unknown> = { on: () => channel, subscribe: () => channel };
  return { supabase: { from: () => query, rpc: (...args: unknown[]) => m.rpc(...args), channel: () => channel, removeChannel: () => undefined } };
});

import { EventCheckInDialog } from "../EventCheckInDialog";

const TOKEN = "255ec7525f6ed8a3c3b584859cad351e";
const EVENT_ID = "9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b";

const pasteAndGo = (value: string) => {
  render(<EventCheckInDialog eventId={EVENT_ID} eventTitle="Studio Night" open onOpenChange={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText("Paste check-in token..."), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
};

beforeEach(() => {
  m.rpc.mockReset().mockResolvedValue({ data: [{ success: true, guest_name: "Ari" }], error: null });
  m.toast.mockReset();
});

describe("EventCheckInDialog reads a pass link as well as a bare token", () => {
  it("a pass link checks the guest in by the token inside it", async () => {
    pasteAndGo(buildPassUrl(EVENT_ID, TOKEN));
    await waitFor(() => expect(m.rpc).toHaveBeenCalledWith("check_in_guest_by_token", { p_event_id: EVENT_ID, p_token: TOKEN }));
  });

  it("a bare token (a pass issued before the code carried a link) still checks in", async () => {
    pasteAndGo(`  ${TOKEN}  `);
    await waitFor(() => expect(m.rpc).toHaveBeenCalledWith("check_in_guest_by_token", { p_event_id: EVENT_ID, p_token: TOKEN }));
  });

  it("never sends the whole link as if it were the token", async () => {
    pasteAndGo(buildPassUrl(EVENT_ID, TOKEN));
    await waitFor(() => expect(m.rpc).toHaveBeenCalled());
    const checkIns = m.rpc.mock.calls.filter(([name]) => name === "check_in_guest_by_token");
    expect(checkIns.length).toBeGreaterThan(0);
    expect(checkIns.every(([, args]) => args.p_token === TOKEN)).toBe(true);
  });
});
