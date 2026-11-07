import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { ModalSurfaceProvider } from "@/components/ui/ModalSurfaceProvider";

/** The authenticated app's modals wear the Kretopia surface; a visitor's stay as they are. Mounted once, inside the auth provider. */
export function AuthenticatedModalSurface({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ModalSurfaceProvider branded={Boolean(user)}>{children}</ModalSurfaceProvider>;
}
