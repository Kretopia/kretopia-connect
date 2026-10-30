export const ATTACHMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_BUCKET = "kreto-chat-originals";
export const attachmentExpiresAt = (now: number) => new Date(now + ATTACHMENT_TTL_MS).toISOString();
export const attachmentIsLive = (expiresAt: string, now: number) => Date.parse(expiresAt) > now;
export const remainingAllowance = (cap: number, used: number, reserved: number) => cap < 0 ? null : Math.max(0, cap - used - reserved);