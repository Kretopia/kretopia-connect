import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ user: { id: "u1" } as null | { id: string }, load: vi.fn(), draft: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: h.user, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/profile/profileService", () => ({ getProfile: vi.fn() }));
vi.mock("@/lib/thriveCopilot", () => ({ streamCopilot: vi.fn() }));
vi.mock("@/lib/kretoDraft", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/kretoDraft")>()),
  loadPassportContext: (...a: unknown[]) => h.load(...a),
  draftWithKreto: (...a: unknown[]) => h.draft(...a),
}));

import { CollabBriefFields } from "../CollabBriefFields";
import { EMPTY_BRIEF, type BriefValue } from "@/lib/collabBrief";

const PASSPORT = { name: "Ada", headline: null, roles: [], skills: [], location: null, bio: null, credits: [], recentProjects: [], passportUrl: null };

function Harness({ initial = EMPTY_BRIEF, showErrors = false }: { initial?: BriefValue; showErrors?: boolean }) {
  const [value, setValue] = useState(initial);
  return <CollabBriefFields value={value} onChange={setValue} recipient={{ name: "Maya Rios", role: "Singer" }} project={{ title: "Neon Nights" }} showErrors={showErrors} />;
}

const summary = () => screen.getByLabelText(/What the project is/) as HTMLTextAreaElement;
const reason = () => screen.getByLabelText(/Why this collaboration makes sense/) as HTMLTextAreaElement;

beforeEach(() => {
  h.user = { id: "u1" };
  h.load.mockReset().mockResolvedValue(PASSPORT);
  h.draft.mockReset();
});

describe("CollabBriefFields", () => {
  it("has the two required fields", () => {
    render(<Harness />);
    for (const field of [summary(), reason()]) {
      expect(field).toBeRequired();
      expect(field).toHaveAttribute("aria-required", "true");
    }
    expect(screen.getAllByText("At least 40 characters.")).toHaveLength(2);
  });

  it("stays quiet until the person tries to send, then says what is missing, field by field", () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<Harness showErrors />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(summary()).toHaveAttribute("aria-invalid", "true");
    expect(summary().getAttribute("aria-describedby")).toMatch(/-error/);
  });

  it("counts what was written", () => {
    render(<Harness />);
    fireEvent.change(summary(), { target: { value: "Hello   world" } });
    expect(screen.getByText("11/600")).toBeInTheDocument();
  });

  describe("Draft with Kreto", () => {
    it("drafts both fields from the Passport, keeps what the person already wrote as their intent, and leaves them editable", async () => {
      h.draft.mockResolvedValue("PROJECT: A four-minute music video for Maya, shot over two nights in Lisbon.\nWHY: Your handheld night work on Static Bloom is the look she wants.");
      render(<Harness initial={{ summary: "a music video in March", reason: "" }} />);
      fireEvent.click(screen.getByTestId("draft-with-kreto"));
      await waitFor(() => expect(summary().value).toContain("four-minute music video"));

      expect(h.load).toHaveBeenCalledWith("u1");
      const request = h.draft.mock.calls[0][0] as { prompt: string; surface: string };
      expect(request.prompt).toContain("Maya Rios");
      expect(request.prompt).toContain("a music video in March");
      expect(request.prompt).toContain("Neon Nights");
      expect(request.surface).toBe("profile");

      expect(reason().value).toContain("Static Bloom");
      fireEvent.change(reason(), { target: { value: `${reason().value} I also know the city.` } });
      expect(reason().value).toContain("I also know the city.");
    });

    it("lets the person get their own text back", async () => {
      h.draft.mockResolvedValue("PROJECT: Kreto's version of the project.\nWHY: Kreto's version of the reason.");
      render(<Harness initial={{ summary: "my own words about the project", reason: "my own reason" }} />);
      fireEvent.click(screen.getByTestId("draft-with-kreto"));
      await waitFor(() => expect(summary().value).toContain("Kreto's version"));
      fireEvent.click(screen.getByRole("button", { name: /Restore mine/ }));
      expect(summary().value).toBe("my own words about the project");
      expect(reason().value).toBe("my own reason");
    });

    it("shows Kreto's message when it cannot draft, and changes nothing", async () => {
      h.draft.mockRejectedValue(new Error("You've used today's 20/20 for this. Resets at midnight UTC."));
      render(<Harness initial={{ summary: "mine", reason: "" }} />);
      fireEvent.click(screen.getByTestId("draft-with-kreto"));
      expect(await screen.findByRole("alert")).toHaveTextContent("You've used today's 20/20 for this. Resets at midnight UTC.");
      expect(summary().value).toBe("mine");
    });

    it("refuses a draft it cannot read rather than filling half a brief", async () => {
      h.draft.mockResolvedValue("Sure! Here is a friendly brief for you.");
      render(<Harness initial={{ summary: "mine", reason: "" }} />);
      fireEvent.click(screen.getByTestId("draft-with-kreto"));
      expect(await screen.findByRole("alert")).toHaveTextContent(/could not be read/);
      expect(summary().value).toBe("mine");
      expect(reason().value).toBe("");
    });

    it("is unavailable when signed out, while writing by hand still works", () => {
      h.user = null;
      render(<Harness />);
      expect(screen.getByTestId("draft-with-kreto")).toBeDisabled();
      fireEvent.change(summary(), { target: { value: "typed by hand" } });
      expect(summary().value).toBe("typed by hand");
    });
  });
});
