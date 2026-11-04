import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

const h = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  load: vi.fn(),
  draft: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: h.user, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/lib/profile/profileService", () => ({
  getProfile: vi.fn(),
}));

vi.mock("@/lib/thriveCopilot", () => ({
  streamCopilot: vi.fn(),
}));

vi.mock("@/lib/kretoDraft", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/kretoDraft")>()),
  loadPassportContext: (...args: unknown[]) => h.load(...args),
  draftWithKreto: (...args: unknown[]) => h.draft(...args),
}));

vi.mock("@/components/opportunity/BookmarkButton", () => ({
  BookmarkButton: () => <button type="button">Bookmark opportunity</button>,
}));

vi.mock("@/components/opportunity/EasyApplyButton", () => ({
  EasyApplyButton: () => <button type="button">Easy Apply</button>,
}));

import { ScoutGigCard } from "../ScoutGigCard";

type HybridProps = ComponentProps<typeof ScoutGigCard>;

const PASSPORT = {
  name: "Ada",
  headline: null,
  roles: ["Cinematographer"],
  skills: ["Handheld", "Night exteriors"],
  location: null,
  bio: "Shoots.",
  credits: [{
    title: "Static Bloom",
    role: "DoP",
    year: 2025,
    type: "Music video",
    client: null,
    evidence: "verified" as const,
    summary: null,
  }],
  recentProjects: [],
  passportUrl: null,
};

const base = (changes: Partial<HybridProps> = {}): HybridProps => ({
  title: "Mixing engineer",
  company: "Northline Records",
  image: "/scout-cover.webp",
  href: "/opportunity/1",
  pay: "$800",
  location: "Porto",
  origin: "external",
  sourceName: "Creative Jobs",
  excerpt: "Mix a four-track EP. Two days in Porto.",
  testId: "card",
  ...changes,
});

const renderCard = (changes: Partial<HybridProps> = {}) =>
  render(
    <MemoryRouter>
      <ScoutGigCard {...base(changes)} />
    </MemoryRouter>
  );

const card = () => screen.getByTestId("card");

const front = () =>
  card().querySelector<HTMLElement>(".flip-front")!;

const back = () =>
  card().querySelector<HTMLElement>(".flip-back")!;

const quickLook = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Quick look" })
  );

const openDraft = () => {
  quickLook();
  fireEvent.click(
    screen.getByTestId("apply-with-kreto-open")
  );
};

beforeEach(() => {
  h.user = { id: "u1" };
  h.load.mockReset().mockResolvedValue(PASSPORT);
  h.draft.mockReset();
});

