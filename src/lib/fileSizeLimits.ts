/**
 * Per-file upload size caps + total storage caps by subscription tier.
 * These are the single source of truth referenced by the DB function
 * `get_tier_storage_limit` and the client-side `useStorageQuota` hook.
 *
 * Industry context (per-file):
 *   - Frame.io Pro: 8GB · Team: 20GB
 *   - Dropbox Plus: 375GB (desktop), 50GB (web)
 *   - Vimeo Premium: 8GB · Behance: 500MB video
 *   - Notion paid: unlimited · Slack: 1GB
 *
 * Our tiers:
 *   Spark (free):  250 MB / file   ·   2 GB total
 *   Creator:         2 GB / file   ·  25 GB total
 *   Creator+:       10 GB / file   · 100 GB total
 *   Founder:        25 GB / file   ·   1 TB total
 */

import type { SubscriptionTier } from "./subscriptionConfig";

export const PER_FILE_LIMITS: Record<string, number> = {
  free:              250 * 1024 * 1024,      // 250 MB
  pro:                 2 * 1024 * 1024 * 1024, // 2 GB (legacy "pro" == Creator)
  creator_pro:        10 * 1024 * 1024 * 1024, // 10 GB
  founder:            25 * 1024 * 1024 * 1024, // 25 GB
  brand_pro:           2 * 1024 * 1024 * 1024,
  brand_enterprise:   25 * 1024 * 1024 * 1024,
};

export const TIER_LABELS: Record<string, string> = {
  free: "Spark (Free)",
  pro: "Creator",
  creator_pro: "Creator+",
  founder: "Founder Circle",
  brand_pro: "Brand Pro",
  brand_enterprise: "Brand Enterprise",
};

export function getPerFileLimit(tier: SubscriptionTier | string | undefined): number {
  if (!tier) return PER_FILE_LIMITS.free;
  return PER_FILE_LIMITS[tier] ?? PER_FILE_LIMITS.free;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes % (1024 ** 3) === 0 ? 0 : 1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Marketing summary for upgrade prompts. */
export const TIER_FILE_SUMMARY = [
  { tier: "free",        label: "Spark",    perFile: "250 MB", total: "2 GB" },
  { tier: "pro",         label: "Creator",  perFile: "2 GB",   total: "25 GB" },
  { tier: "creator_pro", label: "Creator+", perFile: "10 GB",  total: "100 GB" },
  { tier: "founder",     label: "Founder",  perFile: "25 GB",  total: "1 TB" },
] as const;

/** Total storage caps (mirror of get_tier_storage_limit in DB). */
export const TOTAL_STORAGE_LIMITS: Record<string, number> = {
  free:              2 * 1024 ** 3,           //   2 GB
  pro:              25 * 1024 ** 3,           //  25 GB
  creator_pro:     100 * 1024 ** 3,           // 100 GB
  founder:        1024 * 1024 ** 3,           //   1 TB
  brand_pro:       100 * 1024 ** 3,
  brand_enterprise: 512 * 1024 ** 3,          // 512 GB
};
