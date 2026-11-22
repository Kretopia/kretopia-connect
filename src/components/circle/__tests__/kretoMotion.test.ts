import { describe, expect, it } from "vitest";
import { dampKretoAngle, glideKretoTurn, KRETO_DRAG_SENSITIVITY } from "../kretoMotion";

describe("Kreto 360 viewer motion", () => {
  it("has identical damping at 30 and 120 frames per second", () => {
    const advance = (fps: number) => {
      let angle = 0;
      for (let frame = 0; frame < fps; frame++) angle = dampKretoAngle(angle, 1, 1 / fps);
      return angle;
    };
    expect(advance(30)).toBeCloseTo(advance(120), 12);
    expect(advance(30)).toBeGreaterThan(0.99);
  });
  it("preserves unrestricted full rotations in either direction", () => {
    expect(dampKretoAngle(0, Math.PI * 4, 1)).toBeGreaterThan(Math.PI * 2);
    expect(dampKretoAngle(0, -Math.PI * 4, 1)).toBeLessThan(-Math.PI * 2);
    expect(700 * KRETO_DRAG_SENSITIVITY).toBeGreaterThan(Math.PI * 2);
  });
  it("coasts smoothly with finite decaying momentum", () => {
    const first = glideKretoTurn(2, 0.5);
    const next = glideKretoTurn(first.velocity, 0.5);
    const whole = glideKretoTurn(2, 1);
    expect(first.distance + next.distance).toBeCloseTo(whole.distance, 12);
    expect(next.velocity).toBeCloseTo(whole.velocity, 12);
    expect(whole.velocity).toBeLessThan(0.01);
    expect(glideKretoTurn(0, 1).distance).toBe(0);
  });
});