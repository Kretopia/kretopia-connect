import { useMemo, type ReactNode } from "react";
import { Award, BadgeCheck, Briefcase, Newspaper, type LucideIcon } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedSignals, type WrappedSignal } from "@/components/wrapped/WrappedSignals";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";

export interface PublicProfileStat {
  id: "credits" | "confirmed" | "features" | "awards";
  label: string;
  value: number;
}

const ICON: Record<PublicProfileStat["id"], LucideIcon> = {
  credits: Briefcase,
  confirmed: BadgeCheck,
  features: Newspaper,
  awards: Award,
};

interface PublicProfileWrappedProps {
  userId: string;
  fullName: string;
  verified: boolean;
  /** Four counts of what the record holds; shown as plain figures, never as links. */
  stats: PublicProfileStat[];
  /** The Passport card. It is the highlighted block: first on a phone, left on a desktop. */
  passport: ReactNode;
  /** The rest of the creator's record. */
  children: ReactNode;
}

/**
 * A public Creative Passport in the same Wrapped frame as Today's Radar and
 * Scout's top section: the Passport is the featured block, the record sits
 * next to it, and everything lives on one surface under the Kretopia
 * navbar. No outbound social links anywhere on it.
 */
export function PublicProfileWrapped({ userId, fullName, verified, stats, passport, children }: PublicProfileWrappedProps) {
  const firstName = fullName?.trim().split(/\s+/)[0] || "this creator";
  const passportId = useMemo(() => (userId ? `KRT-${userId.replace(/-/g, "").slice(0, 5).toUpperCase()}` : null), [userId]);

  const signals: WrappedSignal[] = stats.map((s) => ({
    id: s.id,
    icon: ICON[s.id],
    value: s.value,
    state: "ready",
    label: s.label,
    hint: "",
  }));

  return (
    <WrappedShell
      titleId="public-passport-title"
      eyebrow="Kretopia · Creative Passport"
      title={
        <>
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
      <WrappedSignals
        label="Passport record"
        signals={signals}
        columnsClassName="grid-cols-2 sm:grid-cols-4"
        compactOnMobile
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
        <div className="min-w-0">{passport}</div>
        <div className="min-w-0 space-y-7">{children}</div>
      </div>
    </WrappedShell>
  );
}

export default PublicProfileWrapped;
