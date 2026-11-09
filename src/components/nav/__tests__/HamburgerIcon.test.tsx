import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HamburgerIcon } from "../HamburgerIcon";
import { NAV_ICON_STROKE } from "../navIcon";

const draw = (props: React.ComponentProps<typeof HamburgerIcon> = {}) => render(<HamburgerIcon {...props} />).container.querySelector("svg") as SVGElement;

describe("HamburgerIcon", () => {
  it("is three bars of one length, evenly spaced, in the stroke of the icons beside it", () => {
    const svg = draw();
    const bars = [...svg.querySelectorAll("line")];
    expect(bars).toHaveLength(3);
    const lengths = bars.map((bar) => Number(bar.getAttribute("x2")) - Number(bar.getAttribute("x1")));
    expect(new Set(lengths).size).toBe(1);
    const ys = bars.map((bar) => Number(bar.getAttribute("y1")));
    expect(ys[1] - ys[0]).toBe(ys[2] - ys[1]);
    for (const bar of bars) expect(bar.getAttribute("y1")).toBe(bar.getAttribute("y2"));
    expect(svg.getAttribute("stroke-width")).toBe(String(NAV_ICON_STROKE));
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
  });

  it("has the bars the CSS animates: a top, a middle and a bottom", () => {
    const svg = draw();
    for (const part of ["top", "mid", "bot"]) expect(svg.querySelector(`.k-burger-bar.k-burger-${part}`)).not.toBeNull();
  });

  it("says it is open only when it is: the X is state, not hover", () => {
    expect(draw()).not.toHaveAttribute("data-open");
    expect(draw({ open: false })).not.toHaveAttribute("data-open");
    expect(draw({ open: true })).toHaveAttribute("data-open", "true");
  });

  it("is decorative: hidden from assistive technology and not focusable, since the button around it carries the name and the state", () => {
    const svg = draw();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.querySelector("title")).toBeNull();
  });

  it("is drawn at the one size every top bar icon has", () => {
    expect(draw()).toHaveClass("h-4", "w-4");
  });
});
