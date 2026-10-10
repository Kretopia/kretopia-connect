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

  it("knows the CPO's fifteen v4 scenes and the nine interim crops, each with its own file", () => {
    const ids = Object.keys(KRETO_SCENES) as KretoSceneId[];
    expect(ids).toHaveLength(24);
    expect(new Set(ids.map((id) => KRETO_SCENES[id].src)).size).toBe(24);
  });

  it("every v4 scene has a 480 px thumb that is a different, smaller file", () => {
    const v4 = ["passport", "krepay", "assistant", "match", "scout", "soundstages", "studio", "talent-search", "bg-dark", "bg-gradient", "bg-light", "coworking", "music-studio", "office", "workspace"] as KretoSceneId[];
    for (const id of v4) {
      const a = KRETO_SCENES[id];
      expect(a.thumb, id).toBeDefined();
      expect(a.thumb!.src).not.toBe(a.src);
      expect(a.thumb!.width).toBe(480);
      expect(a.width).toBe(1280);
    }
  });

  it("uses the thumb for a small slot and the full file for a banner", () => {
    const { container: small } = render(<KretoScene scene="scout" size="thumb" />);
    const { container: big } = render(<KretoScene scene="scout" />);
    expect(small.querySelector("img")).toHaveAttribute("src", KRETO_SCENES.scout.thumb!.src);
    expect(small.querySelector("img")).toHaveAttribute("width", "480");
    expect(big.querySelector("img")).toHaveAttribute("src", KRETO_SCENES.scout.src);
    expect(big.querySelector("img")).toHaveAttribute("width", "1280");
  });

  it("a scene with no thumb (an interim crop) ignores the size and uses its one file", () => {
    const { container } = render(<KretoScene scene="campaign" size="thumb" />);
    expect(container.querySelector("img")).toHaveAttribute("src", KRETO_SCENES.campaign.src);
  });
});
