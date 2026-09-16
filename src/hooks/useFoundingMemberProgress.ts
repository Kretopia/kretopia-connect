import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FOUNDING_QUESTS, type FoundingQuestKey } from "@/lib/foundingMember";

export interface QuestProgress {
  key: FoundingQuestKey;
  current: number;
  target: number;
  completed: boolean;
}

interface State {
  loading: boolean;
  progress: Record<FoundingQuestKey, QuestProgress>;
  completedCount: number;
  allComplete: boolean;
  badgeAwarded: boolean;
  refresh: () => Promise<void>;
}

const emptyProgress = (): Record<FoundingQuestKey, QuestProgress> => ({
  claim_profile: { key: "claim_profile", current: 0, target: 1, completed: false },
  log_credits: { key: "log_credits", current: 0, target: 3, completed: false },
  invite_signups: { key: "invite_signups", current: 0, target: 3, completed: false },
});

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn("[FoundingMember] query failed:", e);
    return fallback;
  }
}

export function useFoundingMemberProgress(): State {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<FoundingQuestKey, QuestProgress>>(emptyProgress());
  const [badgeAwarded, setBadgeAwarded] = useState(false);

  const compute = useCallback(async () => {
    if (!user) {
      setProgress(emptyProgress());
      setLoading(false);
      return;
    }
    setLoading(true);

    const next = emptyProgress();

    // 1. claim_profile — verification_score > 0
    const profileRow = await safe(
      async () => {
        const r = await supabase
          .from("profiles")
          .select("verification_score, badge")
          .eq("user_id", user.id)
          .maybeSingle();
        return r.data as { verification_score: number | null; badge: string | null } | null;
      },
      null,
    );
    const score = profileRow?.verification_score ?? 0;
    next.claim_profile.current = score > 0 ? 1 : 0;
    next.claim_profile.completed = score > 0;
    const currentBadge = profileRow?.badge ?? null;

    // 2. log_credits — credits row count
    const creditCount = await safe(async () => {
      const r = await supabase
        .from("credits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      return r.count ?? 0;
    }, 0);
    next.log_credits.current = Math.min(creditCount, 3);
    next.log_credits.completed = creditCount >= 3;

    // 3. invite_signups — referral_network active count
    const refCount = await safe(async () => {
      const r = await supabase
        .from("referral_network")
        .select("active_referral_count, referral_count")
        .eq("user_id", user.id)
        .maybeSingle();
      const row = r.data as { active_referral_count: number | null; referral_count: number | null } | null;
      return row?.active_referral_count ?? row?.referral_count ?? 0;
    }, 0);
    next.invite_signups.current = Math.min(refCount, 3);
    next.invite_signups.completed = refCount >= 3;

    setProgress(next);

    // Sync server-side quest rows (best-effort)
    await safe(async () => {
      const upserts = (Object.keys(next) as FoundingQuestKey[]).map((key) => ({
        user_id: user.id,
        quest_key: key,
        completed: next[key].completed,
        completed_at: next[key].completed ? new Date().toISOString() : null,
      }));
      await supabase
        .from("founding_member_quests")
        .upsert(upserts, { onConflict: "user_id,quest_key" });
      return null;
    }, null);

    const allComplete =
      next.claim_profile.completed &&
      next.log_credits.completed &&
      next.invite_signups.completed;

    if (
      allComplete &&
      currentBadge !== "founding_member" &&
      currentBadge !== "founder" &&
      currentBadge !== "og"
    ) {
      const awarded = await safe(async () => {
        const r = await supabase.rpc("award_founding_member_badge", { _user_id: user.id });
        return Boolean(r.data);
      }, false);
      setBadgeAwarded(awarded);
    } else {
      setBadgeAwarded(currentBadge === "founding_member");
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    compute();
  }, [compute]);

  const completedCount = (Object.values(progress) as QuestProgress[]).filter((q) => q.completed).length;
  const allComplete = completedCount === FOUNDING_QUESTS.length;

  return { loading, progress, completedCount, allComplete, badgeAwarded, refresh: compute };
}
