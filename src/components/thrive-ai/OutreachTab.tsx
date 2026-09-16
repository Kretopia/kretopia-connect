import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { GmailSettings } from "@/components/sales/GmailSettings";
import { EmailSetupWizard } from "@/components/sales/EmailSetupWizard";

import type { Lead } from "./outreach/types";
import { useOutreachData } from "./outreach/useOutreachData";
import { useOutreachMutations } from "./outreach/useOutreachMutations";
import { useOutreachMedia } from "./outreach/useOutreachMedia";
import { useBulkSend } from "./outreach/useBulkSend";
import { OutreachTopBar } from "./outreach/OutreachTopBar";
import { SequenceCard } from "./outreach/SequenceCard";
import { CampaignHistory } from "./outreach/CampaignHistory";
import { ComposeDialog } from "./outreach/ComposeDialog";
import { BulkSendDialog } from "./outreach/BulkSendDialog";
import { AddEmailStepDialog } from "./outreach/AddEmailStepDialog";
import { LinkLeadDialog } from "./outreach/LinkLeadDialog";
import { SaveTemplateDialog } from "./outreach/SaveTemplateDialog";

const OutreachTab = () => {
  const { user, subscriptionInfo } = useAuth();
  const isPro = subscriptionInfo.subscribed;
  const queryClient = useQueryClient();

  // Local UI state
  const [addOpen, setAddOpen] = useState(false);
  const [addEmailTo, setAddEmailTo] = useState<string | null>(null);
  const [linkLeadTo, setLinkLeadTo] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeLead, setComposeLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ name: "", description: "", recipient_email: "" });
  const [emailForm, setEmailForm] = useState({ subject: "", body: "", delay_days: 0 });
  const [composeForm, setComposeForm] = useState({ to: "", subject: "", body: "" });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Data
  const {
    isEmailConfigured, sequences, sequencesLoading, allEmails, leads,
    bulkUsage, templates, unsubscribes, campaigns, currentMonth,
  } = useOutreachData(user?.id);

  const BULK_LIMIT = isPro ? 500 : 10;

  // Media + attachments
  const { mediaUploading, handleMediaInsert, uploadAttachments } = useOutreachMedia(user?.id);

  // Mutations
  const { addSequence, linkLead, addEmail, updateStatus, deleteSequence, deleteEmail } = useOutreachMutations({
    userId: user?.id,
    allEmails,
    onSequenceCreated: () => { setAddOpen(false); setForm({ name: "", description: "", recipient_email: "" }); },
    onLeadLinked: () => setLinkLeadTo(null),
    onEmailAdded: () => { setAddEmailTo(null); setEmailForm({ subject: "", body: "", delay_days: 0 }); },
  });

  // Bulk send
  const bulk = useBulkSend({
    userId: user?.id, leads, unsubscribes, bulkUsage, bulkLimit: BULK_LIMIT, isPro, currentMonth, uploadAttachments,
  });

  const getLeadForSequence = (leadId: string | null) => leads.find((l) => l.id === leadId) || null;

  // AI generate (compose / sequence step)
  const handleGenerate = async (lead?: Lead | null, sequenceName?: string) => {
    setGenerating(true);
    try {
      const target = lead || composeLead;
      const { data, error } = await supabase.functions.invoke("send-outreach-email", {
        body: {
          action: "generate",
          leadName: target?.name || "the recipient",
          leadEmail: target?.email,
          leadCompany: target?.company,
          leadNotes: target?.notes,
          leadType: target?.type,
          sequenceName,
        },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }

      if (addEmailTo) setEmailForm((prev) => ({ ...prev, subject: data.subject, body: data.body }));
      else setComposeForm((prev) => ({ ...prev, subject: data.subject, body: data.body, to: target?.email || prev.to }));
      toast.success("Draft generated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate email");
    } finally {
      setGenerating(false);
    }
  };

  // Send single (compose) email
  const handleSendCompose = async () => {
    if (!composeForm.to || !composeForm.subject || !composeForm.body) return;
    setSending("compose");
    try {
      const attachmentUrls = attachments.length > 0 ? await uploadAttachments(attachments) : [];
      let finalBody = composeForm.body;
      if (attachmentUrls.length > 0) {
        finalBody += "\n\n---\nAttachments:\n" + attachmentUrls.map((a) => `• ${a.name}: ${a.url}`).join("\n");
      }
      const { data, error } = await supabase.functions.invoke("send-outreach-email", {
        body: { action: "send", to: composeForm.to, subject: composeForm.subject, body: finalBody, leadId: composeLead?.id },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Email sent to ${composeForm.to}`);
      setComposeOpen(false);
      setComposeForm({ to: "", subject: "", body: "" });
      setComposeLead(null);
      setAttachments([]);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (e) {
      console.error(e);
      toast.error("Failed to send email");
    } finally {
      setSending(null);
    }
  };

  // Send next email in a sequence
  const handleSendSequence = async (sequenceId: string) => {
    setSending(sequenceId);
    try {
      const { data, error } = await supabase.functions.invoke("send-outreach-email", {
        body: { action: "send_sequence", sequenceId },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Email sent! ${data.remaining} remaining in sequence.`);
      queryClient.invalidateQueries({ queryKey: ["outreach_sequences"] });
      queryClient.invalidateQueries({ queryKey: ["sequence_emails"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (e) {
      console.error(e);
      toast.error("Failed to send sequence email");
    } finally {
      setSending(null);
    }
  };

  // Templates
  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !bulk.state.bulkSubject.trim() || !bulk.state.bulkBody.trim()) {
      toast.error("Name, subject, and body required");
      return;
    }
    const { error } = await supabase.from("email_templates").insert({
      user_id: user!.id, name: templateName, subject: bulk.state.bulkSubject, body: bulk.state.bulkBody,
    });
    if (error) { toast.error("Failed to save template"); return; }
    toast.success("Template saved!");
    setSaveTemplateOpen(false);
    setTemplateName("");
    queryClient.invalidateQueries({ queryKey: ["email_templates"] });
  };

  const handleLoadTemplate = (templateId: string) => {
    const t = templates.find((t: any) => t.id === templateId);
    if (t) {
      bulk.setters.setBulkSubject(t.subject);
      bulk.setters.setBulkBody(t.body);
      bulk.setters.setSelectedTemplate(templateId);
      toast.success(`Loaded template: ${t.name}`);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from("email_templates").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["email_templates"] });
    toast.success("Template deleted");
  };

  const openComposeForLead = (lead: Lead) => {
    setComposeLead(lead);
    setComposeForm({ to: lead.email || "", subject: "", body: "" });
    setComposeOpen(true);
  };

  // Bulk dialog AI generate
  const handleBulkAiGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-outreach-email", {
        body: { action: "generate", leadName: "{name}", purpose: "bulk outreach to multiple leads" },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      bulk.setters.setBulkSubject(data.subject);
      bulk.setters.setBulkBody(data.body);
      toast.success("Draft generated");
    } catch { toast.error("Failed to generate"); } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-4">
      <OutreachTopBar
        sequenceCount={sequences.length}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onOpenCompose={() => { setComposeOpen(true); setComposeLead(null); setComposeForm({ to: "", subject: "", body: "" }); }}
        onOpenBulk={() => bulk.setters.setBulkOpen(true)}
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        form={form}
        setForm={setForm}
        onCreateSequence={() => addSequence.mutate(form)}
        isCreating={addSequence.isPending}
      />

      {!isEmailConfigured && <EmailSetupWizard onComplete={() => queryClient.invalidateQueries({ queryKey: ["user_email_settings"] })} />}
      {showSettings && isEmailConfigured && <GmailSettings />}

      {/* Quick-send leads strip */}
      {leads.filter((l) => l.email).length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Quick email a lead:</p>
          <div className="flex flex-wrap gap-1.5">
            {leads.filter((l) => l.email).slice(0, 10).map((lead) => (
              <Button key={lead.id} size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => openComposeForLead(lead)}>
                <Mail className="h-3 w-3" /> {lead.name}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Sequences */}
      {sequencesLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading sequences...</div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">No sequences yet</p>
          <p className="text-xs">Create an email sequence or use Quick Send to reach out to leads</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => {
            const seqEmails = allEmails.filter((e) => e.sequence_id === seq.id);
            const linkedLead = getLeadForSequence(seq.lead_id);
            return (
              <SequenceCard
                key={seq.id}
                seq={seq}
                emails={seqEmails}
                linkedLead={linkedLead}
                sending={sending}
                generating={generating}
                onSendNext={() => handleSendSequence(seq.id)}
                onLinkLead={() => setLinkLeadTo(seq.id)}
                onUpdateStatus={(status) => updateStatus.mutate({ id: seq.id, status })}
                onDeleteSequence={() => deleteSequence.mutate(seq.id)}
                onAddEmailStep={() => { setAddEmailTo(seq.id); setEmailForm({ subject: "", body: "", delay_days: 0 }); }}
                onGenerate={() => handleGenerate(linkedLead, seq.name)}
                onDeleteEmail={(id) => deleteEmail.mutate(id)}
              />
            );
          })}
        </div>
      )}

      <CampaignHistory
        campaigns={campaigns}
        onDuplicate={(subject, body) => {
          bulk.setters.setBulkSubject(subject);
          bulk.setters.setBulkBody(body);
          bulk.setters.setBulkOpen(true);
        }}
      />

      <AddEmailStepDialog
        open={!!addEmailTo}
        onClose={() => { setAddEmailTo(null); setEmailForm({ subject: "", body: "", delay_days: 0 }); }}
        emailForm={emailForm}
        setEmailForm={setEmailForm}
        generating={generating}
        isAdding={addEmail.isPending}
        onGenerate={() => {
          const seq = sequences.find((s) => s.id === addEmailTo);
          const lead = seq ? getLeadForSequence(seq.lead_id) : null;
          handleGenerate(lead, seq?.name);
        }}
        onAdd={() => addEmailTo && addEmail.mutate({ sequenceId: addEmailTo, emailForm })}
      />

      <LinkLeadDialog
        open={!!linkLeadTo}
        onClose={() => setLinkLeadTo(null)}
        leads={leads}
        onLink={(leadId) => linkLeadTo && linkLead.mutate({ sequenceId: linkLeadTo, leadId })}
      />

      <ComposeDialog
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setComposeLead(null); }}
        composeLead={composeLead}
        composeForm={composeForm}
        setComposeForm={setComposeForm}
        attachments={attachments}
        setAttachments={setAttachments}
        generating={generating}
        sending={sending}
        mediaUploading={mediaUploading}
        onGenerate={() => handleGenerate()}
        onSend={handleSendCompose}
        onMediaInsert={(file, type) =>
          handleMediaInsert(file, type, (fn) =>
            setComposeForm((prev) => ({ ...prev, body: typeof fn === "function" ? fn(prev.body) : fn }))
          )
        }
      />

      <BulkSendDialog
        open={bulk.state.bulkOpen}
        onClose={() => bulk.setters.setBulkOpen(false)}
        bulkMode={bulk.state.bulkMode}
        setBulkMode={bulk.setters.setBulkMode}
        manualEmails={bulk.state.manualEmails}
        setManualEmails={bulk.setters.setManualEmails}
        bulkSelected={bulk.state.bulkSelected}
        csvEmails={bulk.state.csvEmails}
        bulkSubject={bulk.state.bulkSubject}
        setBulkSubject={bulk.setters.setBulkSubject}
        bulkBody={bulk.state.bulkBody}
        setBulkBody={bulk.setters.setBulkBody}
        bulkSending={bulk.state.bulkSending}
        bulkProgress={bulk.state.bulkProgress}
        bulkScheduledFor={bulk.state.bulkScheduledFor}
        setBulkScheduledFor={bulk.setters.setBulkScheduledFor}
        bulkAttachments={bulk.state.bulkAttachments}
        setBulkAttachments={bulk.setters.setBulkAttachments}
        selectedTemplate={bulk.state.selectedTemplate}
        leads={leads}
        templates={templates}
        campaigns={campaigns}
        bulkUsage={bulkUsage}
        bulkLimit={BULK_LIMIT}
        generating={generating}
        setGenerating={setGenerating}
        mediaUploading={mediaUploading}
        onCsvUpload={bulk.actions.handleCsvUpload}
        toggleBulkSelect={bulk.actions.toggleBulkSelect}
        selectAllLeads={bulk.actions.selectAllLeads}
        onSend={bulk.actions.handleBulkSend}
        onMediaInsert={(file, type) =>
          handleMediaInsert(file, type, (fn) =>
            bulk.setters.setBulkBody(typeof fn === "function" ? fn(bulk.state.bulkBody) : fn)
          )
        }
        onAiGenerate={handleBulkAiGenerate}
        onLoadTemplate={handleLoadTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onOpenSaveTemplate={() => setSaveTemplateOpen(true)}
      />

      <SaveTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        templateName={templateName}
        setTemplateName={setTemplateName}
        bulkSubject={bulk.state.bulkSubject}
        onSave={handleSaveTemplate}
      />
    </div>
  );
};

export default OutreachTab;
