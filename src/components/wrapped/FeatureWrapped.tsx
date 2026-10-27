import { useId, type ReactNode } from "react";

import { WrappedShell } from "./WrappedShell";
import { SceneBanner } from "@/components/brand/SceneBanner";
import { useFeatureSceneState, useRegisterFeaturePanel } from "@/components/features/featureSceneStore";

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
 * A feature page's body on the same Wrapped frame as Studio, in Creator and
 * Company mode alike. When the page header carries a Kreto scene, the
 * "Kretopia x feature" banner becomes this panel's head (fused, not doubled).
 */
export function FeatureWrapped({ name, status, hideTitle, children }: FeatureWrappedProps) {
  const id = useId();
  useRegisterFeaturePanel();
  const { scene } = useFeatureSceneState();
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
      banner={scene ? <SceneBanner scene={scene} label={name} layout="split" lazy={false} /> : undefined}
    >
      {children}
    </WrappedShell>
  );
}

export default FeatureWrapped;
