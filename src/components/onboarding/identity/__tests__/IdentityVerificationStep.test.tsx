import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IdentityStatus } from "@/lib/identity/identityVerification";
import { IdentityVerificationStep, type IdentityVerificationStepProps } from "../IdentityVerificationStep";

const OPEN = { collection: true, requiredForOnboarding: false };
const CONSENT = <p>We compare a photo of your face with your profile photo. It is kept for 30 days.</p>;
const getUserMedia = vi.fn();

beforeEach(() => {
  getUserMedia.mockReset();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
});
afterEach(() => Reflect.deleteProperty(navigator, "mediaDevices"));

const setup = (props: Partial<IdentityVerificationStepProps> & { status: IdentityStatus }) => {
  const handlers = { onStart: vi.fn(), onResume: vi.fn(), onRetry: vi.fn(), onRefresh: vi.fn(), onContinue: vi.fn(), onRequestManualReview: vi.fn() };
  const view = render(<IdentityVerificationStep {...handlers} {...props} />);
  return { ...handlers, ...view };
};
const agree = () => fireEvent.click(screen.getByRole("checkbox", { name: /I have read this and agree/ }));

describe("while collection is off (today)", () => {
  it.each(["not_started", "failed", "cancelled", "expired"] as const)("says verification is not open and offers no way to start, for %s", (status) => {
    setup({ status });
    expect(screen.getByRole("heading", { level: 2, name: "Identity verification isn't open yet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start|Resume|Try again/ })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    // the member can carry on
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  it("is a Kretopia card: the K mark, the Identity eyebrow and the shared modal surface", () => {
    const { container } = setup({ status: "not_started" });
    const card = container.querySelector("section") as HTMLElement;
    expect(card).toHaveClass("border-energy/30", "bg-card", "shadow-glow");
    expect(screen.getByText("Kretopia · Identity")).toBeInTheDocument();
    expect(card.querySelector("img")).not.toBeNull();
  });
});

describe("when collection is open", () => {
  it("cannot start without approved consent text: it says why and starts nothing", () => {
    const { onStart } = setup({ status: "not_started", policy: OPEN });
    expect(screen.getByText(/Consent terms are not set up/)).toBeInTheDocument();
    const start = screen.getByRole("button", { name: "Start verification" });
    expect(start).toBeDisabled();
    fireEvent.click(start);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("starts only after the member has read the consent text and agreed, and only by their own press", () => {
    const { onStart } = setup({ status: "not_started", policy: OPEN, consent: CONSENT });
    expect(screen.getByText(/kept for 30 days/)).toBeInTheDocument();
    const start = screen.getByRole("button", { name: "Start verification" });
    expect(start).toBeDisabled();
    agree();
    expect(start).toBeEnabled();
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("is disabled while busy", () => {
    setup({ status: "not_started", policy: OPEN, consent: CONSENT, busy: true });
    agree();
    expect(screen.getByRole("button", { name: "Start verification" })).toBeDisabled();
  });

  it("failed: says why in plain words and offers a retry that also needs consent", () => {
    const { onRetry } = setup({ status: "failed", policy: OPEN, consent: CONSENT, reason: "unclear_image" });
    expect(screen.getByRole("heading", { name: "We couldn't verify your identity" })).toBeInTheDocument();
    expect(screen.getByText("The photo was not clear enough to check.")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toBeDisabled();
    agree();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("failed with a code it does not know: a generic sentence, never the raw code", () => {
    setup({ status: "failed", policy: OPEN, consent: CONSENT, reason: "xyz_internal_code" });
    expect(screen.getByText("We could not complete the check.")).toBeInTheDocument();
    expect(screen.queryByText(/xyz_internal_code/)).toBeNull();
  });

  it("cancelled can be resumed, and expired started again", () => {
    const resume = setup({ status: "cancelled", policy: OPEN, consent: CONSENT });
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Resume verification" }));
    expect(resume.onResume).toHaveBeenCalledTimes(1);
    resume.unmount();

    const again = setup({ status: "expired", policy: OPEN, consent: CONSENT });
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Start again" }));
    expect(again.onStart).toHaveBeenCalledTimes(1);
  });

  it("offers the accessible alternative only where there is one, and never behind consent", () => {
    const without = setup({ status: "not_started", policy: OPEN, consent: CONSENT, onRequestManualReview: undefined });
    expect(screen.queryByRole("button", { name: "I can't use a camera" })).toBeNull();
    without.unmount();
    const withIt = setup({ status: "not_started", policy: OPEN, consent: CONSENT });
    fireEvent.click(screen.getByRole("button", { name: "I can't use a camera" }));
    expect(withIt.onRequestManualReview).toHaveBeenCalledTimes(1);
  });

  it("hides 'Not now' only where onboarding is gated and the member holds no exception", () => {
    setup({ status: "not_started", policy: OPEN, consent: CONSENT, canSkip: false });
    expect(screen.queryByRole("button", { name: "Not now" })).toBeNull();
  });
});

describe("pending and verified", () => {
  it("pending: waits, can refresh, and asks for nothing", () => {
    const { onRefresh } = setup({ status: "pending", policy: OPEN });
    expect(screen.getByRole("heading", { name: "We're checking your verification" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("verified: says so, once, and lets the member continue", () => {
    const { onContinue, container } = setup({ status: "verified" });
    expect(screen.getByRole("heading", { name: "Identity verified" })).toBeInTheDocument();
    expect(container.querySelector("section")).toHaveAttribute("data-identity-status", "verified");
    expect(screen.queryByRole("button", { name: /Start|Resume|Try again/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("verified still offers Continue when skipping is not allowed", () => {
    setup({ status: "verified", canSkip: false });
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});

describe("what it never does", () => {
  const STATUSES: IdentityStatus[] = ["not_started", "pending", "verified", "failed", "cancelled", "expired"];

  it("says 'Identity verified' for the server's verified status and for nothing else", () => {
    for (const status of STATUSES) {
      for (const policy of [undefined, OPEN]) {
        const { unmount } = setup({ status, policy, consent: CONSENT });
        expect(!!screen.queryByText("Identity verified")).toBe(status === "verified");
        unmount();
      }
    }
  });

  it("keeps identity apart from credit verification: no word about credits", () => {
    for (const status of STATUSES) {
      const { container, unmount } = setup({ status, policy: OPEN, consent: CONSENT });
      expect(container.textContent).not.toMatch(/credit/i);
      unmount();
    }
  });

  it("never opens the camera, whatever state it is in and whatever is pressed", () => {
    for (const status of STATUSES) {
      const { unmount } = setup({ status, policy: OPEN, consent: CONSENT });
      for (const checkbox of screen.queryAllByRole("checkbox")) fireEvent.click(checkbox);
      for (const button of screen.queryAllByRole("button")) fireEvent.click(button);
      unmount();
    }
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
