/**
 * Resumable upload for the `project-files` Supabase Storage bucket using TUS.
 *
 * Why TUS: standard HTTP fetch uploads stall on flaky wifi for big files.
 * Supabase Storage exposes a TUS-compatible endpoint at /storage/v1/upload/resumable.
 *
 * Docs: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
 */

import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const RESUMABLE_ENDPOINT = `${SUPABASE_URL}/storage/v1/upload/resumable`;

/** 6MB is the minimum chunk size required by Supabase's TUS implementation. */
const CHUNK_SIZE = 6 * 1024 * 1024;

export interface ResumableUploadHandle {
  abort: () => void;
  pause: () => void;
  resume: () => void;
}

export interface ResumableUploadOptions {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  upsert?: boolean;
}

export async function startResumableUpload(opts: ResumableUploadOptions): Promise<ResumableUploadHandle> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const upload = new tus.Upload(opts.file, {
    endpoint: RESUMABLE_ENDPOINT,
    retryDelays: [0, 1000, 3000, 5000, 10000],
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "x-upsert": opts.upsert ? "true" : "false",
    },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    metadata: {
      bucketName: opts.bucket,
      objectName: opts.path,
      contentType: opts.file.type || "application/octet-stream",
      cacheControl: "3600",
    },
    chunkSize: CHUNK_SIZE,
    onError: (error) => {
      console.error("[resumable-upload] error", error);
      opts.onError?.(error);
    },
    onProgress: (bytesUploaded, bytesTotal) => {
      opts.onProgress?.(bytesUploaded, bytesTotal);
    },
    onSuccess: () => {
      opts.onSuccess?.();
    },
  });

  // Resume any in-flight upload of the same file.
  const previousUploads = await upload.findPreviousUploads();
  if (previousUploads.length > 0) {
    upload.resumeFromPreviousUpload(previousUploads[0]);
  }
  upload.start();

  return {
    abort: () => upload.abort(true),
    pause: () => upload.abort(false),
    resume: () => upload.start(),
  };
}
