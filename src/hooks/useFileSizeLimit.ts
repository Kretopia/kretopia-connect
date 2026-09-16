import { useAuth } from "@/hooks/useAuth";
import { useStorageQuota } from "@/hooks/useStorageQuota";
import { getPerFileLimit, formatBytes, TIER_LABELS } from "@/lib/fileSizeLimits";

/**
 * Pre-upload validator. Checks BOTH:
 *   1. Per-file cap (tier-based)
 *   2. Remaining total storage quota
 *
 * Server-side `enforce_storage_quota` trigger is the hard authority,
 * but checking client-side gives instant UX feedback before the upload starts.
 */
export function useFileSizeLimit() {
  const { subscriptionInfo } = useAuth();
  const { data: quota } = useStorageQuota();
  const tier = subscriptionInfo?.tier ?? "free";
  const limit = getPerFileLimit(tier as any);

  return {
    tier,
    tierLabel: TIER_LABELS[tier] ?? "Spark (Free)",
    limit,
    limitLabel: formatBytes(limit),
    quota,
    /** Returns true if file is allowed; otherwise false + reason for toast. */
    check: (size: number) => {
      if (size > limit) {
        return {
          ok: false as const,
          reason: `${formatBytes(size)} exceeds your ${formatBytes(limit)} per-file limit on ${TIER_LABELS[tier] ?? "your plan"}.`,
        };
      }
      if (quota && size > quota.remaining) {
        return {
          ok: false as const,
          reason: `Not enough storage: ${formatBytes(size)} needed but only ${formatBytes(quota.remaining)} left of your ${formatBytes(quota.limit)} plan. Upgrade or free up space.`,
        };
      }
      return { ok: true as const };
    },
    /** Same as check() but for an array of files (sums sizes). */
    checkBatch: (files: File[]) => {
      const totalSize = files.reduce((s, f) => s + f.size, 0);
      const oversize = files.find((f) => f.size > limit);
      if (oversize) {
        return {
          ok: false as const,
          reason: `"${oversize.name}" (${formatBytes(oversize.size)}) exceeds your ${formatBytes(limit)} per-file limit.`,
        };
      }
      if (quota && totalSize > quota.remaining) {
        return {
          ok: false as const,
          reason: `Batch needs ${formatBytes(totalSize)} but only ${formatBytes(quota.remaining)} left in your plan.`,
        };
      }
      return { ok: true as const };
    },
  };
}
