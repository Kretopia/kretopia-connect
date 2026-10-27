import { useId, type ReactNode } from "react";

import { WrappedShell } from "./WrappedShell";
import { KretoScene } from "@/components/brand/KretoScene";
import { BrandLogo } from "@/components/BrandLogo";
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
      banner={
        scene ? (
          // Transparent so the panel grid runs through; whole image, no divider, no repeated name.
          <div className="grid items-center sm:grid-cols-2">
            <div className="hidden p-6 sm:block"><BrandLogo lockup size="md" /></div>
            <KretoScene scene={scene} lazy={false} className="h-auto w-full object-contain" />
          </div>
        ) : undefined
      }
    >
      {children}
    </WrappedShell>
  );
}

export default FeatureWrapped;
