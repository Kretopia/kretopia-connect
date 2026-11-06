import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { code?: string; message: string } | null };
const tables: Record<string, Result> = {};
const rpc = vi.fn();
const notifyUser = vi.fn();
const toast = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      for (const m of ["select", "order", "limit", "in", "eq"]) chain[m] = self;
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(ok);
      return chain;
    },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));
vi.mock("@/lib/notifyUser", () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import { RoleClaimsTab } from "../RoleClaimsTab";

const request = (over: Record<string, unknown> = {}) => ({
  id: "c1", role_id: "r1", requester_id: "u1", thumbnail_url: null, status: "pending", note: null,
  created_at: "2026-11-05T10:00:00Z", decided_at: null, decided_by: null, ...over,
});
const role = (over: Record<string, unknown> = {}) => ({ id: "r1", project_id: "p1", role_title: "Director", person_name: "Dee Marshall", is_claimed: false, claimed_by: null, ...over });
const profile = (over: Record<string, unknown> = {}) => ({ user_id: "u1", full_name: "Dee Marshall", username: "dee", avatar_url: null, verification_status: null, ...over });

function seed(opts: { requests?: unknown[]; roles?: unknown[]; profiles?: unknown[] } = {}) {
  tables.icdb_role_claim_requests = { data: opts.requests ?? [request()], error: null };
  tables.icdb_project_roles = { data: opts.roles ?? [role()], error: null };
  tables.public_profiles_safe = { data: opts.profiles ?? [profile()], error: null };
  tables.icdb_projects = { data: [{ id: "p1", title: "Night Shift", year: 2024, type: "film", platform: null, external_url: "https://example.com/night-shift" }], error: null };
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  rpc.mockReset();
  notifyUser.mockReset();
  toast.mockReset();
});

