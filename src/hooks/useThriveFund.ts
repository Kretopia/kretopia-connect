import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CampaignStatus = "draft" | "active" | "funded" | "failed" | "cancelled" | "completed";

export interface Campaign {
  id: string;
  creator_id: string;
  project_id: string | null;
  slug: string;
  title: string;
  tagline: string | null;
  story: string | null;
  category: string | null;
  cover_image_url: string | null;
  video_url: string | null;
  goal_amount: number;
  currency: string;
  total_raised: number;
  backer_count: number;
  deadline: string;
  funding_model: "all_or_nothing" | "keep_it_all";
  status: CampaignStatus;
  platform_fee_pct: number;
  milestone_split: { label: string; pct: number }[];
  launched_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PledgeTier {
  id: string;
  campaign_id: string;
  amount: number;
  title: string;
  description: string | null;
  reward_type: string | null;
  estimated_delivery: string | null;
  max_backers: number | null;
  claimed_count: number;
  display_order: number;
  is_active: boolean;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const useActiveCampaigns = () => {
  return useQuery({
    queryKey: ["thrivefund", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .in("status", ["active", "funded"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });
};

export const useCampaignBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["thrivefund", "slug", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as Campaign | null;
    },
    enabled: !!slug,
  });
};

export const useMyCampaigns = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["thrivefund", "mine", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
    enabled: !!user,
  });
};

export const useCampaignTiers = (campaignId: string | undefined) => {
  return useQuery({
    queryKey: ["thrivefund", "tiers", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("pledge_tiers")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("display_order", { ascending: true })
        .order("amount", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PledgeTier[];
    },
    enabled: !!campaignId,
  });
};

export const useCreateCampaign = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      tagline?: string;
      story?: string;
      category?: string;
      cover_image_url?: string;
      goal_amount: number;
      currency?: string;
      deadline: string;
      project_id?: string | null;
      tiers?: Omit<PledgeTier, "id" | "campaign_id" | "claimed_count">[];
      publish?: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const baseSlug = slugify(input.title) || `campaign-${Date.now()}`;
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: campaign, error } = await supabase
        .from("campaigns")
        .insert({
          creator_id: user.id,
          project_id: input.project_id ?? null,
          slug,
          title: input.title,
          tagline: input.tagline ?? null,
          story: input.story ?? null,
          category: input.category ?? null,
          cover_image_url: input.cover_image_url ?? null,
          goal_amount: input.goal_amount,
          currency: input.currency ?? "USD",
          deadline: input.deadline,
          status: input.publish ? "active" : "draft",
          launched_at: input.publish ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.tiers && input.tiers.length > 0) {
        const tierRows = input.tiers.map((t, i) => ({
          campaign_id: campaign.id,
          amount: t.amount,
          title: t.title,
          description: t.description ?? null,
          reward_type: t.reward_type ?? "digital",
          estimated_delivery: t.estimated_delivery ?? null,
          max_backers: t.max_backers ?? null,
          display_order: t.display_order ?? i,
          is_active: t.is_active ?? true,
        }));
        const { error: tErr } = await supabase.from("pledge_tiers").insert(tierRows);
        if (tErr) throw tErr;
      }

      // Run AI moderation when publishing
      let moderation: { decision: "approve" | "review" | "block"; reason: string; risk_score: number } | null = null;
      if (input.publish) {
        try {
          const { data: mod, error: mErr } = await supabase.functions.invoke("moderate-campaign", {
            body: { campaignId: campaign.id },
          });
          if (mErr) throw mErr;
          moderation = mod as typeof moderation;
        } catch (e) {
          console.error("Moderation invoke failed", e);
        }
      }

      return { ...(campaign as unknown as Campaign), moderation };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thrivefund"] });
    },
  });
};

export const useCreatePledge = () => {
  return useMutation({
    mutationFn: async (input: {
      campaignId: string;
      tierId?: string | null;
      amount: number;
      isAnonymous?: boolean;
      backerMessage?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("thrivefund-create-pledge", {
        body: input,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { url: string; sessionId: string; pledgeId: string };
    },
  });
};
