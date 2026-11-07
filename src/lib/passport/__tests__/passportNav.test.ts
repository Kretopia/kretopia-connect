import { describe, expect, it } from "vitest";

import { PRIVATE_PASSPORT_PATH, passportNavFor, publicPassportPath } from "../passportNav";

const ME = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";

describe("passportNavFor", () => {
  it("opens the public Passport of the signed-in account from the private Passport", () => {
    expect(passportNavFor({ surface: "private", viewerId: ME, passportOwnerId: ME })).toEqual({
      kind: "view-public",
      label: "View my public Passport",
      to: `/epk/${ME}`,
    });
  });

  it("takes the identity from the signed-in account, not from the Passport id it is given", () => {
    // a mismatched owner id on the private surface must not redirect anywhere but the viewer's own public Passport
    expect(passportNavFor({ surface: "private", viewerId: ME, passportOwnerId: OTHER })?.to).toBe(publicPassportPath(ME));
  });

  it("offers no link at all on the private surface without a signed-in account", () => {
    expect(passportNavFor({ surface: "private", viewerId: null, passportOwnerId: ME })).toBeNull();
    expect(passportNavFor({ surface: "private", viewerId: undefined, passportOwnerId: ME })).toBeNull();
    expect(passportNavFor({ surface: "private", viewerId: "  ", passportOwnerId: ME })).toBeNull();
  });

  it("offers the way back to the private Passport only to the owner of this public Passport", () => {
    expect(passportNavFor({ surface: "public", viewerId: ME, passportOwnerId: ME })).toEqual({
      kind: "back-to-private",
      label: "Back to my private Passport",
      to: PRIVATE_PASSPORT_PATH,
    });
  });

  it("offers nothing to another member, to a signed-out visitor, or when either id is missing", () => {
    expect(passportNavFor({ surface: "public", viewerId: OTHER, passportOwnerId: ME })).toBeNull();
    expect(passportNavFor({ surface: "public", viewerId: null, passportOwnerId: ME })).toBeNull();
    expect(passportNavFor({ surface: "public", viewerId: ME, passportOwnerId: null })).toBeNull();
    expect(passportNavFor({ surface: "public", viewerId: ME, passportOwnerId: undefined })).toBeNull();
    expect(passportNavFor({ surface: "public", viewerId: "", passportOwnerId: "" })).toBeNull();
  });

  it("never points at a private address carrying somebody's id", () => {
    for (const viewerId of [ME, OTHER, null]) {
      for (const passportOwnerId of [ME, OTHER, null]) {
        const nav = passportNavFor({ surface: "public", viewerId, passportOwnerId });
        if (nav) expect(nav.to).toBe(PRIVATE_PASSPORT_PATH);
      }
    }
    expect(PRIVATE_PASSPORT_PATH).not.toContain(ME);
  });
});
