import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { eventEntry } from "../eventEntry";
import { getEventBookingState } from "../eventBookingState";

/**
 * Paid event tickets are paused: kretopia-app's verify-event-ticket writes "rsvp" (the guest list refuses it), so a buyer may not be
 * seated. Until it is fixed there, no screen may start a Kretopia checkout for an event ticket, and the event page must say so.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("paid event tickets are paused", () => {
  it("no screen calls the event-ticket checkout function", () => {
    const callers = sourceFiles("src").filter((file) => /purchase-event-ticket/.test(readFileSync(file, "utf8")));
    expect(callers).toEqual([]);
  });

  it("a ticketed event sold by Kretopia is never open for booking on the event page", () => {
    expect(eventEntry({ is_ticketed: true })).toEqual({ kind: "ticket" });
    const state = getEventBookingState({
      loading: false,
      availabilityReady: true,
      cancelled: false,
      ended: false,
      hosting: false,
      participation: null,
      full: false,
      waitlistEnabled: true,
      authenticated: true,
      nativePaid: true,
    });
    expect(state).toBe("payment-unavailable");
  });

  it("an event whose tickets are sold elsewhere still sends people there", () => {
    expect(eventEntry({ is_ticketed: true, external_ticket_url: "https://tickets.example.com/e/1" })).toEqual({
      kind: "external",
      url: "https://tickets.example.com/e/1",
    });
  });
});
