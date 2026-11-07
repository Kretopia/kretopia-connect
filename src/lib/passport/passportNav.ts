/**
 * Moving between a member's private Passport and the public one that anybody can open. The decision is made from two ids, never from
 * what a page happens to show or hide: the id of the signed-in account (validated by the auth backend) and the id of the Passport being
 * viewed. Only when the two are the same non-empty id does a link between the two views exist at all.
 */

/** The private Passport: owner-only and always the signed-in member's own (the route takes no id). */
export const PRIVATE_PASSPORT_PATH = "/profile";

/** The public Passport of a member: the address every share link, handle and QR resolves to. */
export const publicPassportPath = (userId: string) => `/epk/${userId}`;

export type PassportSurface = "private" | "public";
export type PassportNavAction =
  | { kind: "view-public"; label: "View my public Passport"; to: string }
  | { kind: "back-to-private"; label: "Back to my private Passport"; to: string };

/**
 * The one link the Passport header offers, or null.
 *  - On the private Passport the viewer is the owner by definition, so the link opens the public Passport of the signed-in account
 *    (never an id taken from the address or from page data).
 *  - On a public Passport the link back exists only when the signed-in account owns THIS Passport. A visitor, a signed-out guest and
 *    another member get nothing: no link, no label, no route to the owner's private page.
 */
export function passportNavFor(input: { surface: PassportSurface; viewerId: string | null | undefined; passportOwnerId: string | null | undefined }): PassportNavAction | null {
  const viewer = input.viewerId?.trim();
  if (!viewer) return null;
  if (input.surface === "private") return { kind: "view-public", label: "View my public Passport", to: publicPassportPath(viewer) };
  const owner = input.passportOwnerId?.trim();
  if (!owner || owner !== viewer) return null;
  return { kind: "back-to-private", label: "Back to my private Passport", to: PRIVATE_PASSPORT_PATH };
}
