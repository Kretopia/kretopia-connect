import { describe, expect, it } from "vitest";
import { canJoinDirectly, eventEntry } from "../eventEntry";

describe("eventEntry: how someone may get into an event", () => {
  it("only an event that is not ticketed and sells no tickets elsewhere is joined directly", () => {
    expect(eventEntry({ is_ticketed: false, external_ticket_url: null })).toEqual({ kind: "free" });
    expect(eventEntry({})).toEqual({ kind: "free" });
    expect(canJoinDirectly({ is_ticketed: false })).toBe(true);
  });

  it("a ticketed event is never joined directly, whether or not it has a single price", () => {
    expect(eventEntry({ is_ticketed: true })).toEqual({ kind: "ticket" });
    expect(canJoinDirectly({ is_ticketed: true })).toBe(false);
  });

  it("tickets sold elsewhere send people there, like the event page does", () => {
    expect(eventEntry({ is_ticketed: true, external_ticket_url: "https://tickets.example/e/1" })).toEqual({
      kind: "external",
      url: "https://tickets.example/e/1",
    });
    // Even if the host never ticked 'ticketed': an external ticket link is still an external sale.
    expect(eventEntry({ is_ticketed: false, external_ticket_url: "https://tickets.example/e/1" }).kind).toBe("external");
    expect(canJoinDirectly({ external_ticket_url: "https://tickets.example/e/1" })).toBe(false);
  });

  it("ignores an external link that is not http(s), so it can never become a script URL", () => {
    expect(eventEntry({ is_ticketed: true, external_ticket_url: "javascript:alert(1)" })).toEqual({ kind: "ticket" });
    expect(eventEntry({ is_ticketed: false, external_ticket_url: "javascript:alert(1)" })).toEqual({ kind: "free" });
    expect(eventEntry({ is_ticketed: true, external_ticket_url: "not a url" })).toEqual({ kind: "ticket" });
    expect(eventEntry({ is_ticketed: false, external_ticket_url: "   " })).toEqual({ kind: "free" });
  });

  it("an event we could not read is not joined directly (fail closed)", () => {
    expect(canJoinDirectly(null)).toBe(false);
    expect(canJoinDirectly(undefined)).toBe(false);
  });
});