describe("Scout Hybrid V4 — recto", () => {
  it("conserve la structure Hybrid V4 approuvée", () => {
    renderCard();
    expect(card()).toHaveClass("scout-v4");
    expect(card().querySelector(".holo")).not.toBeNull();
    expect(card().querySelector(".tilt-shell")).not.toBeNull();
    expect(card().querySelector(".flip-inner")).not.toBeNull();
    expect(card().querySelector(".prismatic-edge")).not.toBeNull();
    expect(card().querySelector(".foil-light")).not.toBeNull();
  });

  it("affiche titre, organisation et localisation réels", () => {
    renderCard();
    expect(within(front()).getByText("Mixing engineer")).toBeInTheDocument();
    expect(within(front()).getByText("Northline Records")).toBeInTheDocument();
    expect(within(front()).getByText("Porto")).toBeInTheDocument();
  });

  it("ne présente pas une rémunération absente comme confirmée", () => {
    renderCard({ pay: null });
    expect(front()).toHaveTextContent("Pay not listed");
    expect(back()).toHaveTextContent("Pay not listed");
  });

  it("utilise l'image de l'opportunité lorsqu'elle existe", () => {
    renderCard();
    const image = card().querySelector<HTMLImageElement>(".cover img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", "/scout-cover.webp");
  });

  it("présente un visuel de remplacement sans image", () => {
    renderCard({ image: null, familyLabel: "Music" });
    expect(card().querySelector(".scout-v4__fallback")).not.toBeNull();
    expect(card().querySelector(".cover img")).toBeNull();
  });

  it("remplace une image qui échoue à charger", () => {
    renderCard();
    const image = card().querySelector<HTMLImageElement>(".cover img")!;
    fireEvent.error(image);
    expect(card().querySelector(".scout-v4__fallback")).not.toBeNull();
  });

  it("identifie les annonces provenant de Kretopia", () => {
    renderCard({ origin: "kretopia" });
    expect(front()).toHaveTextContent("Kretopia");
  });

  it("conserve le lien interne vers l'opportunité", () => {
    renderCard();
    expect(
      within(front()).getByRole("link", { name: "Mixing engineer" })
    ).toHaveAttribute("href", "/opportunity/1");
  });

  it("ouvre une source externe dans un nouvel onglet sécurisé", () => {
    renderCard({ href: "https://jobs.example/item" });
    const link = within(front()).getByRole("link", {
      name: "Mixing engineer",
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("respecte l'action de détail fournie par le parent", () => {
    const onOpen = vi.fn();
    renderCard({ href: undefined, onOpen });
    fireEvent.click(
      within(front()).getByRole("button", {
        name: "Mixing engineer",
      })
    );
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("conserve Easy Apply et Bookmark pour une annonce interne", () => {
    renderCard({
      origin: "kretopia",
      internalOpportunityId: "opportunity-1",
    });
    expect(
      within(front()).getByRole("button", { name: "Easy Apply" })
    ).toBeInTheDocument();
    expect(
      within(front()).getByRole("button", {
        name: "Bookmark opportunity",
      })
    ).toBeInTheDocument();
  });

  it("n'affiche pas Easy Apply interne sur une source externe", () => {
    renderCard({ origin: "external", internalOpportunityId: undefined });
    expect(
      within(front()).queryByRole("button", { name: "Easy Apply" })
    ).toBeNull();
  });
});

describe("Scout Hybrid V4 — Quick Look et accessibilité", () => {
  it("ouvre le verso sans quitter la carte", () => {
    renderCard();
    quickLook();
    expect(card().querySelector(".flip-card")).toHaveClass("is-flipped");
  });

  it("marque la face inactive pour les technologies d'assistance", () => {
    renderCard();
    expect(front()).toHaveAttribute("aria-hidden", "false");
    expect(back()).toHaveAttribute("aria-hidden", "true");
    expect(back().hasAttribute("inert")).toBe(true);

    quickLook();

    expect(front()).toHaveAttribute("aria-hidden", "true");
    expect(back()).toHaveAttribute("aria-hidden", "false");
    expect(front().hasAttribute("inert")).toBe(true);
    expect(back().hasAttribute("inert")).toBe(false);
  });

  it("déplace le focus vers le retour lors du basculement", () => {
    renderCard();
    quickLook();
    expect(document.activeElement).toBe(
      within(back()).getByRole("button", { name: "Flip back" })
    );
  });

  it("permet de revenir au recto avec Escape", () => {
    renderCard();
    quickLook();
    fireEvent.keyDown(
      card().querySelector("article")!,
      { key: "Escape" }
    );
    expect(card().querySelector(".flip-card")).not.toHaveClass("is-flipped");
  });

  it("permet de revenir au recto avec le bouton", () => {
    renderCard();
    quickLook();
    fireEvent.click(
      within(back()).getByRole("button", { name: "Flip back" })
    );
    expect(card().querySelector(".flip-card")).not.toHaveClass("is-flipped");
  });

  it("conserve les informations du brief au verso", () => {
    renderCard();
    quickLook();
    expect(back()).toHaveTextContent("Mix a four-track EP.");
    expect(back()).toHaveTextContent("Two days in Porto.");
  });

  it("conserve les informations supplémentaires de l'annonce", () => {
    render(
      <MemoryRouter>
        <ScoutGigCard {...base()}>
          <p>Also posted for two more places</p>
        </ScoutGigCard>
      </MemoryRouter>
    );
    quickLook();
    expect(back()).toHaveTextContent(
      "Also posted for two more places"
    );
    expect(front()).not.toHaveTextContent(
      "Also posted for two more places"
    );
  });

  it("conserve les éléments de preuve au verso", () => {
    renderCard({
      evidence: <span>Verified professional credit</span>,
    });
    quickLook();
    expect(back()).toHaveTextContent(
      "Verified professional credit"
    );
    expect(front()).not.toHaveTextContent(
      "Verified professional credit"
    );
  });

  it("conserve les actions transmises par la liste au verso", () => {
    renderCard({
      footer: <button type="button">Apply at source</button>,
    });
    quickLook();
    expect(
      within(back()).getByRole("button", {
        name: "Apply at source",
      })
    ).toBeInTheDocument();
  });
});

describe("Scout Hybrid V4 — Apply with Kreto", () => {
  it("ouvre la rédaction au verso, sans modifier le recto", () => {
    renderCard();
    openDraft();

    expect(card().querySelector(".flip-card")).toHaveClass("is-flipped");
    expect(screen.getByTestId("apply-with-kreto")).toBeInTheDocument();
    expect(front()).toHaveTextContent("Mixing engineer");
  });

  it("propose un brouillon éditable sans envoyer de candidature", () => {
    renderCard();
    openDraft();
    expect(
      screen.getByRole("textbox", { name: "Your application draft" })
    ).toBeEnabled();
    expect(screen.getByTestId("apply-with-kreto")).toHaveTextContent(
      "nothing is sent from here"
    );
  });

  it("construit une rédaction à partir de l'annonce et du Passport", async () => {
    h.draft.mockResolvedValue("I worked on Static Bloom.");
    renderCard();
    openDraft();

    fireEvent.change(
      screen.getByLabelText(/Anything to emphasise/),
      { target: { value: "Available in March" } }
    );

    fireEvent.click(screen.getByTestId("kreto-draft-application"));

    expect(
      await screen.findByDisplayValue("I worked on Static Bloom.")
    ).toBeInTheDocument();

    expect(h.load).toHaveBeenCalledWith("u1");

    const request = h.draft.mock.calls[0][0] as {
      prompt: string;
      surface: string;
    };

    expect(request.surface).toBe("gigs");
    expect(request.prompt).toContain("Mixing engineer");
    expect(request.prompt).toContain("Static Bloom");
    expect(request.prompt).toContain("Available in March");
  });

  it("préserve la saisie existante lorsqu'une génération échoue", async () => {
    h.draft.mockRejectedValue(
      new Error("Kreto allowance reached.")
    );

    renderCard();
    openDraft();

    const field = screen.getByRole("textbox", {
      name: "Your application draft",
    });

    fireEvent.change(field, {
      target: { value: "My own application text" },
    });

    fireEvent.click(screen.getByTestId("kreto-draft-application"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kreto allowance reached."
    );

    expect(field).toHaveValue("My own application text");
  });

  it("permet de modifier le texte généré", async () => {
    h.draft.mockResolvedValue("Initial draft");
    renderCard();
    openDraft();
    fireEvent.click(screen.getByTestId("kreto-draft-application"));

    const field = await screen.findByDisplayValue("Initial draft");

    fireEvent.change(field, {
      target: { value: "Edited application" },
    });

    expect(field).toHaveValue("Edited application");
  });

  it("permet de conserver le brouillon dans l'état du parent", () => {
    const onChange = vi.fn();

    renderCard({
      draft: {
        value: "Kept in parent",
        onChange,
      },
    });

    openDraft();

    const field = screen.getByRole("textbox", {
      name: "Your application draft",
    });

    expect(field).toHaveValue("Kept in parent");

    fireEvent.change(field, {
      target: { value: "New parent text" },
    });

    expect(onChange).toHaveBeenCalledWith("New parent text");
  });

  it("permet de copier le brouillon à la demande", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderCard({
      draft: {
        value: "My application draft",
        onChange: vi.fn(),
      },
    });

    openDraft();

    fireEvent.click(
      screen.getByRole("button", { name: "Copy" })
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("My application draft")
    );
  });

  it("ne permet pas de copier un brouillon vide", () => {
    renderCard();
    openDraft();
    expect(
      screen.getByRole("button", { name: "Copy" })
    ).toBeDisabled();
  });

  it("autorise une rédaction manuelle sans compte connecté", () => {
    h.user = null;
    renderCard();
    openDraft();

    expect(screen.queryByTestId("kreto-draft-application")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Sign in" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: "Your application draft",
      })
    ).toBeEnabled();
  });

  it("revient au brief depuis le mode rédaction", () => {
    renderCard();
    openDraft();

    fireEvent.click(
      within(back()).getByRole("button", { name: "Brief" })
    );

    expect(back()).toHaveTextContent("Quick preview");
    expect(back()).toHaveTextContent("Mix a four-track EP.");
    expect(screen.queryByTestId("apply-with-kreto")).toBeNull();
  });

  it("peut revenir directement au recto depuis la rédaction", () => {
    renderCard();
    openDraft();

    fireEvent.click(
      within(back()).getByRole("button", { name: "Flip back" })
    );

    expect(card().querySelector(".flip-card")).not.toHaveClass("is-flipped");
  });
});


describe("Scout Hybrid V4 — deferred external description", () => {
  it("does not fetch on mount or Quick Look", () => {
    const load = vi.fn().mockResolvedValue("Full description");

    renderCard({ loadOpportunityDescription: load });

    expect(load).not.toHaveBeenCalled();

    quickLook();

    expect(load).not.toHaveBeenCalled();
  });

  it("uses the full stored text when Apply with Kreto is opened", async () => {
    const load = vi.fn().mockResolvedValue(
      "FULL LISTING: record vocals and deliver three mastered tracks."
    );

    h.draft.mockResolvedValue("Generated application");

    renderCard({
      loadOpportunityDescription: load,
      opportunity: {
        title: "Mixing engineer",
        description: "Short summary only.",
      },
    });

    quickLook();

    fireEvent.click(
      screen.getByTestId("apply-with-kreto-open")
    );

    // The loader is invoked in a Promise microtask.
    // Wait for that microtask before asserting the call.
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByTestId("apply-with-kreto")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId("kreto-draft-application")
    );

    await waitFor(() => {
      expect(h.draft).toHaveBeenCalledTimes(1);
    });

    const request = h.draft.mock.calls[0][0] as {
      prompt: string;
    };

    expect(request.prompt).toContain(
      "FULL LISTING: record vocals"
    );

    expect(request.prompt).not.toContain(
      "Short summary only."
    );
  });

  it("falls back to the summary without retrying a failed fetch", async () => {
    const load = vi.fn().mockRejectedValue(
      new Error("Stored description unavailable")
    );

    h.draft.mockResolvedValue("Generated from the summary");

    renderCard({
      loadOpportunityDescription: load,
      opportunity: {
        title: "Mixing engineer",
        description: "Known public summary.",
      },
    });

    quickLook();

    fireEvent.click(
      screen.getByTestId("apply-with-kreto-open")
    );

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByTestId("apply-with-kreto")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Full listing text is not available/)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId("kreto-draft-application")
    );

    await waitFor(() => {
      expect(h.draft).toHaveBeenCalledTimes(1);
    });

    expect(h.draft.mock.calls[0][0].prompt).toContain(
      "Known public summary."
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Brief" })
    );

    fireEvent.click(
      screen.getByTestId("apply-with-kreto-open")
    );

    expect(load).toHaveBeenCalledTimes(1);
  });
});
