import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiedSearchDropdown } from "../UnifiedSearchDropdown";
import { CreditEndorsementDialog } from "@/components/profile/CreditEndorsementDialog";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), or: vi.fn(), neq: vi.fn(), range: vi.fn(), insert: vi.fn(),
  web: vi.fn(), invoke: vi.fn(), notify: vi.fn(), onSelect: vi.fn(),
  response: { data: [] as Record<string, unknown>[], error: null as null | { message: string } },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "viewer" } }) }));
vi.mock("@/hooks/useVoiceSearch", () => ({ useVoiceSearch: () => ({ supported: true, status: "idle", level: 0 }) }));
vi.mock("../PublicWebSearchResults", () => ({ PublicWebSearchResults: () => { mocks.web(); return null; } }));
vi.mock("@/lib/notifyUser", () => ({ notifyUser: mocks.notify }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "ilike", "order", "abortSignal"]) chain[method] = () => chain;
  chain.or = (value: string) => { mocks.or(value); return chain; };
  chain.neq = (...args: unknown[]) => { mocks.neq(...args); return chain; };
  chain.range = (...args: unknown[]) => { mocks.range(...args); return chain; };
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.response).then(resolve);
  chain.insert = (row: unknown) => {
    mocks.insert(row);
    return { select: () => ({ single: async () => ({ data: { token: "fixture-token" }, error: null }) }) };
  };
  return { supabase: { from: (table: string) => { mocks.from(table); return chain; }, functions: { invoke: mocks.invoke } } };
});

function showSearch() {
  return render(<MemoryRouter><UnifiedSearchDropdown usersOnly variant="inline" onSelect={mocks.onSelect} /></MemoryRouter>);
}
const member = (index: number) => ({ user_id: `fixture-${index}`, full_name: `Alice ${index}`, username: `alice_${index}`, role: "Designer", avatar_url: null });

describe("Verification user search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.response = { data: [member(0)], error: null };
  });

  it("searches real profiles from the first letter without web, AI, or credit calls", async () => {
    showSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "A" } });
    await screen.findByRole("button", { name: /Alice 0/ });
    expect(mocks.or).toHaveBeenCalledWith('full_name.ilike."%A%",username.ilike."%A%"');
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["profiles"]);
    expect(mocks.web).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.neq).toHaveBeenCalledWith("user_id", "viewer");
  });

  it("finds @username without including the @ in the query", async () => {
    showSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "@a" } });
    await screen.findByRole("button", { name: /Alice 0/ });
    expect(mocks.or).toHaveBeenCalledWith('full_name.ilike."%a%",username.ilike."%a%"');
  });

  it("keeps matches beyond four and beyond the first page reachable", async () => {
    mocks.response.data = Array.from({ length: 51 }, (_, index) => member(index));
    showSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "A" } });
    await screen.findByRole("button", { name: /Alice 49/ });
    expect(mocks.range).toHaveBeenCalledWith(0, 50);
    mocks.response.data = [member(50)];
    fireEvent.click(screen.getByRole("button", { name: "Show more users" }));
    await screen.findByRole("button", { name: /Alice 50/ });
    expect(mocks.range).toHaveBeenLastCalledWith(50, 100);
    expect(screen.getByRole("button", { name: /Alice 0 / })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more users" })).not.toBeInTheDocument();
  });

  it("never submits typed text as an AI or global search", async () => {
    showSearch();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "A" } });
    const form = input.closest("form");
    if (!form) throw new Error("Search form missing");
    fireEvent.submit(form);
    await screen.findByRole("button", { name: /Alice 0/ });
    expect(mocks.onSelect).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("selects a modal user through the existing endorsement request without navigating", async () => {
    render(<MemoryRouter><CreditEndorsementDialog open onOpenChange={vi.fn()} credit={{ id: "fixture-credit", project_name: "Fixture film", role: "Director" }} userId="viewer" /></MemoryRouter>);
    fireEvent.change(screen.getByRole("combobox", { name: "Search Kretopia users" }), { target: { value: "A" } });
    fireEvent.click(await screen.findByRole("button", { name: /Alice 0/ }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ credit_id: "fixture-credit", requested_by: "viewer", endorser_id: "fixture-0", status: "pending" })));
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.web).not.toHaveBeenCalled();
  });
});