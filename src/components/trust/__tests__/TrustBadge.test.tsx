import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrustBadge } from "../TrustBadge";

describe("TrustBadge", () => {
  it("renders exactly one badge, the strongest, when a subject is verified and vouched", () => {
    const { container } = render(<TrustBadge verified vouchCount={5} />);
    const badges = container.querySelectorAll("[data-trust]");
    expect(badges).toHaveLength(1);
    expect(badges[0].getAttribute("data-trust")).toBe("verified");
    expect(container.textContent).toBe("Verified");
    expect(container.textContent).not.toMatch(/vouched/i);
  });

  it("renders the vouched badge with its count when there is no verification", () => {
    const { container } = render(<TrustBadge verified={false} vouchCount={2} />);
    expect(container.querySelectorAll("[data-trust]")).toHaveLength(1);
    expect(container.textContent).toBe("Vouched · 2");
  });

  it("renders nothing when the subject holds no trust state", () => {
    const { container } = render(<TrustBadge verified={false} vouchCount={0} />);
    expect(container.firstChild).toBeNull();
  });
});
