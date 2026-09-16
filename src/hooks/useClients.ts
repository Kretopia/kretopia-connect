import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Client {
  id: string;
  owner_id: string;
  name: string;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  brand_color: string | null;
  logo_url: string | null;
  default_currency: string | null;
  default_markup_pct: number | null;
  payment_terms: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useClients = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      if (!user) return [] as Client[];
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .is("archived_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Client[];
    },
    enabled: !!user,
  });
};

export const useClient = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
    enabled: !!clientId,
  });
};

export const useClientProjects = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,status,mood,workspace_type,updated_at,created_at,due_date")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });
};

export const useClientContacts = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ["client-contacts", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });
};

export const useUpsertClient = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<Client> & { name: string }) => {
      if (!user) throw new Error("Not signed in");
      if (payload.id) {
        const { data, error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", payload.id)
          .select("*")
          .single();
        if (error) throw error;
        return data as Client;
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert({ ...payload, owner_id: user.id })
          .select("*")
          .single();
        if (error) throw error;
        return data as Client;
      }
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (c?.id) qc.invalidateQueries({ queryKey: ["client", c.id] });
    },
  });
};

export const useLinkProjectToClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, clientId }: { projectId: string; clientId: string | null }) => {
      const { error } = await supabase
        .from("projects")
        .update({ client_id: clientId })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["client-projects"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};
