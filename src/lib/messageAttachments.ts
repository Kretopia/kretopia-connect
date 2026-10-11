import { supabase } from "@/integrations/supabase/client";

/**
 * Switch to true ONLY after security/message-attachments-2026-10-11.sql is
 * applied on the production backend. While false, uploads keep the legacy
 * public `portfolio` behaviour.
 */
export const PRIVATE_MESSAGE_ATTACHMENTS = true;

export const MESSAGE_BUCKET = "message-attachments";
const PRIVATE_PREFIX = `${MESSAGE_BUCKET}:`;
const SIGNED_TTL_SECONDS = 300;

/** Stored value for private files: "message-attachments:{sender}/{receiver}/{uuid}.ext" */
export const isPrivateAttachment = (stored?: string | null) =>
  !!stored && stored.startsWith(PRIVATE_PREFIX);

export const uploadPrivateAttachment = async (file: File, receiverId: string): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (!receiverId || receiverId === user.id) throw new Error("Invalid conversation");
  const ext = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8);
  const path = `${user.id}/${receiverId}/${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from(MESSAGE_BUCKET);
  const { error } = await bucket.upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  // Self-check: the file must be readable back via a signed link, otherwise
  // the read rule is missing and nobody could open it. Clean up and fail.
  const { data: signed, error: signError } = await bucket.createSignedUrl(path, 60);
  if (signError || !signed?.signedUrl) {
    await bucket.remove([path]).catch(() => undefined);
    throw signError ?? new Error("Signed URL unavailable");
  }
  return `${PRIVATE_PREFIX}${path}`;
};

/** Legacy public upload (pre-private behaviour). */
export const uploadPublicAttachment = async (file: File): Promise<string> => {
  const fileExt = file.name.split(".").pop();
  const filePath = `messages/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const { error } = await supabase.storage.from("portfolio").upload(filePath, file);
  if (error) throw error;
  return supabase.storage.from("portfolio").getPublicUrl(filePath).data.publicUrl;
};

/** Short-lived signed URL; never persisted. Returns null when access is denied. */
export const getAttachmentUrl = async (stored: string): Promise<string | null> => {
  if (!isPrivateAttachment(stored)) return stored; // legacy public URL
  const path = stored.slice(PRIVATE_PREFIX.length);
  const { data, error } = await supabase.storage
    .from(MESSAGE_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};
