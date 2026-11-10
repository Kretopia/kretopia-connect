import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the Event page's structure against drifting back: one shell that owns the width and the gutters, one booking control, and none of
 * the blocks that used to say the same facts again. A static scan, so a future change that reintroduces one fails here, in review.
 */
const root = join(__dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const PAGE_PARTS = [
  "src/pages/EventPage.tsx",
  "src/components/sessions/EventHeroCard.tsx",
  "src/components/sessions/EventBookingBlock.tsx",
  "src/components/sessions/EventBookingCta.tsx",
  "src/components/sessions/EventStickyBookingBar.tsx",
  "src/components/sessions/EventHostBlock.tsx",
  "src/components/sessions/EventAttendeeStack.tsx",
  "src/components/sessions/EventParticipantsDialog.tsx",
  "src/components/sessions/EventGallery.tsx",
  "src/components/sessions/EventAboutSection.tsx",
  "src/components/sessions/EventCommunityHub.tsx",
  "src/components/sessions/EventGuestRoster.tsx",
  "src/components/sessions/EventCalendarWorkspace.tsx",
];

describe("the Event page keeps one wrapper", () => {
  it("only the shell sets the page's width and gutters", () => {
    for (const path of PAGE_PARTS) {
      const source = read(path);
      expect(source, path).not.toMatch(/EVENT_PAGE_CONTENT_CLASS|max-w-7xl/);
      // The parts that sit in the page's flow centre nothing: the shell's column does. (The page's own "not found" card centres an icon and
      // is not part of the page's layout, so it is the one file allowed an `mx-auto`.)
      if (path !== "src/pages/EventPage.tsx") expect(source, path).not.toMatch(/\bmx-auto\b/);
    }
    expect(read("src/components/sessions/EventPageShell.tsx")).toMatch(/max-w-7xl/);
  });

  it("no part of the page gives itself an outer bottom margin: the shell's rhythm spaces the sections", () => {
    for (const path of PAGE_PARTS) {
      // Only the outermost element of each part matters; a root-level `mb-` here is the mistake the crew hub made.
      expect(read(path), path).not.toMatch(/<(section|Card)\b[^>]*className="[^"]*\bmb-6\b/);
    }
  });
});

describe("the Event page keeps one booking control and none of the repeated blocks", () => {
  it("the blocks that restated the same facts no longer exist, and nothing imports them", () => {
    for (const gone of ["EventBookingActions", "EventOptionsList", "EventRsvpSuccessDialog", "EventHostCard"]) {
      expect(existsSync(join(root, `src/components/sessions/${gone}.tsx`)), gone).toBe(false);
      for (const path of PAGE_PARTS) expect(read(path), `${path} imports ${gone}`).not.toContain(gone);
    }
  });

  it("only the booking control component marks a primary booking button", () => {
    const owners = PAGE_PARTS.filter((path) => read(path).includes("data-booking-cta"));
    expect(owners).toEqual(["src/components/sessions/EventBookingCta.tsx"]);
  });

  it("the page tells RSVP results in the booking block, not with a toast or a dialog of its own", () => {
    const page = read("src/pages/EventPage.tsx");
    const join = page.slice(page.indexOf("const handleJoin = async"), page.indexOf("const handleShare"));
    expect(join).not.toMatch(/toast\(/);
    expect(page).not.toContain("successSequence");
  });

  it("the standalone Admission and Event options blocks are not drawn by the page", () => {
    const page = read("src/pages/EventPage.tsx");
    expect(page).not.toMatch(/>\s*Admission\s*</);
    expect(page).not.toMatch(/Event options/);
  });
});
