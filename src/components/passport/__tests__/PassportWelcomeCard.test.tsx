import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PassportWelcomeCard } from "../PassportWelcomeCard";

const source = (path: string) => readFileSync(resolve(__dirname, "../../../..", path), "utf8");

describe("the congratulations after onboarding", () => {
  it("congratulates the member by first name, in Kreto's identity, with static copy", () => {
    render(<PassportWelcomeCard firstName=" Alex " onTour={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Congratulations, Alex." })).toBeInTheDocument();
    expect(screen.getByText(/Your Creative Passport is live/)).toBeInTheDocument();
    // The K-mark: Kreto's brand mark, not a portrait or a generic AI icon.
    expect(screen.getByTestId("passport-welcome").querySelector("img")).not.toBeNull();
  });

  it("does not invent a name", () => {
    render(<PassportWelcomeCard firstName={null} onTour={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Congratulations." })).toBeInTheDocument();
  });

  it("offers the tour without forcing it, and can be dismissed", () => {
    const onTour = vi.fn();
    const onDismiss = vi.fn();
    render(<PassportWelcomeCard firstName="Alex" onTour={onTour} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Take the quick tour" }));
    expect(onTour).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("the hand-over from onboarding to the Passport", () => {
  it("is asked for once, by the end of onboarding only, and cleared after it is read", () => {
    const onboarding = source("src/pages/Onboarding.tsx");
    // Only the completion path asks for it: the email-verified redirect and the "already completed" redirect do not.
    expect(onboarding.match(/passportWelcome: true/g)).toHaveLength(1);
    const completion = onboarding.indexOf("state: { passportWelcome: true }");
    expect(onboarding.lastIndexOf("onboarding_completed: true", completion)).toBeGreaterThan(-1);

    const profile = source("src/pages/Profile.tsx");
    expect(profile).toContain("<PassportWelcomeCard");
    expect(profile).toMatch(/navigate\(location\.pathname \+ location\.search, \{ replace: true, state: null \}\)/);
    // The existing tutorial is reused for the tour, so it is the same one the header replays.
    expect(profile).toMatch(/<FeatureTutorialDialogContent[^>]*steps=\{PASSPORT_TUTORIAL\}/);
  });
});
