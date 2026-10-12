import { describe, expect, it } from "vitest";
import { sampleFlight, type FlightStop } from "../kretopia/kretoFlightPath";

const first: FlightStop = { scroll: 0, x: 10, y: 20, rotate: 0, turn: 0, scale: 1, opacity: 0, pose: "fly" };
const last: FlightStop = { ...first, scroll: 100, x: 110, y: 220, rotate: -360, turn: 180, opacity: 1, pose: "tuck" };
describe("Kreto scroll flight", () => {
  it("handles unmounted chapters", () => expect(sampleFlight([], 20)).toBeUndefined());
  it("clamps before takeoff and after landing", () => {
    expect(sampleFlight([first, last], -20)).toEqual(first);
    expect(sampleFlight([first, last], 200)).toEqual(last);
  });
  it("interpolates a full backflip and a half turn", () => {
    expect(sampleFlight([first, last], 50)).toMatchObject({ x: 60, y: 120, rotate: -180, turn: 90, opacity: 0.5, pose: "tuck" });
  });
  it("retraces the same path when scrolling back", () => {
    const before = sampleFlight([first, last], 25);
    sampleFlight([first, last], 80);
    expect(sampleFlight([first, last], 25)).toEqual(before);
  });
});