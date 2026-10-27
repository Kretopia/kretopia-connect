import type { ReactNode } from "react";

/**
 * Protected pages render as-is for guests: the "Sign up to unlock" overlay was
 * removed on purpose (it blocked the flow). Sign-up stays in the navbar CTAs.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
