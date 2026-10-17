import { useId, type ReactNode } from "react";

import { WrappedShell } from "./WrappedShell";

interface FeatureWrappedProps {
  /** The feature's name as people know it: "KrePay", "Stages", "Founding Circle". */
  name: string;
  /** One true line under the title, when there is one. */
  status?: ReactNode;
  /** The page's own heading already names the feature: keep the title for screen readers, do not draw it. */
  hideTitle?: boolean;
  children: ReactNode;
}

/**
 * A feature page's body on the same Wrapped frame as Today's Radar, Scout and
 * Studio: eyebrow "Kretopia · {name}", the title "Everything in {name}", the
 * page's own components inside, the Kretopia lockup at the foot. It adds no
 * data and no claims of its own.
 */
export function FeatureWrapped({ name, status, hideTitle, children }: FeatureWrappedProps) {
  const id = useId();
  return (
    <WrappedShell
      titleId={`feature-wrapped-${id}`}
      eyebrow={`Kretopia · ${name}`}
      title={
        <>
          Everything in <span className="k-gradient-text">{name}</span>
        </>
      }
      hideTitle={hideTitle}
      status={status}
    >
      {children}
    </WrappedShell>
  );
}

export default FeatureWrapped;
