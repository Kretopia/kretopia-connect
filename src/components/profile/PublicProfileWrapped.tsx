import { useMemo, type ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";

interface PublicProfileWrappedProps {
  userId: string;
  fullName: string;
  verified: boolean;
  /** The Passport card. It is the highlighted block: first on a phone, left on a desktop. */
  passport: ReactNode;
  /** The rest of the creator's record. */
  children: ReactNode;
  /** Full-width bands under the Passport and the record: what reads better side by side, at the width of the page, than stacked in a column. */
  below?: ReactNode;
}

/**
 * A public Creative Passport in the same Wrapped frame as Today's Radar and
 * Scout's top section: the Passport is the featured block, the record sits
 * next to it, and everything lives on one surface under the Kretopia
 * navbar. No outbound social links anywhere on it. There is no strip of
 * standalone counts above them: Credits and Confirmed are the card's "at a
 * glance" block, and Features and Awards are rows of the Expertise section.
 */
export function PublicProfileWrapped({ userId, fullName, verified, passport, children, below }: PublicProfileWrappedProps) {
  const firstName = fullName?.trim().split(/\s+/)[0] || "this creator";
  const passportId = useMemo(() => (userId ? `KRT-${userId.replace(/-/g, "").slice(0, 5).toUpperCase()}` : null), [userId]);

  return (
    <WrappedShell
      titleId="public-passport-title"
      eyebrow="Passport"
      title={
        <>
          {/* The Kretopia title, as on Scout, Today and every other page: the text in the foreground colour (white in Midnight), then
              one phrase in the logo's own linear gradient. (It was the brand's Signal Teal for a while, on the argument that the
              colour must not compete with the work; the product owner asked for the Kretopia title back.) */}
          {firstName}'s <span className="k-gradient-text">Creative Passport</span>
        </>
      }
      status={
        <WrappedStatus
          active={verified}
          label={verified ? "Verified on Kretopia" : "On Kretopia"}
          detail={passportId ? <>· {passportId}</> : null}
        />
      }
      aside={<BrandLogo lockup size="sm" className="hidden sm:flex" />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
        <div className="min-w-0">{passport}</div>
        <div className="min-w-0 space-y-7">{children}</div>
      </div>

      {below && <div className="space-y-8 pt-2 sm:space-y-10">{below}</div>}
    </WrappedShell>
  );
}

export default PublicProfileWrapped;
