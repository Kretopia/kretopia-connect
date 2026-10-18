import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, editor: false }));

// A thenable query chain: every filter returns the chain, awaiting it yields no rows.
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  for (const m of ["select", "eq", "gte", "order", "limit"]) chain[m] = () => chain;
  chain.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: [], error: null });
  return { supabase: { from: () => chain } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ isEditorOrAdmin: auth.editor }) }));
vi.mock("../MagazineEditor", () => ({ MagazineEditor: () => null }));
vi.mock("../MagazineCarousel", () => ({ MagazineCarousel: () => null }));
vi.mock("@/components/brand/KretoScene", () => ({ KretoScene: () => null }));

import { MagazineWall } from "../MagazineWall";

describe("Spotlight Magazine: the publish call to action", () => {
  it("is the canonical solid primary CTA, not a translucent glass pill", async () => {
    render(<MagazineWall />);
    const cta = await screen.findByRole("button", { name: "Publish your story" });
    // .cta-solid is the flat high-contrast fill (src/index.css); bg-primary / text-primary-foreground carry the theme tokens
    expect(cta).toHaveClass("cta-solid", "bg-primary", "text-primary-foreground");
    await waitFor(() => expect(screen.getByText(/stories? on the wall|Loading the stories/)).toBeInTheDocument());
  });

  it("says Write for editors and keeps the same solid style", async () => {
    auth.editor = true;
    render(<MagazineWall />);
    const cta = await screen.findByRole("button", { name: "Write" });
    expect(cta).toHaveClass("cta-solid");
    auth.editor = false;
  });
});
