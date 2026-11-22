// The Passport intro video upload, as people see it: one honest status per step, a size limit that is checked before any
// transfer, and errors that say what happened. supabase-js uploads in one request without progress events, so the
// "uploading" step says how big the file is and that it can take a while, instead of inventing a percentage.

export const INTRO_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export type IntroUploadPhase = "idle" | "uploading" | "saving" | "saved" | "failed";

const MIME_EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };

export const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;

/** Checked before anything is sent. The extension is sanitised: it becomes part of the storage path. */
export function checkIntroVideoFile(file: { name: string; size: number; type: string }): { ok: true; ext: string } | { ok: false; message: string } {
  if (file.type && !file.type.startsWith("video/")) return { ok: false, message: "That file isn't a video. Choose an MP4, MOV or WebM file." };
  if (file.size <= 0) return { ok: false, message: "That file is empty. Choose the video again." };
  if (file.size > INTRO_VIDEO_MAX_BYTES) {
    return { ok: false, message: `This video is ${formatMb(file.size)}; the limit is ${formatMb(INTRO_VIDEO_MAX_BYTES)}. Trim it or export it smaller, then try again.` };
  }
  const fromName = (file.name.includes(".") ? file.name.split(".").pop() ?? "" : "").toLowerCase();
  const ext = /^[a-z0-9]{2,5}$/.test(fromName) ? fromName : MIME_EXT[file.type] ?? "mp4";
  return { ok: true, ext };
}

/** What a failed upload means, without raw storage internals. */
export function introUploadError(err: unknown): string {
  const raw = `${(err as { message?: string })?.message ?? ""} ${(err as { statusCode?: string | number })?.statusCode ?? ""}`.toLowerCase();
  if (/413|too large|maximum allowed size|payload/.test(raw)) return "The storage service refused the file as too large.";
  if (/mime|content type|not supported/.test(raw)) return "This video format isn't accepted. Try an MP4 file.";
  if (/failed to fetch|load failed|network|timeout|aborted/.test(raw)) return "The connection dropped during the upload.";
  if (/401|403|unauthori|jwt|row-level|permission/.test(raw)) return "You're signed out or not allowed to upload here. Sign in again and retry.";
  return "The upload didn't finish.";
}

/** The status line under the video. `failure` is only used for the failed phase. */
export function introUploadStatus(phase: IntroUploadPhase, file?: { name: string; size: number } | null, failure?: string | null): string | null {
  switch (phase) {
    case "uploading":
      return `Uploading ${file?.name ?? "your video"}${file ? ` (${formatMb(file.size)})` : ""}. Keep this page open; a large video can take a few minutes.`;
    case "saving":
      return "Uploaded. Saving it to your Passport…";
    case "saved":
      return "Saved. Your video intro now shows on your Passport.";
    case "failed":
      return `${failure ?? "The upload didn't finish."} Nothing was changed on your Passport.`;
    default:
      return null;
  }
}
