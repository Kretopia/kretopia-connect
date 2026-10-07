import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
vi.mock("@/components/BrandLogo", () => ({ BrandLogo: () => <div data-testid="brand-logo" /> }));
vi.mock("@/components/ui/creative-loader", () => ({ CreativeLoader: () => <div>loading</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CreditVerify from "../CreditVerify";

const baseRow = {
  id: "e1",
  credit_id: "c1",
  status: "pending",
  relationship: "collaborator",
  endorser_name: null as string | null,
  project_name: "Night Shift",
  role: "Director of Photography",
  year: 2024,
  requester_name: "Dee Marshall",
  requester_avatar_url: null,
};

function renderPage(token = "tok-1") {
  return render(
    <MemoryRouter initialEntries={[`/credit-verify?token=${token}`]}>
      <CreditVerify />
    </MemoryRouter>,
  );
}

function mockRequest(row: Partial<typeof baseRow> | null) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "get_credit_endorsement_by_token") return { data: row ? [{ ...baseRow, ...row }] : [], error: null };
    return { data: { success: true }, error: null };
  });
}

describe("CreditVerify", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("asks for a name on the same screen and only enables the confirm button once it's typed", async () => {
    mockRequest({});
    renderPage();

    const yes = await screen.findByRole("button", { name: /Yes, we worked together/i });
    expect(yes).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Your name, as it will appear/i), { target: { value: "Sam Lee" } });
    expect(yes).toBeEnabled();

    fireEvent.click(yes);
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        "submit_credit_endorsement_by_token",
        expect.objectContaining({ _token: "tok-1", _accepted: true, _endorser_name: "Sam Lee", _testimonial: null }),
      ),
    );
    expect(await screen.findByText("Credit confirmed")).toBeInTheDocument();
  });

  it("skips the name field when the request already carries one, and sends the optional line", async () => {
    mockRequest({ endorser_name: "Jordan Pierce" });
    renderPage();

    const yes = await screen.findByRole("button", { name: /Yes, we worked together/i });
    expect(screen.queryByLabelText(/Your name, as it will appear/i)).not.toBeInTheDocument();
    expect(yes).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/One line about their work/i), { target: { value: "  Lit the whole film in two weeks.  " } });
    fireEvent.click(yes);

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        "submit_credit_endorsement_by_token",
        expect.objectContaining({ _endorser_name: "Jordan Pierce", _testimonial: "Lit the whole film in two weeks." }),
      ),
    );
  });

  it("caps the optional line at 280 characters", async () => {
    mockRequest({ endorser_name: "Jordan Pierce" });
    renderPage();
    await screen.findByRole("button", { name: /Yes, we worked together/i });
    const note = screen.getByLabelText(/One line about their work/i) as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "x".repeat(400) } });
    expect(note.value).toHaveLength(280);
  });

  it("tells a connection problem apart from a bad link, and lets them retry", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "network down" } });
    renderPage();
    expect(await screen.findByText(/couldn't load this request/i)).toBeInTheDocument();

    mockRequest({ endorser_name: "Jordan Pierce" });
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(await screen.findByRole("button", { name: /Yes, we worked together/i })).toBeInTheDocument();
  });

  it("explains an unknown link and what to do next", async () => {
    mockRequest(null);
    renderPage("stale");
    expect(await screen.findByText(/confirmation link isn't valid/i)).toBeInTheDocument();
    expect(screen.getByText(/share a fresh link/i)).toBeInTheDocument();
  });

  it("shows an already-answered request as done, not as a form", async () => {
    mockRequest({ status: "accepted" });
    renderPage();
    expect(await screen.findByText("Credit confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yes, we worked together/i })).not.toBeInTheDocument();
  });
});
