import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sparkles } from "lucide-react";

let userId: string | null = "user-a";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: userId ? { id: userId } : null }) }));
vi.mock("@/hooks/useFirstTimeUser", () => ({ useFirstTimeUser: () => ({ isFirstTime: true, loading: false }) }));
vi.mock("../FeatureTutorialDialogContent", async () => {
  const { DialogContent } = await import("@/components/ui/dialog");
  return {
    FeatureTutorialDialogContent: ({ onDismiss }: { onDismiss: () => void }) => (
      <DialogContent aria-describedby={undefined}>
        <button onClick={onDismiss}>close tour</button>
      </DialogContent>
    ),
  };
});

import { FeatureAITutorial } from "../FeatureAITutorial";

const steps = [{ icon: Sparkles, title: "One", body: "Body" }];

describe("FeatureAITutorial", () => {
  beforeEach(() => {
    localStorage.clear();
    userId = "user-a";
  });

  it("opens once for a new member, remembers the dismissal for that member only, and stays replayable", () => {
    const { unmount } = render(<FeatureAITutorial featureKey="passport" label="How Passport works" steps={steps} />);
    fireEvent.click(screen.getByText("close tour"));
    expect(localStorage.getItem("kretopia-tutorial-seen:passport:user-a")).toBe("1");
    unmount();

    // Same member again: no auto-open, but the trigger still replays it.
    render(<FeatureAITutorial featureKey="passport" label="How Passport works" steps={steps} />);
    expect(screen.queryByText("close tour")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /How this works/i }));
    expect(screen.getByText("close tour")).toBeInTheDocument();
  });

  it("a second account on the same device still gets its own first tour", () => {
    localStorage.setItem("kretopia-tutorial-seen:passport:user-a", "1");
    userId = "user-b";
    render(<FeatureAITutorial featureKey="passport" label="How Passport works" steps={steps} />);
    expect(screen.getByText("close tour")).toBeInTheDocument();
  });

  it("does not auto-open for a visitor who is not signed in", () => {
    userId = null;
    render(<FeatureAITutorial featureKey="passport" label="How Passport works" steps={steps} />);
    expect(screen.queryByText("close tour")).not.toBeInTheDocument();
  });
});
