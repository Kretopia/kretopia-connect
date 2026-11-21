// Kreto's settings: the two action switches are the server's own (orch_settings, which the orchestrator reads), a failed
// save keeps the previous setting and says so, memory has its place, and this device's defaults can be reset.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

const world = vi.hoisted(() => ({
  auth: { user: { id: "user-1" } },
  row: null as null | Record<string, unknown>,
  upserts: [] as Array<{ row: Record<string, unknown>; opts: unknown }>,
  upsertError: null as null | { message: string },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => world.auth }));
vi.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: world.row, error: null }) }) }),
      upsert: async (row: Record<string, unknown>, opts: unknown) => {
        world.upserts.push({ row, opts });
        return { error: world.upsertError };
      },
    }),
  },
}));

import { KretoSettings } from "../KretoSettings";

beforeEach(() => {
  world.row = { agents_enabled: true, auto_run_safe: true };
  world.upserts = [];
  world.upsertError = null;
});

const open = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Kreto settings" }));
  return screen.findByRole("switch", { name: "Run your own records without asking" });
};

describe("Kreto settings", () => {
  it("says what always waits for approval, and saves the auto-run switch to the server", async () => {
    render(<KretoSettings onResetDefaults={vi.fn()} />);
    const autoRun = await open();
    expect(screen.getByText(/reaches other people, goes public or involves money always waits for your approval/)).toBeInTheDocument();
    expect(autoRun).toBeChecked();
    fireEvent.click(autoRun);
    await waitFor(() => expect(world.upserts).toHaveLength(1));
    expect(world.upserts[0]).toEqual({ row: { user_id: "user-1", auto_run_safe: false }, opts: { onConflict: "user_id" } });
    expect(autoRun).not.toBeChecked();
  });

  it("with acting switched off, auto-run cannot be changed", async () => {
    world.row = { agents_enabled: false, auto_run_safe: true };
    render(<KretoSettings onResetDefaults={vi.fn()} />);
    expect(await open()).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Let Kreto act for you" })).not.toBeChecked();
  });

  it("a failed save keeps the previous setting and says so", async () => {
    world.upsertError = { message: "denied" };
    render(<KretoSettings onResetDefaults={vi.fn()} />);
    const autoRun = await open();
    fireEvent.click(autoRun);
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn't save. Your previous setting still applies.");
    expect(autoRun).toBeChecked();
  });

  it("a person with no settings row sees the defaults (both on)", async () => {
    world.row = null;
    render(<KretoSettings onResetDefaults={vi.fn()} />);
    expect(await open()).toBeChecked();
    expect(screen.getByRole("switch", { name: "Let Kreto act for you" })).toBeChecked();
  });

  it("links to the memory page and resets this device's defaults", async () => {
    const reset = vi.fn();
    render(<KretoSettings onResetDefaults={reset} />);
    await open();
    expect(screen.getByRole("link", { name: "See and delete what I remember" })).toHaveAttribute("href", "/copilot-memory");
    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Done");
  });

  it("signed out, it says to sign in instead of loading forever", async () => {
    world.auth = { user: null } as never;
    render(<KretoSettings onResetDefaults={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Kreto settings" }));
    expect(await screen.findByText("Sign in to choose what I may do for you.")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Run your own records without asking" })).toBeNull();
    world.auth = { user: { id: "user-1" } };
  });
});
