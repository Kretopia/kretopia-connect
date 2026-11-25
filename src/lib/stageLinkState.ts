// What a shared Stage link (?join=<id>) means right now, from the row itself. A Stage is ENDED only when the host ended it
// (ended_at set by end-sound-stage). `is_live = false` without `ended_at` is a Stage whose host is still backstage (soundcheck,
// created by create-sound-stage with backstage: true) and has not opened the doors yet: that is not "ended", and saying so
// sends people away from a Stage that is about to start.
export type StageLinkState = "live" | "not_open" | "ended";

export function stageLinkState(row: { is_live: boolean | null; ended_at?: string | null }): StageLinkState {
  if (row.ended_at) return "ended";
  return row.is_live ? "live" : "not_open";
}

export const STAGE_LINK_COPY: Record<Exclude<StageLinkState, "live">, { title: string; description: string }> = {
  ended: { title: "This Stage has ended", description: "The host closed it. Look for the next one on Stages." },
  not_open: { title: "This Stage hasn't opened yet", description: "The host is still setting up. Open the link again in a moment." },
};

/** Where a signed-out visitor goes so they come back to this exact Stage after signing in. */
export const stageJoinSignInPath = (stageId: string) => `/auth?redirect=${encodeURIComponent(`/circle?join=${stageId}`)}`;
