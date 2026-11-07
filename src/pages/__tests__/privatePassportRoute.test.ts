import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

// The link between the private and the public Passport is only as safe as the private route is: however a page decides to draw or hide a
// button, /profile must be unable to show anybody's Passport but the signed-in member's own. These pin that at the route.
describe("the private Passport route can only ever show the signed-in member's own Passport", () => {
  it("is a protected route with no id in its address, and no id-bearing route renders the private page", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('<Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />');
    const withId = [...app.matchAll(/<Route path="(\/(?:profile|passport|epk)\/:[^"]+)" element=\{([^}]+)\}/g)];
    expect(withId.length).toBeGreaterThan(0);
    for (const [, path, element] of withId) expect(element, `${path} must not render the private page`).not.toContain("<Profile");
  });

  it("the page reads the signed-in account, and takes no id from its address", () => {
    const page = read("src/pages/Profile.tsx");
    expect(page).toContain("useAuth()");
    expect(page).not.toContain("useParams");
    expect(page).not.toMatch(/(?:searchParams|params)\.get\((["'])(?:userId|user_id|id|uid|as)\1\)/);
  });

  it("the public Passport page is where ids live, and it draws the private link only from the viewer's own id", () => {
    const view = read("src/components/passport/PublicPassportView.tsx");
    const header = read("src/components/passport/PassportPageHeader.tsx");
    expect(view).toContain('<PassportPageHeader surface="public" viewerId={currentUserId} passportOwnerId={profile.user_id} />');
    expect(header).toContain("passportNavFor(");
    // the address of the private page is a constant, never built from an id
    expect(read("src/lib/passport/passportNav.ts")).toContain('export const PRIVATE_PASSPORT_PATH = "/profile";');
  });
});
