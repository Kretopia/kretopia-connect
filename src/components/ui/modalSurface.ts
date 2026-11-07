import { createContext, useContext } from "react";

/**
 * Whether the modals drawn below this point wear the Kretopia surface (the Passport QR modal's: see dialogBrand.tokens.ts). The app turns
 * it on for a signed-in member (AuthenticatedModalSurface); with no provider, as on the public pages for a visitor, a dialog is the plain
 * primitive it always was. React context passes through Radix's portal, so a dialog opened from anywhere under the provider sees it.
 */
export const ModalSurfaceContext = createContext(false);

export const useBrandedModalSurface = () => useContext(ModalSurfaceContext);
