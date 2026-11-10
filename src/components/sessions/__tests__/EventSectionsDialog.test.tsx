import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ upsert: vi.fn(), toast: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ upsert: (...args: unknown[]) => m.upsert(...args) }) },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));

import { EventSectionsDialog } from "../EventSectionsDialog";
import { emptySections, type EventSections, type FetchedSections } from "@/lib/eventSections";

const stored = (): EventSections => {
  const s = emptySections();
  s.program = { visible: true, text: "19:00 Doors", faq: [], stored: true };
  s.venue = { visible: true, text: "Side entrance.", faq: [], stored: true };
  s.policies = { visible: true, text: "No refunds.", faq: [], stored: true };
  s.faq = { visible: true, text: "", faq: [{ question: "Parking?", answer: "Behind the venue." }], stored: true };
  return s;
};
const ready = (sections: EventSections = stored()): FetchedSections => ({ sections, available: true, loadFailed: false });

const draw = (loaded: FetchedSections = ready()) => {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(<EventSectionsDialog open onOpenChange={onOpenChange} eventId="e1" userId="host" loaded={loaded} onSaved={onSaved} />);
  return { onOpenChange, onSaved };
};

beforeEach(() => {
  m.upsert.mockReset().mockResolvedValue({ error: null });
  m.toast.mockReset();
});

describe("EventSectionsDialog", () => {
  it("shows the four sections with what the host wrote and a show/hide switch for each", () => {
    draw();
    const dialog = screen.getByRole("dialog", { name: "Edit page sections" });
    for (const label of ["Program / line-up", "Venue", "Policies", "FAQ"]) {
      expect(within(dialog).getByRole("group", { name: label })).toBeInTheDocument();
      expect(within(dialog).getByRole("switch", { name: `Show ${label} on the event page` })).toBeChecked();
    }
    expect(within(dialog).getByRole("textbox", { name: "Program / line-up" })).toHaveValue("19:00 Doors");
    expect(within(dialog).getByRole("textbox", { name: "FAQ question 1" })).toHaveValue("Parking?");
  });

  it("hiding a section keeps its words, and saving writes all four rows to the sections table with each one's flag", async () => {
    const { onSaved, onOpenChange } = draw();
    fireEvent.click(screen.getByRole("switch", { name: "Show Venue on the event page" }));
    expect(screen.getByRole("textbox", { name: "Venue" })).toHaveValue("Side entrance.");
    fireEvent.change(screen.getByRole("textbox", { name: "Program / line-up" }), { target: { value: "19:00 Doors\n20:00 Live set" } });
    fireEvent.click(screen.getByRole("button", { name: "Save sections" }));

    await waitFor(() => expect(m.upsert).toHaveBeenCalledTimes(1));
    const [rows, options] = m.upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "event_id,section" });
    const byKey = Object.fromEntries(rows.map((row: { section: string }) => [row.section, row]));
    expect(Object.keys(byKey).sort()).toEqual(["faq", "policies", "program", "venue"]);
    expect(byKey.venue).toMatchObject({ event_id: "e1", is_visible: false, content: { text: "Side entrance." }, updated_by: "host" });
    expect(byKey.program).toMatchObject({ is_visible: true, content: { text: "19:00 Doors\n20:00 Live set" } });
    expect(byKey.faq.content).toEqual({ items: [{ question: "Parking?", answer: "Behind the venue." }] });

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][0].venue).toMatchObject({ visible: false, text: "Side entrance.", stored: true });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Page sections saved" }));
  });

  it("adds and removes FAQ entries", () => {
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Add a question" }));
    expect(screen.getByRole("textbox", { name: "FAQ question 2" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Remove question 1" }));
    expect(screen.queryByRole("textbox", { name: "FAQ question 2" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "FAQ question 1" })).toHaveValue("");
  });

  it("says plainly that editing is not available yet, and cannot save, while the sections table does not exist", () => {
    draw({ sections: emptySections(), available: false, loadFailed: false });
    expect(screen.getByRole("status")).toHaveTextContent("Editing page sections isn't available yet");
    expect(screen.getByRole("button", { name: "Save sections" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Program / line-up" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save sections" }));
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("refuses to edit what it could not read, so a failed load cannot be saved over the host's words", () => {
    draw({ sections: emptySections(), available: true, loadFailed: true });
    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.getByRole("button", { name: "Save sections" })).toBeDisabled();
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and says why when the server refuses the save", async () => {
    m.upsert.mockResolvedValue({ error: { code: "42501", message: "new row violates row-level security policy" } });
    const { onSaved, onOpenChange } = draw();
    fireEvent.click(screen.getByRole("button", { name: "Save sections" }));
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Page sections not saved", description: "new row violates row-level security policy", variant: "destructive" })));
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("does not send text that is over the limit", async () => {
    const { onSaved } = draw();
    fireEvent.change(screen.getByRole("textbox", { name: "Policies" }), { target: { value: "p".repeat(4001) } });
    fireEvent.click(screen.getByRole("button", { name: "Save sections" }));
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Page sections not saved", variant: "destructive" })));
    expect(m.upsert).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("gives each section's title and hint the whole width on a phone, with the switch under them, and puts them side by side from sm", () => {
    draw();
    for (const label of ["Program / line-up", "Venue", "Policies", "FAQ"]) {
      const header = screen.getByRole("heading", { name: label }).parentElement!.parentElement as HTMLElement;
      expect(header).toHaveClass("flex-col", "sm:flex-row", "sm:justify-between");
      expect(header.querySelector('[role="switch"]')).not.toBeNull();
    }
  });
});
