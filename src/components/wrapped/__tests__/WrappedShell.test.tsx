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

  it("wears Kretopia with the real K and wordmark at the foot, and no cropped fragment of it", () => {
    const { container } = shell();
    // one K, the one in the lockup: no large faded K cut off by the panel's edge
    expect(container.querySelectorAll('img[src*="kretopia-k-mark"]')).toHaveLength(1);
    expect(container.querySelector("img.absolute")).toBeNull();
    const footer = container.querySelector("footer")!;
    expect(footer.querySelector('img[alt="kretopia"]')).toBeInTheDocument();
    // the feature is named once beside the lockup, without repeating the brand
    expect(footer).toHaveTextContent("Studio");
    expect(footer.textContent).not.toMatch(/Kretopia\s*·/);
  });

  it("has no status line when it has nothing true to say", () => {
    render(
      <WrappedShell titleId="t2" eyebrow="Kretopia · Perks" title="Everything in Perks">
        <p>content</p>
      </WrappedShell>,
    );
    expect(screen.getByRole("region", { name: "Everything in Perks" }).querySelector("header p + h2 + p")).toBeNull();
  });

  it("hideTitle keeps the heading as the panel's name for screen readers but does not draw it", () => {
    render(
      <WrappedShell titleId="t3" eyebrow="Kretopia · Spotlight" title="Everything in Spotlight" hideTitle>
        <p>content</p>
      </WrappedShell>,
    );
    const region = screen.getByRole("region", { name: "Everything in Spotlight" });
    expect(region.querySelector("h2")).toHaveClass("sr-only");
    expect(screen.getByText("Kretopia · Spotlight")).toBeInTheDocument();
  });

  it("draws the heading by default", () => {
    shell();
    expect(screen.getByRole("heading", { level: 2 })).not.toHaveClass("sr-only");
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
