import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Lead Scout used to create duplicate leads: scout-leads already saves what
 * it finds, then "Save" / "Save All" / CSV import added the same people again.
 * These tests drive the real LeadsTab with a mocked data layer and check that
 * nobody who is already in the pipeline is inserted a second time.
 */

const insert = vi.fn(async (_rows: unknown) => ({ error: null }));
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
let existingLeads: any[] = [];
let scoutResponse: any = {};

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { success: (m: string) => toast.success(m), error: (m: string) => toast.error(m), info: (m: string) => toast.info(m) } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: existingLeads, error: null }) }) }),
      insert: (rows: unknown) => insert(rows),
      update: () => ({ eq: async () => ({ error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    functions: { invoke: async () => ({ data: scoutResponse, error: null }) },
  },
}));

import LeadsTab from "../LeadsTab";

const lead = (over: Record<string, unknown>) => ({
  id: "x", name: "", type: "client", stage: "cold", email: null, company: null, role: null, notes: null,
  tags: [], source: "x", priority: "medium", last_contacted_at: null, next_follow_up_at: null, created_at: "2026-01-01", ...over,
});
const found = (over: Record<string, unknown>) => ({
  name: "", company: null, role: null, email: null, website: null, notes: "relevant", type: "client", priority: "high", ...over,
});

async function openScoutAndSearch() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LeadsTab />
    </QueryClientProvider>,
  );
  await screen.findByText("Bo Chan"); // pipeline loaded: the app now knows who is already saved
  fireEvent.mouseDown(screen.getByRole("tab", { name: /AI Scout/i }), { button: 0 });
  fireEvent.change(screen.getByPlaceholderText(/music video production/i), { target: { value: "editors" } });
  fireEvent.click(screen.getByRole("button", { name: /Find Leads/i }));
  await screen.findByText(/leads found/);
}

const card = (name: string) => screen.getAllByText(name).map((n) => n.closest(".p-3") as HTMLElement).find(Boolean)!;

beforeEach(() => {
  insert.mockClear();
  Object.values(toast).forEach((f) => f.mockClear());
  existingLeads = [lead({ id: "l1", name: "Bo Chan", company: "Zed" })];
  scoutResponse = {
    leads: [
      found({ name: "Ann Lee", company: "Acme", email: "ann@acme.com", in_leads: true }), // the server just saved her
      found({ name: "bo chan", company: "ZED", email: "bo@zed.com" }),                    // already in the pipeline, server did not flag
      found({ name: "Cy New", company: "Fresh", email: "cy@fresh.com" }),                 // genuinely new
    ],
    saved_count: 1, already_saved_count: 0, sources: [],
  };
});

describe("Lead Scout duplicate protection", () => {
  it("shows what the search already saved, and does not offer to save it again", async () => {
    await openScoutAndSearch();
    expect(screen.getByText("3 leads found")).toBeInTheDocument();
    expect(screen.getByText(/1 added to your pipeline/)).toBeInTheDocument();
    const ann = within(card("Ann Lee")).getByRole("button");
    expect(ann).toHaveTextContent("Saved");
    expect(ann).toBeDisabled();
    expect(within(card("Cy New")).getByRole("button")).toHaveTextContent("Save");
  });

  it("Save All inserts only the people who are not already in the pipeline", async () => {
    await openScoutAndSearch();
    fireEvent.click(screen.getByRole("button", { name: /Save All/i }));
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    const rows = insert.mock.calls[0][0] as Array<{ name: string }>;
    expect(rows.map((r) => r.name)).toEqual(["Cy New"]); // not Ann (saved by the search), not Bo (already a lead)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("1 leads saved (1 already in your leads)"));
    // all three now read as saved
    await waitFor(() => expect(screen.getAllByText("Saved")).toHaveLength(3));
  });

  it("saving someone who is already a lead does not insert, and says so", async () => {
    await openScoutAndSearch();
    fireEvent.click(within(card("bo chan")).getByRole("button"));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("bo chan is already in your leads"));
    expect(insert).not.toHaveBeenCalled();
    expect(within(card("bo chan")).getByRole("button")).toHaveTextContent("Saved");
  });

  it("saving a genuinely new lead still works", async () => {
    await openScoutAndSearch();
    fireEvent.click(within(card("Cy New")).getByRole("button"));
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    // the single-lead path inserts one row (an object), unlike Save All / CSV which insert arrays
    expect(insert.mock.calls[0][0]).toEqual(expect.objectContaining({ name: "Cy New", source: "AI Scout", user_id: "u1" }));
  });

  it("Save All is disabled once everything in the results is already saved", async () => {
    scoutResponse = {
      leads: [found({ name: "Ann Lee", email: "ann@acme.com", in_leads: true })],
      saved_count: 0, already_saved_count: 1, sources: [],
    };
    await openScoutAndSearch();
    expect(screen.getByRole("button", { name: /Save All/i })).toBeDisabled();
    expect(screen.getByText(/1 already there/)).toBeInTheDocument();
  });

  it("CSV import skips people already in the pipeline and repeats inside the file", async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LeadsTab />
      </QueryClientProvider>,
    );
    await screen.findByText("Bo Chan");
    const csv = [
      "name,email,company",
      "Bo Chan,,Zed",            // already a lead (name + company)
      "Dee Fresh,dee@x.com,X",   // new
      "Dee Again,DEE@x.com,X",   // same email as the row above
      "Eve Other,,Y",            // new
    ].join("\n");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([csv], "leads.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    expect((insert.mock.calls[0][0] as Array<{ name: string }>).map((r) => r.name)).toEqual(["Dee Fresh", "Eve Other"]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Imported 2 leads (2 already in your leads)"));
  });
});
