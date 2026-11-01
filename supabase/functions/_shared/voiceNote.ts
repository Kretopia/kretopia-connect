// Rules for transcribing a voice note. Pure: imported by the edge function (Deno) and by tests (Vite).
//
// Why: transcribe-voice-note took the message id, the table and the AUDIO URL from the request, fetched that URL from our
// server with no network policy, and wrote the model's text into that message with the service role. Any signed-in member
// could therefore make our server call an internal address, and put any text into any member's message by naming its id.
// Now the message is loaded by id, only its sender may have it transcribed, the audio is the file the message itself points
// to (the URL in the request is ignored), that file must be on our own storage, and it is fetched under a size and type cap.

export const VOICE_NOTE_MAX_BYTES = 10_000_000;
export const VOICE_NOTE_TRANSCRIPT_MAX_CHARS = 4000;
/** Recorders produce webm/ogg/mp4/wav audio; a storage object without a declared type is accepted as bytes, anything textual is not. */
export const VOICE_NOTE_MIME: readonly string[] = ["audio/", "video/webm", "video/mp4", "application/octet-stream"];

export interface VoiceTable {
  table: "messages" | "project_messages";
  /** The column holding the author of the message. */
  owner: string;
  /** The column holding the stored audio file. */
  url: string;
  /** The column that receives the transcript. */
  transcript: string;
  /** For direct messages the row must be a voice attachment. */
  kind?: { column: string; value: string };
}

export const VOICE_TABLES: Readonly<Record<string, VoiceTable>> = {
  messages: { table: "messages", owner: "sender_id", url: "attachment_url", transcript: "voice_note_transcript", kind: { column: "attachment_type", value: "voice" } },
  project_messages: { table: "project_messages", owner: "user_id", url: "voice_url", transcript: "voice_transcript" },
};

/** The table named by the request, defaulting to direct messages as before. */
export function voiceTableFor(name: unknown): VoiceTable {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(VOICE_TABLES, name) ? VOICE_TABLES[name] : VOICE_TABLES.messages;
}

export function voiceSelect(spec: VoiceTable): string {
  return ["id", spec.owner, spec.url, spec.transcript, ...(spec.kind ? [spec.kind.column] : [])].join(", ");
}

export type VoiceNoteDecision =
  | { ok: true; url: string; transcript: string | null }
  | { ok: false; status: 404 | 422; error: string };

const NOT_FOUND = { ok: false, status: 404, error: "Message not found" } as const;

/** Only the sender asks for a transcript, and only for a message that really is a voice note with a stored file. */
export function decideVoiceNote(spec: VoiceTable, row: Record<string, unknown> | null | undefined, callerId: string): VoiceNoteDecision {
  if (!row || row[spec.owner] !== callerId) return NOT_FOUND; // a stranger gets the answer a missing message gets
  if (spec.kind && row[spec.kind.column] !== spec.kind.value) return { ok: false, status: 422, error: "This message is not a voice note" };
  const url = row[spec.url];
  if (typeof url !== "string" || !url.trim()) return { ok: false, status: 422, error: "This message has no audio file" };
  const done = row[spec.transcript];
  return { ok: true, url: url.trim(), transcript: typeof done === "string" ? done : null };
}

/** The host names of the storage this deployment writes voice notes to (its own backend, and the account backend when set). */
export function storageHosts(...urls: Array<string | null | undefined>): string[] {
  const hosts = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).hostname.toLowerCase());
    } catch { /* an unusable setting adds nothing */ }
  }
  return [...hosts];
}

/** A stored object: https, one of our storage hosts, the storage path, no credentials, no unusual port. */
export function isOwnStorageUrl(raw: string, hosts: readonly string[]): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  if (!hosts.includes(url.hostname.toLowerCase())) return false;
  return url.pathname.startsWith("/storage/v1/object/");
}

/** Base64 of a byte array without building one giant string character by character. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
