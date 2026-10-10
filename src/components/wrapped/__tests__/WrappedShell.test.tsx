import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WrappedShell } from "../WrappedShell";
import { WrappedStatus } from "../WrappedStatus";

const shell = (props: { brandFooter?: boolean; eyebrow?: string } = {}) =>
  render(
    <WrappedShell
      titleId="t"
      eyebrow={props.eyebrow ?? "Kretopia · Studio"}
      title={<>Everything in your <span>Studio</span></>}
      status={<WrappedStatus active label="Live" />}
      brandFooter={props.brandFooter}
    >
      <p>content</p>
    </WrappedShell>,
  );

describe("WrappedShell", () => {
  it("is a region named by its heading, with the eyebrow and the status", () => {
    shell();
    expect(screen.getByRole("region", { name: /Everything in your Studio/ })).toBeInTheDocument();
    expect(screen.getByText("Kretopia · Studio")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("wears Kretopia: a quiet K behind the content and the lockup at the foot", () => {
    const { container } = shell();
    expect(container.querySelectorAll('img[src*="kretopia-k-mark"]').length).toBeGreaterThanOrEqual(2);
    const footer = container.querySelector("footer")!;
    expect(footer.querySelector('img[alt="kretopia"]')).toBeInTheDocument();
    // the feature is named once beside the lockup, without repeating the brand
    expect(footer).toHaveTextContent("Studio");
    expect(footer.textContent).not.toMatch(/Kretopia\s*·/);
  });

  it("a page with two panels can keep the lockup for the last one", () => {
    const { container } = shell({ brandFooter: false });
    expect(container.querySelector("footer")).toBeNull();
  });

  it("the K and the lockup are decorative or labelled, never a second heading", () => {
    const { container } = shell();
    expect(container.querySelectorAll("h1,h2,h3")).toHaveLength(1);
  });
});
