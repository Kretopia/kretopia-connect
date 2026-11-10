import { useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Only the database is stood in for: a table-aware query builder that records what each read asked for. */
const db = vi.hoisted(() => ({
  participants: [] as Record<string, unknown>[],
  profiles: [] as Record<string, unknown>[],
  participantsError: null as { message: string } | null,
  profilesError: null as { message: string } | null,
  selects: [] as { table: string; columns: string }[],
  filters: [] as { table: string; op: string; args: unknown[] }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: (columns: string) => { db.selects.push({ table, columns }); return chain; },
        eq: (...args: unknown[]) => { db.filters.push({ table, op: "eq", args }); return chain; },
        in: (...args: unknown[]) => { db.filters.push({ table, op: "in", args }); return chain; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(
            table === "jam_participants"
              ? { data: db.participantsError ? null : db.participants, error: db.participantsError }
              : { data: db.profilesError ? null : db.profiles, error: db.profilesError },
          ).then(resolve, reject),
      };
      return chain;
    },
  },
}));

import { EventParticipantsDialog } from "../EventParticipantsDialog";

const row = (id: string, userId: string | null, extra: Record<string, unknown> = {}) => ({ id, user_id: userId, guest_name: null, joined_at: `2026-11-0${id}T10:00:00Z`, ...extra });
const profile = (userId: string, name: string, role: string | null = null, avatar: string | null = null) => ({ user_id: userId, full_name: name, avatar_url: avatar, role });

function Harness({ canSee = true, startOpen = true }: { canSee?: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>Open list</button>
      <EventParticipantsDialog open={open} onOpenChange={setOpen} eventId="e1" canSee={canSee} returnFocusRef={trigger} />
    </>
  );
}

const draw = (props: { canSee?: boolean; startOpen?: boolean } = {}) =>
  render(
    <MemoryRouter initialEntries={["/event/e1"]}>
      <Routes>
        <Route path="/event/:eventId" element={<Harness {...props} />} />
        <Route path="/epk/:userId" element={<p>Public Passport page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  db.participants = [];
  db.profiles = [];
  db.participantsError = null;
  db.profilesError = null;
  db.selects.length = 0;
  db.filters.length = 0;
});

