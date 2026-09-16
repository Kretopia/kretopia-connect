import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DuplicateCandidate {
  candidate_user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  match_email_local: boolean;
  match_phone: boolean;
  match_name: boolean;
  overlap_count: number;
  confidence: number;
  masked_email: string | null;
}

const DISMISS_KEY = "thrivein_dismissed_dupe_accounts";

export const dismissDuplicateCandidate = (id: string) => {
  try {
    const arr = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
    if (!arr.includes(id)) arr.push(id);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(arr));
  } catch {}
};

export const useDuplicateAccountCandidates = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["duplicate-account-candidates", user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<DuplicateCandidate[]> => {
      const { data, error } = await supabase.functions
        .invoke("detect-duplicate-accounts")
        .catch((e) => ({ data: null, error: e }));
      if (error || !data?.candidates) return [];
      let dismissed: string[] = [];
      try {
        dismissed = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
      } catch {}
      return (data.candidates as DuplicateCandidate[]).filter(
        (c) => !dismissed.includes(c.candidate_user_id),
      );
    },
  });
};
