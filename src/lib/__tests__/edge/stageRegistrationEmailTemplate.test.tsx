// Renders the Stage registration email with stand-ins for the react-email components (vitest.config.ts aliases): a spot says it is saved and offers the
// calendar and "free up your spot"; the waitlist says nothing is reserved and offers neither, so the email never promises a place.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const load = async () => (await import("../../../../supabase/functions/_shared/transactional-email-templates/curated-stage-registration-confirmation.tsx")).template;
const data = { attendeeName: "Dee", stageTitle: "Night Shoot Showcase", startsWhen: "Thu 17 Dec 2026, 20:00 UTC", hostName: "Ana Lima", stageUrl: "https://www.kretopia.com/circle/stage/s1", googleCalendarUrl: "https://calendar.google.com/calendar/render?x=1" };

describe("Stage registration email", () => {
  it("a spot: saved, with the time, host, calendar link and a way to free the spot", async () => {
    const t = await load();
    const html = renderToStaticMarkup(<t.component {...data} status="rsvp" />);
    expect(t.subject({ ...data, status: "rsvp" })).toBe("You're in for Night Shoot Showcase");
    expect(html).toContain("is saved");
    expect(html).toContain("Thu 17 Dec 2026, 20:00 UTC");
    expect(html).toContain("Ana Lima");
    expect(html).toContain("Add it to Google Calendar");
    expect(html).toContain("Free up your spot");
  });

  it("the waitlist: nothing reserved, no calendar entry, no spot to free", async () => {
    const t = await load();
    const html = renderToStaticMarkup(<t.component {...data} status="waitlist" />);
    expect(t.subject({ ...data, status: "waitlist" })).toBe("You're on the waitlist for Night Shoot Showcase");
    expect(html).toContain("Nothing is reserved yet");
    expect(html).not.toContain("is saved");
    expect(html).not.toContain("Google Calendar");
    expect(html).not.toContain("Free up your spot");
  });

  it("is registered under the name rsvp-curated-stage sends", async () => {
    const { readFileSync } = await import("node:fs");
    const registry = readFileSync("supabase/functions/_shared/transactional-email-templates/registry.ts", "utf8");
    expect(registry).toMatch(/'curated-stage-registration-confirmation': curatedStageRegistrationConfirmation/);
  });
});
