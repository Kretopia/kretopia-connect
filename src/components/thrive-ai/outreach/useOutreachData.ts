import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Sequence, SequenceEmail } from "./types";

export const useOutreachData = (userId: string | undefined) => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: emailSettings } = useQuery({
    queryKey: ["user_email_settings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_email_settings" as any)
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!userId,
  });

  const { data: sequences = [], isLoading: sequencesLoading } = useQuery({
    queryKey: ["outreach_sequences", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_sequences")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sequence[];
    },
    enabled: !!userId,
  });

  const { data: allEmails = [] } = useQuery({
    queryKey: ["sequence_emails", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequence_emails")
        .select("*")
        .eq("user_id", userId!)
        .order("step_number", { ascending: true });
      if (error) throw error;
      return data as SequenceEmail[];
    },
    enabled: !!userId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, company, notes, type")
        .eq("user_id", userId!)
        .order("name");
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!userId,
  });

  const { data: bulkUsage } = useQuery({
    queryKey: ["bulk_email_usage", userId, currentMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("bulk_email_usage")
        .select("send_count")
        .eq("user_id", userId!)
        .eq("month", currentMonth)
        .maybeSingle();
      return data?.send_count || 0;
    },
    enabled: !!userId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["email_templates", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: unsubscribes = [] } = useQuery({
    queryKey: ["email_unsubscribes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_unsubscribes")
        .select("email")
        .eq("sender_id", userId!);
      if (error) throw error;
      return data.map((u) => u.email);
    },
    enabled: !!userId,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["email_campaigns", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  return {
    emailSettings,
    isEmailConfigured: !!emailSettings?.is_configured,
    sequences,
    sequencesLoading,
    allEmails,
    leads,
    bulkUsage,
    templates,
    unsubscribes,
    campaigns,
    currentMonth,
  };
};
