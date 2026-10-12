import { describe, expect, it } from "vitest";
import { bottomBackflip, headingAt, sampleFlight, travelHeading, withFlightTurns, type FlightStop } from "../kretopia/kretoFlightPath";

const first: FlightStop = { scroll: 0, x: 10, y: 20, rotate: 0, opacity: 0, pose: "fly" };
const last: FlightStop = { ...first, scroll: 100, x: 110, y: 220, rotate: -360, opacity: 1 };
describe("Kreto scroll flight", () => {
  it("does not insert flips at interior media waypoints", () => {
    const path = [first, { ...first, scroll: 300, x: 150 }, { ...first, scroll: 600, x: 10 }];
    expect(withFlightTurns(path, { left: 10, right: 300 })).toHaveLength(3);
  });
  it("reverses the bottom double backflip smoothly without replaying it", () => {
    expect(bottomBackflip(500, 1000)).toBe(0);
    expect(bottomBackflip(860, 1000)).toBe(360);
    expect(bottomBackflip(1000, 1000)).toBe(720);
    expect(bottomBackflip(860, 1000)).toBe(360);
  });
  it("brakes and completes a backflip before reversing at a page edge", () => {
    const path = withFlightTurns([
      { ...first, opacity: 1 },
      { ...first, scroll: 300, x: 300 },
      { ...first, scroll: 600, x: 10 },
    ]);
    expect(path).toHaveLength(5);
    expect(path[1]).toMatchObject({ x: 300, facing: 1, rotate: 0 });
    expect(path[3]).toMatchObject({ x: 300, facing: -1, rotate: -360 });
    expect(sampleFlight(path, 300)).toMatchObject({ x: 300, facing: -1, rotate: -180 });
    expect(sampleFlight(path, 350)?.x).toBe(300);
    expect(sampleFlight(path, 450)?.x).toBeLessThan(300);
    expect(sampleFlight(path, 300)).toEqual(sampleFlight(path, 300));
  });
  it("handles unmounted chapters", () => expect(sampleFlight([], 20)).toBeUndefined());
  it("clamps before takeoff and after landing", () => {
    expect(sampleFlight([first, last], -20)).toEqual(first);
    expect(sampleFlight([first, last], 200)).toEqual(last);
  });
  it("interpolates the midpoint of a full loop", () => {
    expect(sampleFlight([first, last], 50)).toMatchObject({ x: 60, y: 120, rotate: -180, opacity: 0.5 });
  });
  it("stays still while hiding", () => {
    const peek: FlightStop = { ...last, pose: "peekTop" };
    const hold = { ...peek, scroll: 300 };
    expect(sampleFlight([first, peek, hold], 200)).toMatchObject({ x: 110, y: 220, pose: "peekTop" });
  });
  it("faces the direction of travel", () => {
    const back: FlightStop = { ...last, scroll: 200, x: 0 };
    expect(headingAt([first, last, back], 40)).toBe(1);
    expect(headingAt([first, last, back], 160)).toBe(-1);
  });
  it("faces actual return travel instead of repeating the descent heading", () => {
    expect(travelHeading([first, last], 50, 1)).toBe(1);
    expect(travelHeading([first, last], 50, -1)).toBe(-1);
    const path = withFlightTurns([first, { ...first, scroll: 300, x: 300 }, { ...first, scroll: 600 }]);
    expect(travelHeading(path, 300, -1)).toBe(1);
  });
  it("retraces the same path when scrolling back", () => {
    const before = sampleFlight([first, last], 25);
    sampleFlight([first, last], 80);
    expect(sampleFlight([first, last], 25)).toEqual(before);
  });
  it("settles upright at the end without fading and takes flight again on return", () => {
    const landing: FlightStop = { ...last, scroll: 200, pose: "stand", opacity: 1 };
    expect(sampleFlight([last, landing], 250)).toMatchObject({ pose: "stand", opacity: 1 });
    expect(sampleFlight([last, landing], 110)).toMatchObject({ pose: "fly", opacity: 1 });
  });
});
