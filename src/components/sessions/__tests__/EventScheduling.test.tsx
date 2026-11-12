import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn(), row: {} as Record<string, unknown> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "organizer" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => {
    let writing = false;
    const chain = {
      select: () => chain, eq: () => chain,
      update: (row: unknown) => { writing = true; m.save(row); return chain; },
      insert: (row: unknown) => { writing = true; m.save(row); return chain; },
      single: () => Promise.resolve({ data: writing ? { id: "saved-event" } : m.row, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return chain;
  } },
}));
vi.mock("../EventCoverPicker", () => ({ EventCoverPicker: () => null }));
vi.mock("../LocationSearchInput", () => ({ LocationSearchInput: () => null }));
vi.mock("../EventModeFormatPicker", () => ({ EventModeFormatPicker: () => null }));
vi.mock("../PayoutsConnectWarning", () => ({ PayoutsConnectWarning: () => null }));
vi.mock("../ScanFlyerDialog", () => ({ ScanFlyerDialog: () => null }));
vi.mock("../EventArchetypePicker", () => ({ EventArchetypePicker: () => null }));

import { CreateSessionDialog } from "../CreateSessionDialog";
import { EditEventDialog } from "../EditEventDialog";

beforeEach(() => {
  m.save.mockReset(); m.toast.mockReset();
  m.row = { id: "event", created_by: "organizer", title: "Bali gathering", category: "general", start_time: "2026-11-12T10:00:00.000Z", end_time: "2026-11-12T12:00:00.000Z", timezone: "Asia/Makassar" };
});

describe("event editor UTC persistence", () => {
  it("creates 6 PM Bali as 10 AM UTC using the selected browser-default zone", async () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions");
    const original = new Intl.DateTimeFormat().resolvedOptions();
    spy.mockReturnValue({ ...original, timeZone: "Asia/Makassar" });
    render(<MemoryRouter><CreateSessionDialog open onOpenChange={vi.fn()} initialDetails={{ title: "Bali gathering", start_date: "2026-11-12", start_time: "18:00" }} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText("Time *")).toHaveValue("18:00"));
    fireEvent.change(screen.getByLabelText("End date and time (optional)"), { target: { value: "2026-11-12T20:00" } });
    fireEvent.submit(screen.getByLabelText("Title *").closest("form") as HTMLFormElement);
    await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ start_time: "2026-11-12T10:00:00.000Z", end_time: "2026-11-12T12:00:00.000Z", timezone: "Asia/Makassar" })));
    spy.mockRestore();
  });
  it("reads back local time and preserves original UTC values when editing", async () => {
    render(<EditEventDialog open eventId="event" onOpenChange={vi.fn()} />);
    await screen.findByRole("button", { name: "Save Changes" });
    const time = document.querySelector<HTMLInputElement>('input[type="time"]');
    expect(time?.value).toBe("18:00");
    expect(screen.getByLabelText("End date and time (optional)")).toHaveValue("2026-11-12T20:00");
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ start_time: "2026-11-12T10:00:00.000Z", end_time: "2026-11-12T12:00:00.000Z", timezone: "Asia/Makassar" })));
  });
  it("does not overwrite legacy timestamps or missing timezone on an unchanged schedule", async () => {
    m.row = { ...m.row, start_time: "2026-11-12T10:00:35Z", end_time: null, timezone: null };
    render(<EditEventDialog open eventId="event" onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ start_time: "2026-11-12T10:00:35Z", end_time: null, timezone: null })));
  });
});