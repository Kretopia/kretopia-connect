import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

const invoke = vi.fn();
const updates: unknown[] = [];
const inserts: unknown[] = [];
let profileUpdateError: unknown = null;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: (table: string) => ({
      update: (p: unknown) => { updates.push({ table, p }); return { eq: async () => ({ error: profileUpdateError }) }; },
      select: () => { const c = { eq: () => c, limit: () => c, maybeSingle: async () => ({ data: null, error: null }) }; return c; },
      insert: async (p: unknown) => { inserts.push({ table, p }); return { error: null }; },
    }),
  },
}));

import { PassportDraftCard } from "../PassportDraftCard";
import { ProfileActivationGate } from "@/components/ProfileActivationGate";

const full = {
  ok: true,
  draft: {
    bio: { text: "I'm an illustrator in Jakarta focused on storyboarding." },
    photo: { url: "https://lh3.test/me", source: "auth_provider" },
    work_item: { project_name: "Portfolio · amaravega.com", role: "Illustrator", url: "https://amaravega.com/work", source_label: "Link already on your profile" },
  },
  unavailable: {},
};

const renderCard = () => render(<MemoryRouter><PassportDraftCard surfaceLabel="Stage" /></MemoryRouter>);

beforeEach(() => {
  invoke.mockReset(); toast.mockClear(); updates.length = 0; inserts.length = 0; profileUpdateError = null;
});

describe("PassportDraftCard", () => {
  it("offers one action, saves nothing by itself, and keeps manual completion as a quiet link", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Strengthen your Passport for Stage" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /draft with kreto/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /complete your profile/i })).toHaveAttribute("href", "/profile");
    expect(screen.getAllByRole("button")).toHaveLength(1); // the link is not a second button
    expect(invoke).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("shows a visible loading state while the one call runs", async () => {
    invoke.mockReturnValue(new Promise(() => {}));
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /draft with kreto/i }));
    expect(await screen.findByText(/kreto is drafting from your profile/i)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("shows the draft for review: nothing is saved until accepted fields are saved explicitly", async () => {
    invoke.mockResolvedValue({ data: full, error: null });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /draft with kreto/i }));
    expect(await screen.findByTestId("draft-bio")).toHaveTextContent("I'm an illustrator in Jakarta");
    expect(screen.getByTestId("draft-work_item")).toHaveTextContent("Added as self-reported. It is not verified.");
    expect(screen.getByRole("button", { name: /save accepted/i })).toBeDisabled();
    expect(updates).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("saves only the accepted fields", async () => {
    invoke.mockResolvedValue({ data: full, error: null });
    const onUpdated = vi.fn();
    window.addEventListener("kretopia:profile-updated", onUpdated);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /draft with kreto/i }));
    await screen.findByTestId("draft-bio");
    // bio accepted, photo rejected, work item left undecided
    fireEvent.click(within(screen.getByRole("group", { name: /bio/i })).getByRole("button", { name: /accept/i }));
    fireEvent.click(within(screen.getByRole("group", { name: /photo/i })).getByRole("button", { name: /reject/i }));
    expect(screen.getByRole("button", { name: /save accepted \(1\)/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /save accepted/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Saved to your Passport" })));
    expect(updates).toEqual([{ table: "profiles", p: { bio: "I'm an illustrator in Jakarta focused on storyboarding." } }]);
    expect(inserts).toEqual([]);
    expect(onUpdated).toHaveBeenCalled();
    window.removeEventListener("kretopia:profile-updated", onUpdated);
  });

  it("a field that failed to save stays on screen with its choice, and is said out loud", async () => {
    invoke.mockResolvedValue({ data: full, error: null });
    profileUpdateError = { message: "denied" };
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /draft with kreto/i }));
    await screen.findByTestId("draft-bio");
    fireEvent.click(within(screen.getByRole("group", { name: /bio/i })).getByRole("button", { name: /accept/i }));
    fireEvent.click(screen.getByRole("button", { name: /save accepted/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/bio: your profile could not be updated/i);
    expect(screen.getByTestId("draft-bio")).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it("a partial draft says which parts Kreto could not fill, instead of inventing them", async () => {
    invoke.mockResolvedValue({
      data: { ok: true, draft: { bio: full.draft.bio, photo: null, work_item: null }, unavailable: { photo: "no_candidates", work_item: "no_candidates" } },
      error: null,
    });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /draft with kreto/i }));
    await screen.findByTestId("draft-bio");
    expect(screen.getByTestId("draft-photo")).toHaveTextContent("Nothing you already have on Kretopia can fill this in.");
    expect(screen.getByTestId("draft-work_item")).toHaveTextContent("Nothing you already have on Kretopia can fill this in.");
    expect(screen.getByText(/could draft only part of this/i)).toBeInTheDocument();
  });

  it("a failed request shows an error and a retry, and the manual path is still there", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: "ai_failed" }) } } });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /draft with kreto/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The draft could not be written.");
    expect(screen.getByRole("link", { name: /complete your profile/i })).toBeInTheDocument();
    invoke.mockResolvedValueOnce({ data: full, error: null });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByTestId("draft-bio")).toBeInTheDocument();
  });
});

describe("ProfileActivationGate", () => {
  it("renders the AI draft card above the children while the profile is incomplete, and none of the old static block", () => {
    render(<MemoryRouter><ProfileActivationGate isVisible={false} missingFields={["Profile Picture"]} surfaceLabel="Stage"><p>live rooms</p></ProfileActivationGate></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Strengthen your Passport for Stage" })).toBeInTheDocument();
    expect(screen.getByText("live rooms")).toBeInTheDocument();
    for (const gone of [/at least 1 work item/i, /fast track/i, /import from a link/i, /^import$/i, /complete profile manually/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("renders only the children once the profile is complete", () => {
    render(<MemoryRouter><ProfileActivationGate isVisible missingFields={[]}><p>live rooms</p></ProfileActivationGate></MemoryRouter>);
    expect(screen.getByText("live rooms")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
