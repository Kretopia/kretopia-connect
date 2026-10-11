import { useAccountTone } from "@/hooks/useAccountTone";
import { WorkHomeSkeleton } from "@/pages/WorkHomeSkeleton";
import { BrandWorkHome } from "@/pages/BrandWorkHome";
import { CreatorWorkHome } from "@/pages/CreatorWorkHome";

/**
 * Studio home's single entry point (routed at /desk) -- the only job
 * left here is picking which account-type dashboard to render once we
 * know it. BrandWorkHome and CreatorWorkHome used to be defined in this
 * same file (700+ lines mixing two full dashboard implementations with
 * this router), each with its own copy-pasted wiring for the four global
 * overlays (voice-first create, command palette, voice command, Wrap My
 * Week) -- now shared via useStudioGlobalModals so those four evolve in
 * one place instead of two. Splitting the two dashboards into their own
 * files makes each independently navigable and testable without
 * changing what either one renders.
 */
const WorkHome = () => {
  const { isBusiness, loading: checking } = useAccountTone();

  if (checking) {
    return <WorkHomeSkeleton variant="shell" />;
  }

  if (isBusiness) return <BrandWorkHome />;
  return <CreatorWorkHome />;
};

export default WorkHome;
