import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExternalLink, X } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/profile/profileService", () => ({ getProfile: vi.fn() }));
vi.mock("@/lib/thriveCopilot", () => ({ streamCopilot: vi.fn() }));

import { expectWithinBudget } from "@/test/cardBudget";
import { CardIconButton } from "@/components/cards/CardShell";
import { ScoutGigCard, ScoutPill, ScoutSaveButton } from "../ScoutGigCard";

const LONG = "Senior motion designer for a very large, very long-running, multi-territory broadcast identity programme ".repeat(5);

// The opportunity variant, given far more than a card can hold: a huge title, seven tags, a long description and provenance, two cover
// controls beside Save, and an "also posted" block. The budget is the shell's, so the variant only has to hand everything over.
const stuffed = () => (
  <MemoryRouter>
    <ScoutGigCard
      testId="card"
      title={LONG}
      company="Northline Records"
      art={{ title: "Motion designer" }}
      href="/opportunity/1"
      pills={<><ScoutPill tone="origin">Scouted</ScoutPill><ScoutPill>External · Unclaimed</ScoutPill></>}
      save={<ScoutSaveButton saved={false} label="Save it" onToggle={vi.fn()} />}
      utility={<>
        <CardIconButton action={{ icon: <ExternalLink aria-hidden />, label: "Open source", href: "https://jobs.example/1" }} />
        <CardIconButton action={{ icon: <X aria-hidden />, label: "Dismiss", onClick: vi.fn() }} />
      </>}
      pay="$800"
      location="Porto"
      tags={<>{["a", "b", "c", "d", "e", "f", "g"].map((t) => <ScoutPill key={t}>{`tag ${t}`}</ScoutPill>)}</>}
      evidence={<p>{LONG}</p>}
      trust={<span>{LONG}</span>}
      apply={{ label: "Apply", to: "/opportunity/1" }}
      brief={{ text: LONG }}
      details={[{ label: "Company", value: "Northline Records" }]}
      opportunity={{ title: "Motion designer", company: "Northline Records", description: LONG }}
    >
      <p>Also posted for 2 more places</p>
    </ScoutGigCard>
  </MemoryRouter>
);

describe("the opportunity card keeps to the card budget", () => {
  it("whatever a surface hands it", () => {
    render(stuffed());
    expectWithinBudget(screen.getByTestId("card"));
  });

  it("draws the pay chip first and three tags in all", () => {
    render(stuffed());
    const tags = screen.getByTestId("card").querySelector<HTMLElement>('[data-card-part="tags"]')!;
    expect(tags.children).toHaveLength(3);
    expect(tags.children[0]).toHaveTextContent("$800");
    expect(tags).toHaveTextContent("tag a");
    expect(tags).toHaveTextContent("tag b");
    expect(tags).not.toHaveTextContent("tag c");
  });

  it("keeps the controls over the picture and Quick look the only secondary action in the footer", () => {
    render(stuffed());
    const cardEl = screen.getByTestId("card");
    const footer = cardEl.querySelector<HTMLElement>('[data-card-part="footer"]')!;
    const cover = cardEl.querySelector<HTMLElement>('[data-card-part="cover"]')!;
    expect(within(cover).getByRole("button", { name: "Save it" })).toBeInTheDocument();
    expect(within(cover).getByRole("link", { name: "Open source" })).toBeInTheDocument();
    expect(within(cover).getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(within(footer).getByTestId("quick-look")).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: /Apply/ })).toBeInTheDocument();
    expect(within(footer).queryByText("Apply with Kreto")).toBeNull();
  });

  it("puts the long text, Kreto and the extra places on the back, never on the front", () => {
    render(stuffed());
    expect(screen.queryByText("Also posted for 2 more places")).toBeNull();
    expect(screen.queryByTestId("apply-with-kreto-open")).toBeNull();
    fireEvent.click(screen.getByTestId("quick-look"));
    const back = screen.getByRole("group", { name: /quick look/ });
    expect(within(back).getByText("Also posted for 2 more places")).toBeInTheDocument();
    expect(within(back).getByTestId("apply-with-kreto-open")).toBeInTheDocument();
    expect(within(back).getByTestId("quick-look-brief")).toBeInTheDocument();
  });
});
