import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { identityStatusFromServer, type IdentityStatus } from "@/lib/identity/identityVerification";

/**
 * The signed-in member's identity-verification state, read from the server: their own profile row's `id_verified`, a column clients cannot
 * write. The hook has no setter and takes no "verified" from any component; a member who has not been verified by the server is
 * `not_started`, whatever the page believes.
 */
export function useIdentityVerificationStatus(userId: string | null | undefined) {
  return useQuery<IdentityStatus>({
    queryKey: ["identity-verification", userId ?? null],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id_verified").eq("user_id", userId as string).maybeSingle();
      if (error) throw error;
      return identityStatusFromServer({ id_verified: (data as { id_verified?: boolean | null } | null)?.id_verified ?? null });
    },
  });
}
