import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordStrengthIndicator } from "../PasswordStrengthIndicator";
import { SIGNUP_PASSWORD_RULES } from "@/lib/passwordPolicy";

const labels = (container: HTMLElement) => [...container.querySelectorAll(".text-xs span")].map((node) => node.textContent);
const segments = (container: HTMLElement) => container.querySelectorAll(".h-1.flex-1");

describe("PasswordStrengthIndicator", () => {
  it("lists the general rules unless it is given others, so the password-reset form is as it was", () => {
    const { container } = render(<PasswordStrengthIndicator password="Summer2024" />);
    expect(labels(container)).toEqual(["At least 8 characters", "Contains uppercase letter", "Contains lowercase letter", "Contains number"]);
    expect(segments(container)).toHaveLength(4);
  });

  it("lists the rules it is given and counts its bar by them: sign-up's five, not four", () => {
    const { container } = render(<PasswordStrengthIndicator password="Summer2024" rules={SIGNUP_PASSWORD_RULES} />);
    expect(labels(container)).toEqual(SIGNUP_PASSWORD_RULES.map((rule) => rule.label));
    expect(segments(container)).toHaveLength(SIGNUP_PASSWORD_RULES.length);
  });

  it("is green only when every listed rule is met", () => {
    const green = (password: string) => {
      const { container, unmount } = render(<PasswordStrengthIndicator password={password} rules={SIGNUP_PASSWORD_RULES} />);
      const all = [...segments(container)].every((segment) => segment.className.includes("bg-green-500"));
      unmount();
      return all;
    };
    expect(green("Summer2024")).toBe(false);
    expect(green("Summer-2024-Night")).toBe(true);
  });
});
