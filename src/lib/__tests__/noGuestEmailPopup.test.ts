import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_SOURCE = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");

// The email-list popup interrupted every guest 30 seconds into a visit and read
// like the sign-up path, so it must stay out of the app shell entirely.
describe("guest email-list popup", () => {
  it("is not imported by the app shell", () => {
    expect(APP_SOURCE).not.toMatch(/NewsletterPopup/);
  });

  it("is not mounted anywhere in src", () => {
    const mounted = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
    expect(mounted).not.toMatch(/<NewsletterPopup/);
  });
});
