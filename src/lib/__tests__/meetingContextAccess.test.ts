import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decideCircleContext } from "../../../supabase/functions/_shared/meetingContextAccess";

const U = "user-1";
const room = { userId: U, roomFound: true, createdBy: "someone-else", isMember: false };

describe("decideCircleContext: may this caller attach a meeting to this Circle", () => {
  it("allows the Circle's creator", () => {
    expect(decideCircleContext({ ...room, createdBy: U })).toEqual({ ok: true });
  });

  it("allows a member", () => {
    expect(decideCircleContext({ ...room, isMember: true })).toEqual({ ok: true });
  });

  it("refuses an unrelated user with 403", () => {
    expect(decideCircleContext(room)).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a Circle that does not exist, with the same answer as an unrelated one (no existence oracle)", () => {
    const missing = decideCircleContext({ ...room, roomFound: false, isMember: true });
    const unrelated = decideCircleContext(room);
    expect(missing).toEqual(unrelated);
  });

  it("answers 503 and grants nothing when a lookup failed, even for the creator or a member", () => {
    expect(decideCircleContext({ ...room, createdBy: U, lookupFailed: true })).toMatchObject({ ok: false, status: 503 });
    expect(decideCircleContext({ ...room, isMember: true, lookupFailed: true })).toMatchObject({ ok: false, status: 503 });
  });
});

describe("create-meeting wiring", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/create-meeting/index.ts"), "utf8");

  it("checks the project and the Circle before the Daily room is created", () => {
    const project = source.indexOf("requireProjectAccess(admin, body.project_id, userId)");
    const circle = source.indexOf("decideCircleContext({");
    const room = source.indexOf("/rooms`");
    expect(project).toBeGreaterThan(-1);
    expect(circle).toBeGreaterThan(-1);
    expect(room).toBeGreaterThan(project);
    expect(room).toBeGreaterThan(circle);
  });

  it("does not answer a project lookup failure as a plain refusal", () => {
    expect(source).toContain("Could not verify access to that project");
    expect(source).toMatch(/status === 503 \? 503 : 403/);
  });

  it("leaves the two ids that have no canonical record in this pass as they were", () => {
    expect(source).toContain("conversation_id: body.conversation_id ?? null");
    expect(source).toContain("event_id: body.event_id ?? null");
  });
});
