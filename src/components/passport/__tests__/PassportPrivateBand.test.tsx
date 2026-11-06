import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PassportPrivateBand } from "../PassportPrivateBand";

describe("PassportPrivateBand", () => {
  it("is a region named for what it is, with the label the owner reads", () => {
    render(<PassportPrivateBand><p>one</p></PassportPrivateBand>);
    const band = screen.getByRole("region", { name: "Only you see this" });
    expect(within(band).getByText("Only you see this")).toBeInTheDocument();
    expect(band.className).toContain("border-dashed");
  });

  it("lays its blocks out side by side, up to three, and one under the other on a phone", () => {
    render(<PassportPrivateBand><p>one</p><p>two</p><p>three</p></PassportPrivateBand>);
    const grid = screen.getByText("one").parentElement as HTMLElement;
    expect(grid.className).toContain("lg:grid-cols-3");
    expect(grid.className).toContain("md:grid-cols-2");
    // grid-cols-1 is the default: nothing forces columns on a phone
    expect(grid.className).not.toMatch(/(^|\s)grid-cols-[2-9]/);
    expect(within(grid).getAllByText(/one|two|three/)).toHaveLength(3);
  });

  it("lets its blocks shrink to the column: a grid item will not do it by itself, and the frame clips what overflows", () => {
    render(<PassportPrivateBand><p>one</p></PassportPrivateBand>);
    expect((screen.getByText("one").parentElement as HTMLElement).className).toContain("[&>*]:min-w-0");
  });

  it("does not stretch short blocks to the height of tall ones", () => {
    render(<PassportPrivateBand><p>one</p></PassportPrivateBand>);
    expect((screen.getByText("one").parentElement as HTMLElement).className).toContain("items-start");
  });
});
