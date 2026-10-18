import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  existing: null as null | Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  updateError: null as null | { message: string },
  navigate: vi.fn(),
  toast: vi.fn(),
  // one stable object: the page's load effect depends on `user`, so a new object per render would loop
  auth: { user: { id: "company-1" } },
}));

// The profile row is read once (select -> eq -> single) and written once (update -> eq).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: db.existing, error: null }) }) }),
      update: (payload: Record<string, unknown>) => ({
        eq: () => {
          db.updates.push(payload);
          return Promise.resolve({ error: db.updateError });
        },
      }),
    }),
    storage: { from: () => ({}) },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => db.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: db.toast }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/ImageCropDialog", () => ({ ImageCropDialog: () => null }));
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => db.navigate }));

import CompanyOnboarding from "../CompanyOnboarding";

const profile = (over: Record<string, unknown> = {}) => ({
  company_name: "Acme Studios",
  company_industry: "",
  company_size: "",
  company_tagline: "",
  company_about: "",
  company_address: "",
  website: "",
  company_logo_url: null,
  primary_intents: null,
  primary_intent: null,
  ...over,
});

async function toGoalStep() {
  render(
    <MemoryRouter>
      <CompanyOnboarding />
    </MemoryRouter>,
  );
  // the existing name is loaded before Next is pressed
  await waitFor(() => expect(screen.getByDisplayValue("Acme Studios")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /Continue|Next/i }));
  await screen.findByText("What are you looking to do on Kretopia?");
}

const finish = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Finish|Launch|Complete|Done/i }));
  await waitFor(() => expect(db.updates).toHaveLength(1));
  return db.updates[0];
};

beforeEach(() => {
  db.existing = profile();
  db.updates = [];
  db.updateError = null;
  db.navigate.mockClear();
  db.toast.mockClear();
});

describe("company onboarding: the page can be saved", () => {
  it("marks onboarding done with the real column, not the misspelled one that made the update fail", async () => {
    await toGoalStep();
    const sent = await finish();
    expect(sent.onboarding_completed).toBe(true);
    expect("onboarding_complete" in sent).toBe(false);
    expect(db.navigate).toHaveBeenCalledWith("/desk");
  });
});

describe("company onboarding: the recruitment goal is saved", () => {
  it("saves the chosen goal as the account's canonical intent", async () => {
    await toGoalStep();
    fireEvent.click(screen.getByRole("button", { name: "Find freelance talent for projects" }));
    const sent = await finish();
    expect(sent.primary_intents).toEqual(["hire"]);
    expect(sent.primary_intent).toBe("hire");
    expect(typeof sent.intent_set_at).toBe("string");
    expect(typeof sent.intent_week_start).toBe("string");
  });

  it("saves nothing about intents when no goal was chosen, and does not touch what was saved", async () => {
    db.existing = profile({ primary_intents: ["gigs"] });
    await toGoalStep();
    const sent = await finish();
    for (const key of ["primary_intents", "primary_intent", "intent_set_at", "intent_week_start"]) expect(key in sent).toBe(false);
  });

  it("'Other' says nothing the product can act on: intents are left alone", async () => {
    await toGoalStep();
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    const sent = await finish();
    expect("primary_intents" in sent).toBe(false);
  });

  it("choosing a goal and then un-choosing it saves no intent", async () => {
    await toGoalStep();
    const goal = screen.getByRole("button", { name: "Sponsor / partner with creators" });
    fireEvent.click(goal);
    fireEvent.click(goal);
    const sent = await finish();
    expect("primary_intents" in sent).toBe(false);
  });
});

describe("company onboarding: reload and update", () => {
  it("after a reload it shows what is saved, in the product's own words", async () => {
    db.existing = profile({ primary_intents: ["hire"] });
    await toGoalStep();
    expect(screen.getByText(/Currently set: Hire creatives/)).toBeInTheDocument();
  });

  it("shows nothing about a saved goal for an account that has none", async () => {
    await toGoalStep();
    expect(screen.queryByText(/Currently set/)).toBeNull();
  });

  it("reads the legacy single intent too", async () => {
    db.existing = profile({ primary_intents: null, primary_intent: "collaborate" });
    await toGoalStep();
    expect(screen.getByText(/Currently set: Collaborate/)).toBeInTheDocument();
  });

  it("an update puts the new goal first and keeps the other saved intent, at most two", async () => {
    db.existing = profile({ primary_intents: ["hire", "gigs"] });
    await toGoalStep();
    fireEvent.click(screen.getByRole("button", { name: "Sponsor / partner with creators" }));
    const sent = await finish();
    expect(sent.primary_intents).toEqual(["collaborate", "hire"]);
    expect(sent.primary_intent).toBe("collaborate");
  });

  it("picking the goal it already has does not rewrite the intent columns", async () => {
    db.existing = profile({ primary_intents: ["hire"] });
    await toGoalStep();
    fireEvent.click(screen.getByRole("button", { name: "Hire full-time creative staff" }));
    const sent = await finish();
    expect("primary_intents" in sent).toBe(false);
  });
});

describe("company onboarding: a failed save is reported, not hidden", () => {
  it("shows the error and stays on the page when the update is rejected", async () => {
    db.updateError = { message: "rejected" };
    await toGoalStep();
    fireEvent.click(screen.getByRole("button", { name: "Find freelance talent for projects" }));
    await finish();
    await waitFor(() => expect(db.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Error saving profile", variant: "destructive" })));
    expect(db.navigate).not.toHaveBeenCalled();
  });
});
