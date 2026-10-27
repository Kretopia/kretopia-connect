import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AccountSwitcher } from "@/components/AccountSwitcher";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => ({ updateAccountType: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : () => chain),
    apply: () => chain,
  });
  return { supabase: { from: () => chain, rpc: () => chain } };
});

describe("AccountSwitcher in Settings", () => {
  it("keeps the Switch button and the toggle at full size beside text that may wrap", () => {
    render(
      <MemoryRouter>
        <AccountSwitcher currentAccountType="individual" variant="settings" />
      </MemoryRouter>,
    );
    const switchButton = screen.getByRole("button", { name: "Switch" });
    // As a whole class (the button's own base class has an svg-scoped shrink-0 that must not count).
    expect(switchButton.classList.contains("shrink-0")).toBe(true);
    const row = switchButton.parentElement as HTMLElement;
    expect(row.className).toContain("gap-3");
    expect((row.firstElementChild as HTMLElement).className).toContain("min-w-0");
    expect(screen.getByRole("switch").classList.contains("shrink-0")).toBe(true);
    expect(screen.getByText("Currently: Personal Creator")).toBeInTheDocument();
  });
});
