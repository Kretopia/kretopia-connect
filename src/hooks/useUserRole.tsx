import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "moderator" | "user" | "writer";

/**
 * Returns the set of roles the current user has.
 * Provides quick booleans for the most common gates.
 */
export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setRoles(((data || []).map(r => r.role)) as AppRole[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const isAdmin = roles.includes("admin");
  const isWriter = roles.includes("writer");
  const isEditorOrAdmin = isAdmin || isWriter;

  return { roles, isAdmin, isWriter, isEditorOrAdmin, loading };
};