describe("Admin > Role claims", () => {
  it("shows what a reviewer needs next to each waiting claim: who, which role, which project, and the credited name", async () => {
    seed();
    render(<RoleClaimsTab />);
    const card = await screen.findByTestId("role-claim");
    expect(within(card).getByRole("link", { name: "Open Dee Marshall's Passport in a new tab" })).toHaveAttribute("href", "/profile/u1");
    expect(within(card).getByText("@dee")).toBeInTheDocument();
    expect(within(card).getByText("Director")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Night Shift" })).toHaveAttribute("href", "/credits/project/p1");
    expect(within(card).getByText("Dee Marshall", { selector: "strong" })).toBeInTheDocument();
    expect(within(card).getByText(/Same name as the member's profile/)).toBeInTheDocument();
    expect(within(card).getByText(/A name is a hint, not proof/)).toBeInTheDocument();
    expect(within(card).getByText(/identity not reviewed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting (1)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("flags members who asked for the same role", async () => {
    seed({ requests: [request(), request({ id: "c2", requester_id: "u2" })], profiles: [profile(), profile({ user_id: "u2", full_name: "Sam Lee", username: "sam" })] });
    render(<RoleClaimsTab />);
    const cards = await screen.findAllByTestId("role-claim");
    expect(within(cards[0]).getByText(/1 other member also asked for this role \(Sam Lee\)/)).toBeInTheDocument();
  });

  it("approving asks first, spells out what it does, then sends the decision and tells the member", async () => {
    seed();
    rpc.mockResolvedValue({ data: { success: true, status: "approved", credit_id: "cr1" }, error: null });
    render(<RoleClaimsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Approve Dee Marshall's claim to Director/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/as their own claim, not as a verified credit/)).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot undo it/)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled(); // nothing happens before the confirmation

    fireEvent.change(within(dialog).getByLabelText(/Note to the member/), { target: { value: "Matches the credits page." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve claim" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("decide_icdb_role_claim", { p_request_id: "c1", p_approve: true, p_note: "Matches the credits page." }));
    await waitFor(() => expect(notifyUser).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", title: "Your role claim was approved" })));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Claim approved" }));
  });

  it("warns that approving declines the other pending requests for the same role", async () => {
    seed({ requests: [request(), request({ id: "c2", requester_id: "u2" })], profiles: [profile(), profile({ user_id: "u2", full_name: "Sam Lee" })] });
    render(<RoleClaimsTab />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Approve Dee Marshall's claim/ }))[0]);
    expect(await screen.findByText(/the 1 other pending request for it will be declined/)).toBeInTheDocument();
  });

  it("declining sends a decline and tells the member, with the note the admin wrote", async () => {
    seed();
    rpc.mockResolvedValue({ data: { success: true, status: "rejected" }, error: null });
    render(<RoleClaimsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Decline Dee Marshall's claim/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/can ask again later/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Note to the member/), { target: { value: "Could not match you." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Decline claim" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("decide_icdb_role_claim", { p_request_id: "c1", p_approve: false, p_note: "Could not match you." }));
    await waitFor(() => expect(notifyUser).toHaveBeenCalledWith(expect.objectContaining({ title: "Your role claim wasn't approved", message: expect.stringContaining("Could not match you.") })));
  });

  it("an approval that the database turned into a decline is reported as a decline, never as an approval", async () => {
    seed();
    rpc.mockResolvedValue({ data: { success: true, status: "rejected" }, error: null });
    render(<RoleClaimsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Approve Dee Marshall's claim/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve claim" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Declined instead" })));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Claim approved" }));
  });

  it("a request someone else already decided changes nothing and tells nobody", async () => {
    seed();
    rpc.mockResolvedValue({ data: { success: false, error: "Already approved" }, error: null });
    render(<RoleClaimsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Approve Dee Marshall's claim/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve claim" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Already decided" })));
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("a non-admin is told no and nothing is saved or announced", async () => {
    seed();
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "Only admins can decide a role claim" } });
    render(<RoleClaimsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Decline Dee Marshall's claim/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Decline claim" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Not allowed", variant: "destructive" })));
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("a failed save keeps the dialog open so nothing is lost, and says nothing was changed", async () => {
    seed();
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    render(<RoleClaimsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Approve Dee Marshall's claim/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve claim" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't save the decision", description: expect.stringContaining("Nothing was changed") })));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("a role that was claimed in the meantime cannot be approved, only cleared", async () => {
    seed({ roles: [role({ is_claimed: true, claimed_by: "u9" })] });
    render(<RoleClaimsTab />);
    expect(await screen.findByRole("button", { name: /Approve Dee Marshall's claim/ })).toBeDisabled();
    expect(screen.getByText(/already been claimed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Decline Dee Marshall's claim/ })).toBeEnabled();
  });

  it("keeps the history on its own list", async () => {
    seed({ requests: [request(), request({ id: "c3", requester_id: "u3", status: "approved", decided_at: "2026-11-04T10:00:00Z", note: "Verified by call." })], profiles: [profile(), profile({ user_id: "u3", full_name: "Sam Lee" })] });
    render(<RoleClaimsTab />);
    await screen.findByTestId("role-claim");
    expect(screen.queryByText("Sam Lee")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Decided (1)" }));
    const card = await screen.findByTestId("role-claim");
    expect(within(card).getByText("Sam Lee")).toBeInTheDocument();
    expect(within(card).getByText("Approved")).toBeInTheDocument();
    expect(within(card).getByText(/Verified by call\./)).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
  });

  it("says plainly when the migration is not applied, instead of showing an empty queue", async () => {
    tables.icdb_role_claim_requests = { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.icdb_role_claim_requests' in the schema cache" } };
    render(<RoleClaimsTab />);
    expect(await screen.findByText(/isn't set up on this backend yet/)).toBeInTheDocument();
    expect(screen.queryByText("No claims are waiting.")).not.toBeInTheDocument();
  });

  it("an empty queue says so", async () => {
    seed({ requests: [] });
    render(<RoleClaimsTab />);
    expect(await screen.findByText("No claims are waiting.")).toBeInTheDocument();
  });

  it("never loads or links an address that is not http(s)", async () => {
    seed({ requests: [request({ thumbnail_url: "javascript:alert(1)" })], profiles: [profile({ avatar_url: "javascript:alert(2)" })] });
    const { container } = render(<RoleClaimsTab />);
    await screen.findByTestId("role-claim");
    expect(container.querySelector('img[src^="javascript:"]')).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  });
});

describe("the admin page carries the tab", () => {
  it("registers Role claims under Users & Trust", () => {
    const source = readFileSync(join(process.cwd(), "src/pages/Admin.tsx"), "utf8");
    expect(source).toContain('value: "role-claims", label: "Role claims"');
    expect(source).toContain('<TabsContent value="role-claims"');
    expect(source).toMatch(/<RoleClaimsTab[\s/>]/);
  });
});
