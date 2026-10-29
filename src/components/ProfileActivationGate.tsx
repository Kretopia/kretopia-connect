import { ReactNode } from "react";
import { PassportDraftCard } from "@/components/passport/PassportDraftCard";

interface ProfileActivationGateProps {
  /** True when profile already meets discovery requirements */
  isVisible: boolean;
  /** Fields the caller found missing. The draft function re-reads the profile itself and decides what to offer. */
  missingFields: string[];
  /** Content to render when the profile is complete */
  children: ReactNode;
  /** Surface label used in the headline ("Stage", "Discover", etc.) */
  surfaceLabel?: string;
}

/**
 * Non-blocking activation guidance. The surface stays usable while the person completes what makes their Passport
 * visible, with Kreto drafting it for them to review (see PassportDraftCard).
 */
export const ProfileActivationGate = ({
  isVisible,
  children,
  surfaceLabel = "Discover",
}: ProfileActivationGateProps) => {
  if (isVisible) return <>{children}</>;

  return (
    <div className="space-y-4">
      <PassportDraftCard surfaceLabel={surfaceLabel} />
      {children}
    </div>
  );
};
