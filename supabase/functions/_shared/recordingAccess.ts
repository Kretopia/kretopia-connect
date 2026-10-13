// Pure, dependency-free decision for "may this user fetch the recording link of
// this call". Imported by edge functions (Deno) and by tests (Vite).
//
// Rule (code-only, no schema): the transcript's creator always may; anyone
// else only while they have not been revoked from the call, and only through
// one of the existing audiences (listed participant, canonical project access,
// party to a direct call). A failed lookup grants nothing.
//
// Revoked = a meeting_participants row with status 'denied' or 'removed' for a
// meeting-kind call. Those statuses are the only revocation signal the call
// stores carry: project collaborators are removed by deleting the row, and the
// participants jsonb on call_transcripts has no status at all.

import { REVOKED_PARTICIPANT_STATUSES } from "./meetingParticipantAccess.ts";

export interface RecordingAccessFacts {
  userId: string;
  createdBy?: string | null;
  /** The user's id appears in call_transcripts.participants. */
  listedParticipant: boolean;
  /** Owner or accepted operator of the call's project (requireProjectAccess). */
  projectAccess: boolean;
  /** started_by or invited_user_id of the direct call. */
  directCallParty: boolean;
  /** meeting_participants.status for a meeting-kind call; undefined when there is no such row. */
  meetingParticipantStatus?: string | null;
  /** Any lookup that feeds this decision failed. */
  lookupFailed?: boolean;
}

export type RecordingAccessReason =
  | "creator"
  | "listed_participant"
  | "project_access"
  | "direct_call_party"
  | "revoked_participant"
  | "lookup_failed"
  | "no_access";

export function decideRecordingAccess(f: RecordingAccessFacts): { allowed: boolean; reason: RecordingAccessReason } {
  if (f.lookupFailed) return { allowed: false, reason: "lookup_failed" };
  if (f.createdBy && f.createdBy === f.userId) return { allowed: true, reason: "creator" };
  const status = f.meetingParticipantStatus;
  if (typeof status === "string" && (REVOKED_PARTICIPANT_STATUSES as readonly string[]).includes(status)) {
    return { allowed: false, reason: "revoked_participant" };
  }
  if (f.listedParticipant) return { allowed: true, reason: "listed_participant" };
  if (f.projectAccess) return { allowed: true, reason: "project_access" };
  if (f.directCallParty) return { allowed: true, reason: "direct_call_party" };
  return { allowed: false, reason: "no_access" };
}
