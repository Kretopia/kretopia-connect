import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KretoScene } from "../KretoScene";
import { KRETO_SCENES, type KretoSceneId } from "../kretoScenes";

describe("KretoScene", () => {
  it("is decorative art with its size reserved and lazy by default", () => {
    const { container } = render(<KretoScene scene="event" className="h-full w-full" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).toHaveAttribute("width", String(KRETO_SCENES.event.width));
    expect(img).toHaveAttribute("height", String(KRETO_SCENES.event.height));
    expect(img.className).toContain("object-cover");
  });

  it("can opt out of lazy loading for the first screenful", () => {
    const { container } = render(<KretoScene scene="campaign" lazy={false} />);
    expect(container.querySelector("img")).not.toHaveAttribute("loading");
  });

  it("knows all nine scenes of the library, each with its own file", () => {
    const ids = Object.keys(KRETO_SCENES) as KretoSceneId[];
    expect(ids).toHaveLength(9);
    expect(new Set(ids.map((id) => KRETO_SCENES[id].src)).size).toBe(9);
  });
});