describe("EventParticipantsDialog: who is going, as a list of public Passports", () => {
  it("lists every participant with avatar, name and role, each row a link to that member's PUBLIC Passport", async () => {
    db.participants = [row("1", "u1"), row("2", "u2")];
    db.profiles = [profile("u1", "Ari Stone", "Producer", "https://img.example.com/a.jpg"), profile("u2", "Bea Moon", "Director")];
    draw();

    const list = await screen.findByRole("list", { name: "Who's going" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Ari Stone");
    expect(rows[0]).toHaveTextContent("Producer");
    expect(rows[0]).toHaveTextContent("View Passport");
    const link = within(rows[0]).getByRole("link", { name: /Ari Stone/ });
    // The public Passport address, never an owner-only page.
    expect(link).toHaveAttribute("href", "/epk/u1");
    expect(within(rows[1]).getByRole("link")).toHaveAttribute("href", "/epk/u2");
  });

  it("opens the Passport and closes the list when a row is pressed", async () => {
    db.participants = [row("1", "u1")];
    db.profiles = [profile("u1", "Ari Stone", "Producer")];
    draw();

    fireEvent.click(await screen.findByRole("link", { name: /Ari Stone/ }));
    expect(await screen.findByText("Public Passport page")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reads only what a visitor may see: no email, phone or owner-only column is ever selected", async () => {
    db.participants = [row("1", "u1")];
    db.profiles = [profile("u1", "Ari Stone")];
    draw();
    await screen.findByRole("list", { name: "Who's going" });

    expect(db.selects).toEqual([
      { table: "jam_participants", columns: "id, user_id, guest_name, joined_at" },
      { table: "public_profiles_safe", columns: "user_id, full_name, avatar_url, role" },
    ]);
    expect(db.selects.map((select) => select.columns).join(" ")).not.toMatch(/email|phone|token|username/i);
    // Only people who are going, for this event.
    expect(db.filters.filter((f) => f.table === "jam_participants")).toEqual([
      { table: "jam_participants", op: "eq", args: ["jam_id", "e1"] },
      { table: "jam_participants", op: "eq", args: ["status", "going"] },
    ]);
  });

  it("hides a member whose profile the public view does not return, and shows a guest RSVP with no link", async () => {
    db.participants = [row("1", "u1"), row("2", "private-member"), row("3", null, { guest_name: "Cleo Guest", guest_email: "cleo@example.com" })];
    db.profiles = [profile("u1", "Ari Stone", "Producer")];
    draw();

    const list = await screen.findByRole("list", { name: "Who's going" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).queryByText(/private-member/)).not.toBeInTheDocument();
    const guest = within(list).getByText("Cleo Guest").closest("li")!;
    expect(guest).toHaveTextContent("Guest RSVP");
    expect(within(guest).queryByRole("link")).not.toBeInTheDocument();
    // The guest's email is not on the page, even though the row carried it.
    expect(document.body.textContent).not.toContain("cleo@example.com");
  });

  it("lists a member once even if they have two rows", async () => {
    db.participants = [row("1", "u1"), row("2", "u1")];
    db.profiles = [profile("u1", "Ari Stone")];
    draw();
    expect(within(await screen.findByRole("list", { name: "Who's going" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("when the host keeps the list private it reads nothing and says so", async () => {
    db.participants = [row("1", "u1")];
    db.profiles = [profile("u1", "Ari Stone")];
    draw({ canSee: false });

    expect(await screen.findByText(/keeps the guest list private/)).toBeInTheDocument();
    expect(db.selects).toEqual([]);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("says when there is nobody to show", async () => {
    draw();
    expect(await screen.findByText("No one to show yet.")).toBeInTheDocument();
  });

  it("shows a spinner while it loads, never a bare 'Loading…'", async () => {
    draw();
    expect(screen.getByRole("status")).toHaveTextContent("Loading who's going");
    expect(screen.getByRole("status").querySelector("svg, img, [class*='spinner' i], [data-kretopia-spinner]")).not.toBeNull();
    await screen.findByText("No one to show yet.");
  });

  it("says it could not load, and Try again reads the list again", async () => {
    db.participantsError = { message: "connection lost" };
    draw();

    expect(await screen.findByRole("alert")).toHaveTextContent("The guest list couldn't be loaded.");
    db.participantsError = null;
    db.participants = [row("1", "u1")];
    db.profiles = [profile("u1", "Ari Stone")];
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Ari Stone/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is a modal with a labelled title: aria-modal, named by its heading", async () => {
    draw();
    const dialog = await screen.findByRole("dialog", { name: "Who's going" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("heading", { name: "Who's going" })).toBeInTheDocument();
    await screen.findByText("No one to show yet.");
  });

  it("keeps focus inside while open, closes on Escape and returns focus to what opened it", async () => {
    db.participants = [row("1", "u1")];
    db.profiles = [profile("u1", "Ari Stone")];
    draw({ startOpen: false });

    const opener = screen.getByRole("button", { name: "Open list" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Who's going" });
    await screen.findByRole("link", { name: /Ari Stone/ });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("reads the list again every time it opens", async () => {
    db.participants = [row("1", "u1")];
    db.profiles = [profile("u1", "Ari Stone")];
    draw({ startOpen: false });

    fireEvent.click(screen.getByRole("button", { name: "Open list" }));
    await screen.findByRole("link", { name: /Ari Stone/ });
    const firstReads = db.selects.filter((select) => select.table === "jam_participants").length;
    await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    db.participants = [row("1", "u1"), row("2", "u2")];
    db.profiles = [profile("u1", "Ari Stone"), profile("u2", "Bea Moon")];
    fireEvent.click(screen.getByRole("button", { name: "Open list" }));
    expect(await screen.findByRole("link", { name: /Bea Moon/ })).toBeInTheDocument();
    expect(db.selects.filter((select) => select.table === "jam_participants").length).toBe(firstReads + 1);
  });
});
