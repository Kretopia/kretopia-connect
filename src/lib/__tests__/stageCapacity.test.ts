import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STAGE_MAX_CAPACITY, STAGE_ROOM_HEADROOM, STAGE_ROOM_LIMIT, clampStageCapacity } from "../stageCapacity";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");

describe("a scheduled Stage never registers more people than its room can hold", () => {
  it("is in step with go-live-stage, which opens the room for capacity + headroom, capped at the room limit", () => {
    expect(read("supabase/functions/go-live-stage/index.ts")).toContain(`max_participants: Math.min(stage.capacity + ${STAGE_ROOM_HEADROOM}, ${STAGE_ROOM_LIMIT})`);
    expect(STAGE_MAX_CAPACITY).toBe(190);
  });

  it("the largest capacity fits the room whole, the next one does not", () => {
    expect(Math.min(STAGE_MAX_CAPACITY + STAGE_ROOM_HEADROOM, STAGE_ROOM_LIMIT)).toBe(STAGE_ROOM_LIMIT);
    expect(STAGE_MAX_CAPACITY + 1 + STAGE_ROOM_HEADROOM).toBeGreaterThan(STAGE_ROOM_LIMIT);
  });

  it("the form sends a whole number from 1 to the maximum", () => {
    expect(clampStageCapacity("50")).toBe(50);
    expect(clampStageCapacity("1000")).toBe(STAGE_MAX_CAPACITY);
    expect(clampStageCapacity("190")).toBe(190);
    expect(clampStageCapacity("191")).toBe(190);
    expect(clampStageCapacity("12.7")).toBe(12);
    expect(clampStageCapacity("0")).toBe(1);
    expect(clampStageCapacity("-5")).toBe(1);
    expect(clampStageCapacity("")).toBe(50);
    expect(clampStageCapacity("abc")).toBe(50);
  });

  it("the creation form offers no more than that", () => {
    const form = read("src/components/circle/CreateStageSheet.tsx");
    expect(form).toContain("max={STAGE_MAX_CAPACITY}");
    expect(form).toContain("capacity: clampStageCapacity(capacity)");
    expect(form).not.toContain("max={1000}");
  });
});
