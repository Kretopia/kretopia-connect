import type { WorkspaceType } from "@/lib/workspaceConfigs";

/** Real, honest triggers only -- deliberately NOT a generic "is this draft
 * good enough" heuristic. Each reason maps to a concrete signal already
 * present in VoiceFirstCreateModal's own state, per the approved product
 * decision (KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md): a project type that
 * couldn't be confidently inferred, or a draft that fell back to raw
 * unstructured text because extraction failed non-fatally. Missing
 * deliverables is a real caution condition too but already has its own
 * dedicated inline message where the checklist would be -- surfaced here
 * would just repeat it, so it's intentionally left out of this list.
 * Extracted (like inferWorkspaceType.ts) so the exact wording and trigger
 * conditions are independently testable rather than buried in the modal. */
export function getNewRoomCautionReasons(workspaceType: WorkspaceType, degraded: boolean): string[] {
  const reasons: string[] = [];
  if (degraded) {
    reasons.push(
      "Kreto couldn't structure this one — the title and summary are your text as-is. Give them a look before continuing.",
    );
  }
  if (workspaceType === "general") {
    reasons.push(
      "Kreto wasn't confident about the project type. “General” is a safe default — pick a specific one below if it fits better.",
    );
  }
  return reasons;
}

export default getNewRoomCautionReasons;
