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
  const { scene, head } = useFeatureSceneState();
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
        scene && head ? (
          // Studio New Room head: lockup + feature pill, then title/subtitle beside its Kreto.
          <div>
            <div className="flex items-center justify-between gap-3">
              <BrandLogo lockup size="md" />
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{ borderColor: "hsl(var(--energy) / 0.35)", color: "hsl(var(--energy))" }}
              >
                {name}
              </span>
            </div>
            <div className="mt-6 grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <h2 id={`feature-wrapped-${id}`} className="text-3xl font-black leading-[1.05] tracking-[-0.03em] text-foreground sm:text-4xl">
                  {head.title}
                  {head.accentTitle && (
                    <>
                      <br />
                      <span style={{ color: "hsl(var(--energy))" }}>{head.accentTitle}</span>
                    </>
                  )}
                </h2>
                <p className="mt-3 max-w-xl text-sm text-foreground/55 sm:text-base">{head.subtitle}</p>
                {status && <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{status}</p>}
              </div>
              <KretoScene scene={scene} size="thumb" lazy={false} className="hidden h-32 w-64 shrink-0 rounded-2xl border border-border sm:block" />
            </div>
          </div>
        ) : undefined
      }
    >
      {children}
    </WrappedShell>
  );
}

export default FeatureWrapped;
