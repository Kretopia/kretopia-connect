import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PassportKretoEntry } from "../PassportKretoEntry";
import { KRETO_SCENES } from "@/components/brand/kretoScenes";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";

describe("PassportKretoEntry", () => {
  it("shows the Kreto image of the Passport scene in the same 40px box the K-mark had", () => {
    const { container } = render(<PassportKretoEntry />);
    expect(screen.getByText("Your Executive Producer")).toBeInTheDocument();

    const imgs = Array.from(container.querySelectorAll("img"));
    const scene = imgs.find((i) => i.getAttribute("src") === (KRETO_SCENES.passport.thumb ?? KRETO_SCENES.passport).src);
    expect(scene).toBeDefined();
    expect(scene!.className).toContain("h-10");
    expect(scene!.className).toContain("w-10");
    expect(imgs.some((i) => i.getAttribute("src") === kMarkAsset.url)).toBe(false);
  });
});
