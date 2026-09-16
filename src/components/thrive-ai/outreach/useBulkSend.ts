import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Lead } from "./types";
import { useOutreachMedia } from "./useOutreachMedia";

interface Args {
  userId: string | undefined;
  leads: Lead[];
  unsubscribes: string[];
  bulkUsage: number | undefined;
  bulkLimit: number;
  isPro: boolean;
  currentMonth: string;
  uploadAttachments: ReturnType<typeof useOutreachMedia>["uploadAttachments"];
}

export const useBulkSend = ({
  userId, leads, unsubscribes, bulkUsage, bulkLimit, isPro, currentMonth, uploadAttachments,
}: Args) => {
  const queryClient = useQueryClient();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"select" | "csv" | "manual">("select");
  const [manualEmails, setManualEmails] = useState("");
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [csvEmails, setCsvEmails] = useState<{ name: string; email: string }[]>([]);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkScheduledFor, setBulkScheduledFor] = useState("");
  const [bulkAttachments, setBulkAttachments] = useState<File[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const parsed: { name: string; email: string }[] = [];
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (i === 0 && (cols[0]?.toLowerCase() === "name" || cols[0]?.toLowerCase() === "email")) continue;
        const email = cols.find((c) => c.includes("@"));
        const name = cols.find((c) => !c.includes("@")) || email || "";
        if (email) parsed.push({ name: name!, email });
      }
      setCsvEmails(parsed);
      toast.success(`Parsed ${parsed.length} emails from CSV`);
    };
    reader.readAsText(file);
  };

  const toggleBulkSelect = (id: string) =>
    setBulkSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectAllLeads = () => {
    const withEmail = leads.filter((l) => l.email).map((l) => l.id);
    setBulkSelected((prev) => (prev.length === withEmail.length ? [] : withEmail));
  };

  const handleBulkSend = async () => {
    let recipients =
      bulkMode === "csv"
        ? csvEmails
        : bulkMode === "manual"
        ? manualEmails
            .split(/[,;\n]+/)
            .map((e) => e.trim())
            .filter((e) => e.includes("@"))
            .map((e) => ({ name: e.split("@")[0], email: e }))
        : leads.filter((l) => bulkSelected.includes(l.id) && l.email).map((l) => ({ name: l.name, email: l.email! }));

    if (recipients.length === 0) {
      toast.error("No recipients selected");
      return;
    }
    if (!bulkSubject.trim() || !bulkBody.trim()) {
      toast.error("Subject and body required");
      return;
    }

    const unsubSet = new Set(unsubscribes);
    const filtered = recipients.filter((r) => !unsubSet.has(r.email));
    const skipped = recipients.length - filtered.length;
    recipients = filtered;
    if (skipped > 0) toast.info(`${skipped} unsubscribed email(s) excluded`);
    if (recipients.length === 0) {
      toast.error("All recipients are unsubscribed");
      return;
    }

    const used = bulkUsage || 0;
    const remaining = bulkLimit - used;
    if (remaining <= 0) {
      toast.error(
        `Monthly bulk email limit reached (${bulkLimit}). ${!isPro ? "Upgrade to Pro for 500/mo." : "Limit resets next month."}`
      );
      return;
    }
    if (recipients.length > remaining) {
      recipients = recipients.slice(0, remaining);
      toast.info(`Capped to ${remaining} remaining sends this month`);
    }

    const { data: campaign, error: campErr } = await supabase
      .from("email_campaigns")
      .insert({
        user_id: userId!,
        name: bulkSubject,
        subject: bulkSubject,
        body: bulkBody,
        status: bulkScheduledFor ? "scheduled" : "sending",
        total_recipients: recipients.length,
        scheduled_for: bulkScheduledFor || null,
      })
      .select("id")
      .single();

    if (campErr) {
      toast.error("Failed to create campaign");
      return;
    }

    if (bulkScheduledFor) {
      const recipientRows = recipients.map((r) => ({
        campaign_id: campaign.id,
        user_id: userId!,
        email: r.email,
        name: r.name,
        status: "pending",
      }));
      await supabase.from("campaign_recipients").insert(recipientRows);
      toast.success(`Campaign scheduled for ${format(new Date(bulkScheduledFor), "PPP p")}`);
      setBulkOpen(false);
      queryClient.invalidateQueries({ queryKey: ["email_campaigns"] });
      return;
    }

    setBulkSending(true);
    setBulkProgress(0);
    let sent = 0;
    let failed = 0;

    const bulkAttachmentUrls = bulkAttachments.length > 0 ? await uploadAttachments(bulkAttachments) : [];

    let bodyAppend = "";
    if (bulkAttachmentUrls.length > 0) {
      const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"];
      const images = bulkAttachmentUrls.filter((a) => imageExts.some((ext) => a.name.toLowerCase().endsWith(ext)));
      const others = bulkAttachmentUrls.filter((a) => !imageExts.some((ext) => a.name.toLowerCase().endsWith(ext)));
      if (images.length > 0) {
        bodyAppend += "\n\n" + images.map((a) => `[image:${a.url}|${a.name}]`).join("\n\n");
      }
      if (others.length > 0) {
        bodyAppend += "\n\n---\nAttachments:\n" + others.map((a) => `• ${a.name}: ${a.url}`).join("\n");
      }
    }
    bodyAppend += `\n\n---\nDon't want these emails? Reply "unsubscribe" to opt out.`;

    for (const r of recipients) {
      try {
        const personalBody = (bulkBody + bodyAppend).replace(/\{name\}/gi, r.name).replace(/\{email\}/gi, r.email);
        const personalSubject = bulkSubject.replace(/\{name\}/gi, r.name);
        const { data, error } = await supabase.functions.invoke("send-outreach-email", {
          body: { action: "send", to: r.email, subject: personalSubject, body: personalBody },
        });
        if (error || data?.error) failed++;
        else sent++;
      } catch {
        failed++;
      }
      setBulkProgress(Math.round(((sent + failed) / recipients.length) * 100));
    }

    await supabase
      .from("email_campaigns")
      .update({ status: "sent", sent_count: sent, failed_count: failed, sent_at: new Date().toISOString() })
      .eq("id", campaign.id);

    await supabase.from("bulk_email_usage").upsert(
      { user_id: userId!, month: currentMonth, send_count: used + sent },
      { onConflict: "user_id,month" }
    );

    setBulkSending(false);
    setBulkAttachments([]);
    toast.success(`Campaign complete: ${sent} sent, ${failed} failed`);
    queryClient.invalidateQueries({ queryKey: ["emails-sent-stats"] });
    queryClient.invalidateQueries({ queryKey: ["bulk_email_usage"] });
    queryClient.invalidateQueries({ queryKey: ["email_campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    setBulkOpen(false);
    setBulkSelected([]);
    setCsvEmails([]);
    setBulkSubject("");
    setBulkBody("");
    setBulkScheduledFor("");
  };

  return {
    state: {
      bulkOpen, bulkMode, manualEmails, bulkSelected, csvEmails, bulkSubject, bulkBody,
      bulkSending, bulkProgress, bulkScheduledFor, bulkAttachments, selectedTemplate,
    },
    setters: {
      setBulkOpen, setBulkMode, setManualEmails, setBulkSelected, setCsvEmails, setBulkSubject,
      setBulkBody, setBulkScheduledFor, setBulkAttachments, setSelectedTemplate,
    },
    actions: { handleCsvUpload, toggleBulkSelect, selectAllLeads, handleBulkSend },
  };
};
