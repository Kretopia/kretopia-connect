import type { ReactNode } from "react";

import { ModalSurfaceContext } from "./modalSurface";

/** Says whether the modals below wear the Kretopia surface. The app mounts it once (AuthenticatedModalSurface); a modal mounts it for what it opens. */
export function ModalSurfaceProvider({ branded, children }: { branded: boolean; children: ReactNode }) {
  return <ModalSurfaceContext.Provider value={branded}>{children}</ModalSurfaceContext.Provider>;
}
