import { createContext, useContext } from "react";

import { DIALOG_BACKDROP, DIALOG_SURFACE, DIALOG_TITLE } from "./dialogBrand.tokens";

/**
 * Whether the modals drawn below this point wear the Kretopia surface (the Passport QR modal's: see dialogBrand.tokens.ts). The app turns
 * it on for a signed-in member (AuthenticatedModalSurface); with no provider, as on the public pages for a visitor, a dialog is the plain
 * primitive it always was. React context passes through Radix's portal, so a dialog opened from anywhere under the provider sees it.
 */
export const ModalSurfaceContext = createContext(false);

export const useBrandedModalSurface = () => useContext(ModalSurfaceContext);

interface ModalSurfaceClasses {
  /** Whether the overlay is drawn for a signed-in member. */
  branded: boolean;
  /** The backdrop's colour. */
  backdrop: string;
  /** The panel's border colour, background and shadow. */
  panel: string;
  /** The title's size, weight and tracking. */
  title: string;
}

/**
 * For an overlay that is a modal but not a Radix dialog (a bottom action sheet, a full-screen create flow): the QR modal's backdrop, surface and
 * title for a signed-in member, and what the overlay always drew for a visitor, passed in as `plain`. The overlay keeps its own geometry,
 * position, animation, focus handling and dismissal; only the colours and the type come from here.
 */
export function useModalSurfaceClasses(plain: { backdrop: string; panel: string; title?: string }): ModalSurfaceClasses {
  const branded = useBrandedModalSurface();
  return branded
    ? { branded, backdrop: DIALOG_BACKDROP, panel: DIALOG_SURFACE, title: DIALOG_TITLE }
    : { branded, backdrop: plain.backdrop, panel: plain.panel, title: plain.title ?? "" };
}
