import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

// What the backend answers, by table. Changed per test.
const answers: { claims: { count?: number; error?: { code?: string; message: string } }; verificationError: boolean } = { claims: { count: 3 }, verificationError: false };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      };
      chain.maybeSingle = async () => ({ data: table === "user_roles" ? { role: "admin" } : null, error: null });
      chain.then = (ok: (v: unknown) => unknown) => {
        let result: Record<string, unknown> = { data: null, error: null, count: 0 };
        if (table === "profiles") result = { data: null, error: null, count: filters.some(([c]) => c === "is_claimed") ? 7 : 120 };
        if (table === "verification_requests") result = answers.verificationError ? { data: null, error: { message: "boom" }, count: null } : { data: null, error: null, count: 4 };
        if (table === "manual_bank_transfers") result = { data: null, error: null, count: 2 };
        if (table === "icdb_role_claim_requests") result = answers.claims.error ? { data: null, error: answers.claims.error, count: null } : { data: null, error: null, count: answers.claims.count };
        return Promise.resolve(result).then(ok);
      };
      return chain;
    },
  },
}));

const me = { id: "admin-1" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: me }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/thriveCopilot", () => ({ loadAiCreditOverview: vi.fn() }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => <h1>Operations.</h1> }));
// The tabs are not what is under test: each is replaced by a stub, so none of them reads the backend.
vi.mock("@/components/admin/ScoutFunnelTab", () => ({ ScoutFunnelTab: () => <div>ScoutFunnelTab stub</div> }));
vi.mock("@/components/admin/UsersTab", () => ({ UsersTab: () => <div>UsersTab stub</div> }));
vi.mock("@/components/admin/VerificationTab", () => ({ VerificationTab: () => <div>VerificationTab stub</div> }));
vi.mock("@/components/admin/UnclaimedProfilesTab", () => ({ UnclaimedProfilesTab: () => <div>UnclaimedProfilesTab stub</div> }));
vi.mock("@/components/admin/OutreachTab", () => ({ OutreachTab: () => <div>OutreachTab stub</div> }));
vi.mock("@/components/admin/FeedbackTab", () => ({ FeedbackTab: () => <div>FeedbackTab stub</div> }));
vi.mock("@/components/admin/DripCampaignTab", () => ({ DripCampaignTab: () => <div>DripCampaignTab stub</div> }));
vi.mock("@/components/admin/FounderGrantTab", () => ({ FounderGrantTab: () => <div>FounderGrantTab stub</div> }));
vi.mock("@/components/admin/BankTransfersTab", () => ({ BankTransfersTab: () => <div>BankTransfersTab stub</div> }));
vi.mock("@/components/admin/BounceRateTab", () => ({ BounceRateTab: () => <div>BounceRateTab stub</div> }));
vi.mock("@/components/admin/AmbassadorsTab", () => ({ AmbassadorsTab: () => <div>AmbassadorsTab stub</div> }));
vi.mock("@/components/admin/ProductDashboardTab", () => ({ ProductDashboardTab: () => <div>ProductDashboardTab stub</div> }));
vi.mock("@/components/admin/RoleClaimsTab", () => ({
  RoleClaimsTab: ({ onDecided }: { onDecided?: () => void }) => (
    <div>
      role claims tab
      <button type="button" onClick={() => onDecided?.()}>
        decide one
      </button>
    </div>
  ),
}));

import Admin from "../Admin";

const renderAdmin = () =>
  render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );

const card = (label: string) => screen.getByText(label).closest("button") as HTMLButtonElement;

beforeEach(() => {
  answers.claims = { count: 3 };
  answers.verificationError = false;
});

describe("Admin overview: the role claims card", () => {
  it("shows how many role claims are waiting, beside the other four counts", async () => {
    renderAdmin();
    await waitFor(() => expect(card("Role claims waiting")).toHaveTextContent("3"));
    expect(card("Total users")).toHaveTextContent("120");
    expect(card("Pending verifications")).toHaveTextContent("4");
    expect(card("Unclaimed profiles")).toHaveTextContent("7");
    expect(card("Pending transfers")).toHaveTextContent("2");
  });

  it("shows zero as zero, not as a dash", async () => {
    answers.claims = { count: 0 };
    renderAdmin();
    await waitFor(() => expect(card("Role claims waiting")).toHaveTextContent("0"));
    expect(card("Role claims waiting")).not.toHaveTextContent("—");
  });

  it("when the migration is not applied, says so on the card and leaves the other four counts alone", async () => {
    answers.claims = { error: { code: "PGRST205", message: "Could not find the table 'public.icdb_role_claim_requests' in the schema cache" } };
    renderAdmin();
    await waitFor(() => expect(card("Role claims waiting")).toHaveTextContent("—"));
    expect(card("Role claims waiting")).toHaveAttribute("title", "Role claim review isn't set up on this backend yet");
    expect(card("Total users")).toHaveTextContent("120");
    expect(card("Pending transfers")).toHaveTextContent("2");
    expect(screen.queryByText(/Couldn't load the overview counts/)).not.toBeInTheDocument();
  });

  it("a count that failed to load is a dash, never a zero", async () => {
    answers.claims = { error: { code: "XX000", message: "internal error" } };
    renderAdmin();
    await waitFor(() => expect(card("Role claims waiting")).toHaveAttribute("title", "Couldn't load this count"));
    expect(card("Role claims waiting")).toHaveTextContent("—");
  });

  it("keeps its own number when one of the other counts fails, and stays clickable", async () => {
    answers.verificationError = true;
    renderAdmin();
    await waitFor(() => expect(screen.getByText(/Couldn't load the overview counts/)).toBeInTheDocument());
    expect(card("Role claims waiting")).toHaveTextContent("3");
    expect(card("Role claims waiting")).toBeEnabled();
    expect(card("Total users")).toBeDisabled();
  });

  it("opens the Role claims tab", async () => {
    renderAdmin();
    await waitFor(() => expect(card("Role claims waiting")).toHaveTextContent("3"));
    fireEvent.click(card("Role claims waiting"));
    expect(await screen.findByText(/role claims tab/)).toBeInTheDocument();
  });

  it("recounts after a decision is saved in the tab, so the card is not left stale", async () => {
    renderAdmin();
    await waitFor(() => expect(card("Role claims waiting")).toHaveTextContent("3"));
    fireEvent.click(card("Role claims waiting"));
    answers.claims = { count: 2 };
    fireEvent.click(await screen.findByRole("button", { name: "decide one" }));
    await waitFor(() => expect(card("Role claims waiting")).toHaveTextContent("2"));
  });
});
