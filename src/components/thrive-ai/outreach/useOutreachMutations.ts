import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SequenceEmail } from "./types";

interface Args {
  userId: string | undefined;
  allEmails: SequenceEmail[];
  onSequenceCreated?: () => void;
  onLeadLinked?: () => void;
  onEmailAdded?: () => void;
}

export const useOutreachMutations = ({ userId, allEmails, onSequenceCreated, onLeadLinked, onEmailAdded }: Args) => {
  const queryClient = useQueryClient();

  const addSequence = useMutation({
    mutationFn: async (form: { name: string; description: string; recipient_email: string }) => {
      const { error } = await supabase.from("outreach_sequences").insert({
        user_id: userId!,
        name: form.name,
        description: form.description || null,
        recipient_email: form.recipient_email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach_sequences"] });
      onSequenceCreated?.();
      toast.success("Sequence created");
    },
    onError: () => toast.error("Failed to create sequence"),
  });

  const linkLead = useMutation({
    mutationFn: async ({ sequenceId, leadId }: { sequenceId: string; leadId: string | null }) => {
      const { error } = await supabase
        .from("outreach_sequences")
        .update({ lead_id: leadId })
        .eq("id", sequenceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach_sequences"] });
      onLeadLinked?.();
      toast.success("Lead linked");
    },
    onError: () => toast.error("Failed to link lead"),
  });

  const addEmail = useMutation({
    mutationFn: async ({ sequenceId, emailForm }: { sequenceId: string; emailForm: { subject: string; body: string; delay_days: number } }) => {
      const seqEmails = allEmails.filter((e) => e.sequence_id === sequenceId);
      const nextStep = seqEmails.length + 1;
      const { error } = await supabase.from("sequence_emails").insert({
        user_id: userId!,
        sequence_id: sequenceId,
        step_number: nextStep,
        subject: emailForm.subject,
        body: emailForm.body,
        delay_days: emailForm.delay_days,
      });
      if (error) throw error;
      await supabase.from("outreach_sequences").update({ total_steps: nextStep }).eq("id", sequenceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequence_emails"] });
      queryClient.invalidateQueries({ queryKey: ["outreach_sequences"] });
      onEmailAdded?.();
      toast.success("Email step added");
    },
    onError: () => toast.error("Failed to add email"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("outreach_sequences").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outreach_sequences"] }),
    onError: () => toast.error("Failed to update"),
  });

  const deleteSequence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("outreach_sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach_sequences"] });
      queryClient.invalidateQueries({ queryKey: ["sequence_emails"] });
      toast.success("Sequence deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const deleteEmail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sequence_emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequence_emails"] });
      toast.success("Email step removed");
    },
    onError: () => toast.error("Failed to delete"),
  });

  return { addSequence, linkLead, addEmail, updateStatus, deleteSequence, deleteEmail };
};
