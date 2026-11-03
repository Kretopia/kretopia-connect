import type { ReactNode } from "react";

/** The plain full-page screen of a join link's own states (opening, can't open, you left). The call itself is never drawn here. */
export function CallEntryScreen({ children }: { children: ReactNode }) {
  return <main className="k-call-min-vh flex flex-col items-center justify-center bg-background p-6 text-foreground">{children}</main>;
}

export default CallEntryScreen;
