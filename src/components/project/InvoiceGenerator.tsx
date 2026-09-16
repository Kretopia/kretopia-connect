import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Plus, Trash2, Mail, Download, Eye, Clock, CheckCircle2, Send, AlertCircle, Percent, DollarSign, Copy, CreditCard, Pencil, ArrowRightLeft, ScrollText, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { InvoiceBrandingForm, InvoiceBranding } from "./invoice/InvoiceBrandingForm";
import { InvoicePaymentForm, PaymentConfig } from "./invoice/InvoicePaymentForm";
import { InvoicePreview } from "./invoice/InvoicePreview";

import { PricingCoPilot } from "./invoice/PricingCoPilot";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { useAutoSaveDraft } from "@/hooks/useAutoSaveDraft";
import { recordMoneyAction } from "@/lib/moneyStreak";

interface InvoiceGeneratorProps {
  projectId?: string;
}

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

type DocumentType = "invoice" | "quote";
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];

export function InvoiceGenerator({ projectId }: InvoiceGeneratorProps) {
  const { user } = useAuth();
  const { guard: guardInvoice, remaining: invoicesRemaining, cap: invoicesCap } = useFeatureGate("invoices");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showListDialog, setShowListDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [createStep, setCreateStep] = useState<"details" | "branding" | "payment" | "preview">("details");
  const [loading, setLoading] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<"all" | "invoice" | "quote">("all");

  // Document type toggle
  const [documentType, setDocumentType] = useState<DocumentType>("invoice");
  const [validUntil, setValidUntil] = useState("");

  // Form state
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState("0");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, rate: 0, amount: 0 }
  ]);

  // Branding
  const [branding, setBranding] = useState<InvoiceBranding>({
    brand_name: "", brand_logo_url: "", brand_address: "",
    brand_email: "", brand_website: "", brand_color: "#6366f1"
  });

  // Payment
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    payment_method: "bank_transfer",
    payment_details: {},
    terms_conditions: ""
  });

  // Auto-save draft
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const DRAFT_KEY = `thrive_invoice_draft_${user?.id || "anon"}`;

  const draftData = useMemo(() => ({
    documentType, recipientName, recipientEmail, recipientAddress,
    dueDate, taxRate, notes, currency, discountType, discountValue,
    lineItems, branding, paymentConfig, validUntil, createStep,
  }), [documentType, recipientName, recipientEmail, recipientAddress,
    dueDate, taxRate, notes, currency, discountType, discountValue,
    lineItems, branding, paymentConfig, validUntil, createStep]);

  const { loadDraft, clearDraft, hasDraft } = useAutoSaveDraft(
    DRAFT_KEY, draftData, showCreateDialog && !editingInvoiceId
  );

  // Listen for "Draft invoice from this deliverable" intent dispatched from
  // the Studio Room when an owner approves a deliverable.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{
        tab?: string;
        intent?: string;
        payload?: { deliverable_id?: string; title?: string; amount?: number };
      }>).detail;
      if (!detail || detail.intent !== "draft-from-deliverable") return;
      const payload = detail.payload || {};
      const title = (payload.title || "Deliverable").slice(0, 200);
      const amount = typeof payload.amount === "number" ? payload.amount : 0;
      // Reset and prefill
      setEditingInvoiceId(null);
      setRecipientName("");
      setRecipientEmail("");
      setRecipientAddress("");
      setDueDate("");
      setTaxRate("0");
      setNotes("");
      setDiscountType("");
      setDiscountValue("0");
      setLineItems([{ description: title, quantity: 1, rate: amount, amount }]);
      setCreateStep("details");
      setDocumentType("invoice");
      setValidUntil("");
      setShowCreateDialog(true);
    };
    window.addEventListener("thrivedesk:intent", handler);
    return () => window.removeEventListener("thrivedesk:intent", handler);
  }, []);

  const restoreDraft = () => {
    const draft = loadDraft();
    if (!draft) return;
    const d = draft.data;
    setDocumentType(d.documentType || "invoice");
    setRecipientName(d.recipientName || "");
    setRecipientEmail(d.recipientEmail || "");
    setRecipientAddress(d.recipientAddress || "");
    setDueDate(d.dueDate || "");
    setTaxRate(d.taxRate || "0");
    setNotes(d.notes || "");
    setCurrency(d.currency || "USD");
    setDiscountType(d.discountType || "");
    setDiscountValue(d.discountValue || "0");
    setLineItems(d.lineItems?.length ? d.lineItems : [{ description: "", quantity: 1, rate: 0, amount: 0 }]);
    setBranding(d.branding || { brand_name: "", brand_logo_url: "", brand_address: "", brand_email: "", brand_website: "", brand_color: "#6366f1" });
    setPaymentConfig(d.paymentConfig || { payment_method: "bank_transfer", payment_details: {}, terms_conditions: "" });
    setValidUntil(d.validUntil || "");
    if (d.createStep) setCreateStep(d.createStep);
    setShowDraftBanner(false);
    toast.success("Draft restored!");
  };

  // Check for draft when opening create dialog
  useEffect(() => {
    if (showCreateDialog && !editingInvoiceId && hasDraft()) {
      setShowDraftBanner(true);
    } else {
      setShowDraftBanner(false);
    }
  }, [showCreateDialog, editingInvoiceId]);

  // Listen for global open events (from KrePay quick-add menu)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: DocumentType } | undefined;
      setDocumentType(detail?.type === "quote" ? "quote" : "invoice");
      setEditingInvoiceId(null);
      setCreateStep("details");
      setShowCreateDialog(true);
    };
    window.addEventListener("thrivepay:create-document", handler);
    return () => window.removeEventListener("thrivepay:create-document", handler);
  }, []);

  // Collaborators for recipient picker
  const [collaborators, setCollaborators] = useState<any[]>([]);

  useEffect(() => {
    fetchInvoices();
    if (projectId) fetchCollaborators();
  }, [projectId]);

  const fetchInvoices = async () => {
    try {
      let query = supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectId) {
        query = query.eq("project_id", projectId);
      } else {
        // Standalone invoices: fetch all invoices by this user (with or without project)
        query = query.eq("issued_by", user!.id);
      }

      const { data: invoicesData, error } = await query;

      if (error) throw error;

      if (invoicesData && invoicesData.length > 0) {
        const userIds = [...new Set([...invoicesData.map(inv => inv.issued_to).filter(Boolean), ...invoicesData.map(inv => inv.issued_by)])];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);

        const invoicesWithProfiles = invoicesData.map(inv => ({
          ...inv,
          issued_to_profile: profilesData?.find(p => p.user_id === inv.issued_to),
          issued_by_profile: profilesData?.find(p => p.user_id === inv.issued_by),
        }));
        setInvoices(invoicesWithProfiles);
      } else {
        setInvoices([]);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    }
  };

  const fetchCollaborators = async () => {
    try {
      // Get project match users + collaborators
      const { data: project } = await supabase
        .from("projects")
        .select("created_by, match_id")
        .eq("id", projectId)
        .single();

      if (!project) return;

      const userIds: string[] = [];
      if (project.match_id) {
        const { data: match } = await supabase
          .from("matches")
          .select("user1_id, user2_id")
          .eq("id", project.match_id)
          .single();
        if (match) {
          userIds.push(match.user1_id, match.user2_id);
        }
      }

      const { data: collabs } = await supabase
        .from("project_collaborators")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("status", "accepted");

      if (collabs) {
        userIds.push(...collabs.map(c => c.user_id));
      }

      const uniqueIds = [...new Set(userIds.filter(id => id !== user?.id))];
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", uniqueIds);
        setCollaborators(profiles || []);
      }
    } catch (err) {
      console.error("Error fetching collaborators:", err);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "rate") {
      updated[index].amount = updated[index].quantity * updated[index].rate;
    }
    setLineItems(updated);
  };

  const calculateSubtotal = () => lineItems.reduce((sum, item) => sum + item.amount, 0);
  const calculateDiscount = () => {
    const sub = calculateSubtotal();
    if (discountType === "percentage") return sub * (parseFloat(discountValue) / 100);
    if (discountType === "fixed") return parseFloat(discountValue) || 0;
    return 0;
  };
  const calculateTax = () => (calculateSubtotal() - calculateDiscount()) * (parseFloat(taxRate) / 100);
  const calculateTotal = () => calculateSubtotal() - calculateDiscount() + calculateTax();

  const handleCreateInvoice = async () => {
    if (!recipientName || lineItems.some(item => !item.description)) {
      toast.error("Please fill in client name and all line item descriptions");
      return;
    }
    if (!guardInvoice()) return;

    setLoading(true);
    try {
      const subtotal = calculateSubtotal();
      const tax = calculateTax();
      const total = calculateTotal();
      const prefix = documentType === "quote" ? "QUO" : "INV";
      const tempNumber = `${prefix}-${new Date().getFullYear()}-${Date.now()}`;

      const issuedTo = collaborators.find(c => c.full_name === recipientName)?.user_id || collaborators[0]?.user_id || null;

      const invoiceData: any = {
        invoice_number: tempNumber,
        project_id: projectId || null,
        issued_by: user?.id!,
        issued_to: issuedTo || user?.id!,
        amount: subtotal,
        tax_rate: parseFloat(taxRate),
        due_date: documentType === "invoice" ? (dueDate || null) : null,
        notes,
        line_items: lineItems as any,
        status: "draft",
        currency,
        brand_name: branding.brand_name,
        brand_logo_url: branding.brand_logo_url,
        brand_address: branding.brand_address,
        brand_email: branding.brand_email,
        brand_website: branding.brand_website,
        brand_color: branding.brand_color,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        recipient_address: recipientAddress,
        payment_method: paymentConfig.payment_method,
        payment_details: paymentConfig.payment_details,
        terms_conditions: paymentConfig.terms_conditions,
        discount_type: discountType || null,
        discount_value: parseFloat(discountValue) || 0,
        discount_amount: calculateDiscount(),
        document_type: documentType,
        valid_until: documentType === "quote" ? (validUntil || null) : null,
      };

      const { error } = await supabase.from("invoices").insert(invoiceData);
      if (error) throw error;

      recordMoneyAction(documentType === "quote" ? "quote_sent" : "invoice_created");
      toast.success(`${documentType === "quote" ? "Quote" : "Invoice"} created successfully!`);
      setShowCreateDialog(false);
      setCreateStep("details");
      fetchInvoices();
      resetForm();
    } catch (error) {
      console.error("Error creating document:", error);
      toast.error(`Failed to create ${documentType}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRecipientName(""); setRecipientEmail(""); setRecipientAddress("");
    setDueDate(""); setTaxRate("0"); setNotes(""); setDiscountType(""); setDiscountValue("0");
    setLineItems([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
    setCreateStep("details");
    setDocumentType("invoice");
    setValidUntil("");
    clearDraft();
    setShowDraftBanner(false);
  };

  // Convert a quote to an invoice
  const handleConvertToInvoice = async (quote: any) => {
    if (!guardInvoice()) return;
    setLoading(true);
    try {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;
      const invoiceData: any = {
        invoice_number: invoiceNumber,
        project_id: quote.project_id,
        issued_by: quote.issued_by,
        issued_to: quote.issued_to,
        amount: quote.amount,
        tax_rate: quote.tax_rate,
        due_date: null,
        notes: quote.notes,
        line_items: quote.line_items,
        status: "draft",
        currency: quote.currency,
        brand_name: quote.brand_name,
        brand_logo_url: quote.brand_logo_url,
        brand_address: quote.brand_address,
        brand_email: quote.brand_email,
        brand_website: quote.brand_website,
        brand_color: quote.brand_color,
        recipient_name: quote.recipient_name,
        recipient_email: quote.recipient_email,
        recipient_address: quote.recipient_address,
        payment_method: quote.payment_method,
        payment_details: quote.payment_details,
        terms_conditions: quote.terms_conditions,
        discount_type: quote.discount_type,
        discount_value: quote.discount_value,
        discount_amount: quote.discount_amount,
        document_type: "invoice",
        converted_from_quote_id: quote.id,
      };

      const { error } = await supabase.from("invoices").insert(invoiceData);
      if (error) throw error;

      // Mark the quote as accepted
      await supabase.from("invoices").update({ status: "accepted" } as any).eq("id", quote.id);

      toast.success("Quote converted to invoice!");
      fetchInvoices();
    } catch (error) {
      console.error("Error converting quote:", error);
      toast.error("Failed to convert quote to invoice");
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceData = (invoice: any) => {
    setRecipientName(invoice.recipient_name || "");
    setRecipientEmail(invoice.recipient_email || "");
    setRecipientAddress(invoice.recipient_address || "");
    setDueDate("");
    setTaxRate(String(invoice.tax_rate || 0));
    setNotes(invoice.notes || "");
    setCurrency(invoice.currency || "USD");
    setDiscountType(invoice.discount_type || "");
    setDiscountValue(String(invoice.discount_value || 0));
    setLineItems(
      (invoice.line_items || []).length > 0
        ? (invoice.line_items as LineItem[])
        : [{ description: "", quantity: 1, rate: 0, amount: 0 }]
    );
    setBranding({
      brand_name: invoice.brand_name || "",
      brand_logo_url: invoice.brand_logo_url || "",
      brand_address: invoice.brand_address || "",
      brand_email: invoice.brand_email || "",
      brand_website: invoice.brand_website || "",
      brand_color: invoice.brand_color || "#6366f1",
    });
    setPaymentConfig({
      payment_method: invoice.payment_method || "bank_transfer",
      payment_details: invoice.payment_details || {},
      terms_conditions: invoice.terms_conditions || "",
    });
    setDocumentType(invoice.document_type || "invoice");
    setValidUntil(invoice.valid_until || "");
  };

  const handleDuplicateInvoice = (invoice: any) => {
    loadInvoiceData(invoice);
    setEditingInvoiceId(null);
    setCreateStep("details");
    setShowCreateDialog(true);
    toast.success(`${(invoice.document_type || "invoice") === "quote" ? "Quote" : "Invoice"} data loaded for duplication`);
  };

  const handleEditInvoice = (invoice: any) => {
    loadInvoiceData(invoice);
    setDueDate(invoice.due_date || "");
    setEditingInvoiceId(invoice.id);
    setCreateStep("details");
    setShowCreateDialog(true);
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoiceId) return;
    if (!recipientName || lineItems.some(item => !item.description)) {
      toast.error("Please fill in client name and all line item descriptions");
      return;
    }

    setLoading(true);
    try {
      const subtotal = calculateSubtotal();
      const tax = calculateTax();
      const total = calculateTotal();

      const issuedTo = collaborators.find(c => c.full_name === recipientName)?.user_id || collaborators[0]?.user_id || null;

      const updateData: any = {
        amount: subtotal,
        tax_rate: parseFloat(taxRate),
        due_date: dueDate || null,
        notes,
        line_items: lineItems as any,
        currency,
        brand_name: branding.brand_name,
        brand_logo_url: branding.brand_logo_url,
        brand_address: branding.brand_address,
        brand_email: branding.brand_email,
        brand_website: branding.brand_website,
        brand_color: branding.brand_color,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        recipient_address: recipientAddress,
        payment_method: paymentConfig.payment_method,
        payment_details: paymentConfig.payment_details,
        terms_conditions: paymentConfig.terms_conditions,
        discount_type: discountType || null,
        discount_value: parseFloat(discountValue) || 0,
        discount_amount: calculateDiscount(),
      };
      if (issuedTo) updateData.issued_to = issuedTo;

      const { error } = await supabase.from("invoices").update(updateData).eq("id", editingInvoiceId);
      if (error) throw error;

      toast.success("Invoice updated successfully!");
      setShowCreateDialog(false);
      setEditingInvoiceId(null);
      setCreateStep("details");
      fetchInvoices();
      resetForm();
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error("Failed to update invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (invoice: any) => {
    try {
      // Update invoice status
      const { error: updateError } = await supabase.rpc("confirm_invoice_paid_manually", {
        p_invoice_id: invoice.id,
        p_payment_method: "Marked paid manually",
      });
      if (updateError) throw updateError;

      // Record in payment_history for accounting
      const { error: paymentError } = await supabase
        .from("payment_history")
        .insert({
          user_id: user!.id,
          project_id: invoice.project_id || projectId || null,
          invoice_id: invoice.id,
          amount: Number(invoice.total_amount || invoice.amount || 0),
          currency: invoice.currency || "USD",
          type: "payment_received",
          status: "completed",
          description: `Invoice ${invoice.invoice_number} — ${invoice.recipient_name || "Client"}`,
        } as any);
      if (paymentError) console.error("Payment history error:", paymentError);

      recordMoneyAction("invoice_paid");
      toast.success("Invoice marked as paid!");
      fetchInvoices();
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      toast.error("Failed to update invoice");
    }
  };

  const handleSendInvoice = async (invoice: any) => {
    try {
      const email = invoice.recipient_email || prompt("Enter recipient email:");
      if (!email) return;

      const { error } = await supabase.functions.invoke("send-invoice-email", {
        body: { invoiceId: invoice.id, recipientEmail: email }
      });

      if (error) throw error;
      recordMoneyAction("invoice_sent");
      toast.success("Invoice sent!");
      fetchInvoices();
    } catch (error) {
      console.error("Error sending invoice:", error);
      toast.error("Failed to send invoice");
    }
  };

  const handleDownloadPDF = async (invoice: any) => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const brandColor = invoice.brand_color || "#6366f1";
      const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b] as [number, number, number];
      };
      const rgb = hexToRgb(brandColor);

      // Color bar
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(0, 0, 210, 6, "F");

      // Logo
      let logoXOffset = 20;
      if (invoice.brand_logo_url) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            logoImg.onload = () => resolve();
            logoImg.onerror = () => reject(new Error("Logo failed to load"));
            logoImg.src = invoice.brand_logo_url;
          });
          const canvas = document.createElement("canvas");
          canvas.width = logoImg.naturalWidth;
          canvas.height = logoImg.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(logoImg, 0, 0);
          const logoDataUrl = canvas.toDataURL("image/png");
          const logoH = 12;
          const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
          doc.addImage(logoDataUrl, "PNG", 20, 11, logoW, logoH);
          logoXOffset = 20 + logoW + 4;
        } catch {
          // If logo fails to load, just skip it
        }
      }

      // Business name
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont(undefined!, "bold");
      doc.text(invoice.brand_name || "Invoice", logoXOffset, 20);
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      doc.setFont(undefined!, "normal");
      let yPos = 26;
      if (invoice.brand_email) { doc.text(invoice.brand_email, logoXOffset, yPos); yPos += 4; }
      if (invoice.brand_address) { doc.text(invoice.brand_address, logoXOffset, yPos); yPos += 4; }
      if (invoice.brand_website) { doc.text(invoice.brand_website, logoXOffset, yPos); }

      // Document title (Invoice or Quote)
      const isQuoteDoc = invoice.document_type === "quote";
      const pdfDocTitle = isQuoteDoc ? "QUOTE" : "INVOICE";
      doc.setFontSize(28);
      doc.setFont(undefined!, "bold");
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(pdfDocTitle, 140, 20);
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.setFont(undefined!, "normal");
      doc.text(`#${invoice.invoice_number}`, 140, 27);
      if (isQuoteDoc && invoice.valid_until) {
        doc.text(`Valid Until: ${new Date(invoice.valid_until).toLocaleDateString()}`, 140, 32);
      } else if (invoice.due_date) {
        doc.text(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, 140, 32);
      }

      // Bill To / Quote For
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.text(isQuoteDoc ? "QUOTE FOR" : "BILL TO", 20, 48);
      doc.setFontSize(11);
      doc.setFont(undefined!, "bold");
      doc.text(invoice.recipient_name || invoice.issued_to_profile?.full_name || "Client", 20, 54);
      doc.setFont(undefined!, "normal");
      doc.setFontSize(9);
      let billY = 59;
      if (invoice.recipient_email) { doc.text(invoice.recipient_email, 20, billY); billY += 4; }
      if (invoice.recipient_address) { doc.text(invoice.recipient_address, 20, billY); }

      // Currency symbol for this invoice
      const pdfCurrSym = getCurrencySymbol(invoice.currency || "USD");

      // Line Items
      const items = (invoice.line_items || []).map((item: any) => [
        item.description, item.quantity.toString(),
        `${pdfCurrSym}${item.rate.toFixed(2)}`, `${pdfCurrSym}${item.amount.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 72,
        head: [["Description", "Qty", "Rate", "Amount"]],
        body: items,
        theme: "grid",
        headStyles: { fillColor: rgb, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 72;
      let totY = finalY + 10;

      doc.setFontSize(9);
      doc.text(`Subtotal:`, 140, totY);
      doc.text(`${pdfCurrSym}${Number(invoice.amount).toFixed(2)}`, 190, totY, { align: "right" });

      if (invoice.discount_amount && invoice.discount_amount > 0) {
        totY += 6;
        doc.setTextColor(22, 163, 74);
        doc.text(`Discount:`, 140, totY);
        doc.text(`-${pdfCurrSym}${Number(invoice.discount_amount).toFixed(2)}`, 190, totY, { align: "right" });
        doc.setTextColor(0, 0, 0);
      }

      if (invoice.tax_rate) {
        totY += 6;
        doc.text(`Tax (${invoice.tax_rate}%):`, 140, totY);
        doc.text(`${pdfCurrSym}${Number(invoice.tax_amount).toFixed(2)}`, 190, totY, { align: "right" });
      }

      totY += 8;
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
      doc.line(140, totY - 2, 190, totY - 2);
      doc.setFontSize(14);
      doc.setFont(undefined!, "bold");
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text("Total:", 140, totY + 4);
      doc.text(`${pdfCurrSym}${Number(invoice.total_amount).toFixed(2)}`, 190, totY + 4, { align: "right" });

      // Payment details
      doc.setTextColor(0, 0, 0);
      let payY = totY + 18;
      if (invoice.payment_method && invoice.payment_method !== "thrivepay") {
        doc.setFontSize(8);
        doc.text("PAYMENT DETAILS", 20, payY);
        doc.setFontSize(9);
        doc.setFont(undefined!, "normal");
        payY += 5;
        const pd = invoice.payment_details || {};
        if (invoice.payment_method === "bank_transfer") {
          if (pd.bank_name) { doc.text(`Bank: ${pd.bank_name}`, 20, payY); payY += 4; }
          if (pd.account_name) { doc.text(`Account: ${pd.account_name}`, 20, payY); payY += 4; }
          if (pd.account_number) { doc.text(`Number: ${pd.account_number}`, 20, payY); payY += 4; }
          if (pd.routing_number) { doc.text(`Routing/SWIFT: ${pd.routing_number}`, 20, payY); payY += 4; }
        } else if (invoice.payment_method === "paypal") {
          doc.text(`PayPal: ${pd.paypal_email || ""}`, 20, payY); payY += 4;
        } else if (pd.instructions) {
          const lines = doc.splitTextToSize(pd.instructions, 170);
          doc.text(lines, 20, payY); payY += lines.length * 4;
        }
      }

      // Notes
      if (invoice.notes) {
        payY += 4;
        doc.setFontSize(8);
        doc.setFont(undefined!, "bold");
        doc.text("NOTES", 20, payY);
        doc.setFont(undefined!, "normal");
        doc.setFontSize(9);
        const noteLines = doc.splitTextToSize(invoice.notes, 170);
        doc.text(noteLines, 20, payY + 5);
        payY += 5 + noteLines.length * 4;
      }

      // Terms
      if (invoice.terms_conditions) {
        payY += 4;
        doc.setFontSize(7);
        doc.setFont(undefined!, "bold");
        doc.text("TERMS & CONDITIONS", 20, payY);
        doc.setFont(undefined!, "normal");
        doc.setFontSize(7);
        const termLines = doc.splitTextToSize(invoice.terms_conditions, 170);
        doc.setTextColor(100, 100, 100);
        doc.text(termLines, 20, payY + 4);
      }

      // Clickable "Pay with KrePay" link (only for unpaid invoices, not quotes)
      if (!isQuoteDoc && invoice.status !== "paid") {
        const payUrl = `https://www.kretopia.com/pay/invoice/${invoice.id}`;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.roundedRect(20, 270, 75, 10, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont(undefined!, "bold");
        doc.textWithLink("Pay with KrePay", 27, 277, { url: payUrl });
        doc.setFont(undefined!, "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.textWithLink(payUrl, 100, 277, { url: payUrl });
      }

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Powered by Kretopia", 105, 285, { align: "center" });

      const filePrefix = isQuoteDoc ? "quote" : "invoice";
      doc.save(`${filePrefix}-${invoice.invoice_number}.pdf`);
      toast.success(`${isQuoteDoc ? "Quote" : "Invoice"} PDF downloaded!`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const handlePreview = (invoice: any) => {
    setPreviewInvoice(invoice);
    setShowPreviewDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      sent: "bg-primary text-primary dark:bg-primary dark:text-primary",
      viewed: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    const icons: Record<string, any> = {
      draft: FileText, sent: Send, viewed: Eye, paid: CheckCircle2, overdue: AlertCircle,
    };
    const Icon = icons[status] || FileText;
    return (
      <Badge variant="outline" className={`${styles[status] || ""} text-[10px] gap-1`}>
        <Icon className="h-2.5 w-2.5" />
        {status}
      </Badge>
    );
  };

  const getCurrencySymbol = (c: string) => {
    const symbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹", NGN: "₦", KES: "KSh ", BRL: "R$", ZAR: "R", AED: "د.إ ", IDR: "Rp ", TTD: "TT$", CHF: "CHF ", CAD: "C$", AUD: "A$" };
    return symbols[c] || `${c} `;
  };
  const currencySymbol = getCurrencySymbol(currency);

  const filteredInvoices = invoices.filter(inv => {
    if (listFilter === "all") return true;
    return (inv.document_type || "invoice") === listFilter;
  });

  const docLabel = documentType === "quote" ? "Quote" : "Invoice";

  return (
    <>
      {/* Invoice List Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Invoices & Quotes {invoices.length > 0 && `(${invoices.length})`}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Invoice & Quote Manager
            </DialogTitle>
          </DialogHeader>

          {/* Filter Tabs + Create buttons (wrap on mobile so + Quote stays visible) */}
          <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "invoice", "quote"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setListFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border ${
                    listFilter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-transparent hover:border-border"
                  }`}
                >
                  {f === "all" ? "All" : f === "invoice" ? "Invoices" : "Quotes"}
                </button>
              ))}
            </div>
            <div className="flex-1 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5 flex-1 sm:flex-none" onClick={() => { setEditingInvoiceId(null); resetForm(); setDocumentType("invoice"); setShowCreateDialog(true); }}>
                <Plus className="h-3.5 w-3.5" /> Invoice
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-none" onClick={() => { setEditingInvoiceId(null); resetForm(); setDocumentType("quote"); setShowCreateDialog(true); }}>
                <ScrollText className="h-3.5 w-3.5" /> Quote
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Invoice/Quote List */}
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No {listFilter === "all" ? "documents" : listFilter === "quote" ? "quotes" : "invoices"} yet</p>
                <p className="text-sm">Create your first branded, professional {listFilter === "quote" ? "quote" : "invoice"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInvoices.map((inv) => {
                  const isQuote = (inv.document_type || "invoice") === "quote";
                  return (
                    <Card key={inv.id} className="p-3 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: inv.brand_color || "#6366f1" }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-mono text-xs font-medium truncate max-w-[140px]">{inv.invoice_number}</p>
                            {getStatusBadge(inv.status)}
                            {isQuote && (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                <ScrollText className="h-2.5 w-2.5 mr-0.5" /> Quote
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {inv.recipient_name || inv.issued_to_profile?.full_name || "Client"}
                          </p>
                          {inv.due_date && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Due: {new Date(inv.due_date).toLocaleDateString()}
                            </p>
                          )}
                          {isQuote && inv.valid_until && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Valid until: {new Date(inv.valid_until).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 max-w-[40%]">
                          <p className="font-bold text-base sm:text-lg break-all leading-tight">
                            {getCurrencySymbol(inv.currency || "USD")}{Number(inv.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{inv.currency || "USD"}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2 pt-2 border-t flex-wrap">
                        {inv.status === "draft" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary hover:text-primary/80" onClick={() => handleEditInvoice(inv)}>
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handlePreview(inv)}>
                          <Eye className="h-3 w-3" /> Preview
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleDownloadPDF(inv)}>
                          <Download className="h-3 w-3" /> PDF
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleSendInvoice(inv)}>
                          <Mail className="h-3 w-3" /> Send
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleDuplicateInvoice(inv)}>
                          <Copy className="h-3 w-3" /> Duplicate
                        </Button>
                        {/* Quote → Invoice conversion */}
                        {isQuote && inv.status !== "accepted" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary hover:text-primary/80" onClick={() => handleConvertToInvoice(inv)} disabled={loading}>
                            <ArrowRightLeft className="h-3 w-3" /> Convert to Invoice
                          </Button>
                        )}
                        {!isQuote && inv.status !== "paid" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-green-600 hover:text-green-700" onClick={() => handleMarkAsPaid(inv)}>
                            <CreditCard className="h-3 w-3" /> Mark Paid
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) { setEditingInvoiceId(null); resetForm(); }
      }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingInvoiceId ? `Edit ${docLabel}` : `Create ${docLabel}`}</DialogTitle>
          </DialogHeader>

          {/* Draft Recovery Banner */}
          {showDraftBanner && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
              <RotateCcw className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="flex-1 text-foreground">
                You have an unsaved draft. Pick up where you left off?
              </span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={restoreDraft}>
                <RotateCcw className="h-3 w-3" /> Restore
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { clearDraft(); setShowDraftBanner(false); }}>
                Discard
              </Button>
            </div>
          )}
          {/* Step Navigation */}
          <div className="flex gap-1 mb-4">
            {(["details", "branding", "payment", "preview"] as const).map((step, i) => (
              <button
                key={step}
                onClick={() => setCreateStep(step)}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                  createStep === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {i + 1}. {step.charAt(0).toUpperCase() + step.slice(1)}
              </button>
            ))}
          </div>
          {!editingInvoiceId && showCreateDialog && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <Save className="h-2.5 w-2.5" /> Auto-saving draft…
            </p>
          )}

          <div className="flex-1 overflow-y-auto">
            {/* Step 1: Details */}
            {createStep === "details" && (
              <div className="space-y-4">
                {/* Document Type Toggle */}
                {!editingInvoiceId && (
                  <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                    <button
                      onClick={() => setDocumentType("invoice")}
                      className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                        documentType === "invoice" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileText className="h-3 w-3 inline mr-1" /> Invoice
                    </button>
                    <button
                      onClick={() => setDocumentType("quote")}
                      className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                        documentType === "quote" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ScrollText className="h-3 w-3 inline mr-1" /> Quote
                    </button>
                  </div>
                )}

                {/* AI Pricing Co-Pilot — chat-first experience */}
                <PricingCoPilot
                  projectId={projectId}
                  lineItems={lineItems}
                  currency={currency}
                  documentType={documentType}
                  onApplyLineItems={(items) => setLineItems(items)}
                  onApplyNotes={(n) => setNotes(n)}
                  onApplyTerms={(t) => setPaymentConfig(prev => ({ ...prev, terms_conditions: t }))}
                  onApplyTaxRate={(r) => setTaxRate(String(r))}
                  onApplyDocumentDetails={(details) => {
                    if (details.client_name) setRecipientName(details.client_name);
                    if (details.client_email) setRecipientEmail(details.client_email);
                    if (details.client_address) setRecipientAddress(details.client_address);
                    if (details.currency) setCurrency(details.currency);
                    if (details.tax_rate !== undefined) setTaxRate(String(details.tax_rate));
                    if (details.due_date) {
                      if (documentType === "invoice") setDueDate(details.due_date);
                      else setValidUntil(details.due_date);
                    }
                    if (details.notes) setNotes(details.notes);
                  }}
                />

                {/* Summary of what's been filled — only shows when there are line items */}
                {lineItems.some(i => i.description) && (
                  <Card className="p-3 bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{docLabel.charAt(0).toUpperCase() + docLabel.slice(1)} Summary</span>
                      <Badge variant="outline" className="text-[9px]">{lineItems.filter(i => i.description).length} items</Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currencySymbol}{calculateSubtotal().toFixed(2)}</span></div>
                      {calculateDiscount() > 0 && (
                        <div className="flex justify-between text-green-600"><span>Discount</span><span>-{currencySymbol}{calculateDiscount().toFixed(2)}</span></div>
                      )}
                      {parseFloat(taxRate) > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>{currencySymbol}{calculateTax().toFixed(2)}</span></div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-bold text-base"><span>Total</span><span>{currencySymbol}{calculateTotal().toFixed(2)}</span></div>
                    </div>
                  </Card>
                )}

                {/* Manual edit toggle — hidden by default, expandable */}
                <details className="group">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 py-1">
                    <Pencil className="h-3 w-3" />
                    Manually edit details & line items
                  </summary>
                  <div className="mt-3 space-y-3 pt-3 border-t border-border/50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Client Name *</Label>
                        <Input className="h-8 text-sm" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Client or company name" />
                        {collaborators.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {collaborators.map((c) => (
                              <button key={c.user_id} type="button" className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground" onClick={() => setRecipientName(c.full_name)}>
                                {c.full_name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">Client Email</Label>
                        <Input className="h-8 text-sm" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="client@email.com" />
                      </div>
                      <div>
                        <Label className="text-xs">Client Address</Label>
                        <Input className="h-8 text-sm" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="City, Country" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {documentType === "invoice" ? (
                        <div>
                          <Label className="text-xs">Due Date</Label>
                          <Input className="h-8 text-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>
                      ) : (
                        <div>
                          <Label className="text-xs">Valid Until</Label>
                          <Input className="h-8 text-sm" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "BRL", "ZAR", "INR", "NGN", "IDR", "TTD", "AED", "KES"].map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tax Rate (%)</Label>
                        <Input className="h-8 text-sm" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-semibold">Line Items *</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addLineItem} className="h-7 text-xs">
                          <Plus className="h-3 w-3 mr-1" /> Add Item
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground font-medium px-1">
                          <span className="col-span-5">Description</span>
                          <span className="col-span-2 text-center">Qty</span>
                          <span className="col-span-2 text-right">Rate</span>
                          <span className="col-span-2 text-right">Amount</span>
                        </div>
                        {lineItems.map((item, index) => (
                          <div key={index} className="grid grid-cols-12 gap-1.5 items-center">
                            <Input className="col-span-5 h-8 text-sm" placeholder="Service description" value={item.description} onChange={(e) => updateLineItem(index, "description", e.target.value)} />
                            <Input className="col-span-2 h-8 text-sm text-center" type="number" value={item.quantity} onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)} />
                            <Input className="col-span-2 h-8 text-sm text-right" type="number" value={item.rate} onChange={(e) => updateLineItem(index, "rate", parseFloat(e.target.value) || 0)} />
                            <span className="col-span-2 text-sm text-right font-medium">{currencySymbol}{item.amount.toFixed(2)}</span>
                            <Button type="button" size="icon" variant="ghost" className="col-span-1 h-7 w-7" onClick={() => removeLineItem(index)} disabled={lineItems.length === 1}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 items-end">
                      <div>
                        <Label className="text-xs">Discount</Label>
                        <Select value={discountType} onValueChange={setDiscountType}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No discount" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No discount</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {discountType && discountType !== "none" && (
                        <div className="relative">
                          <Input className="h-8 text-sm pl-6" type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {discountType === "percentage" ? "%" : currencySymbol}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs">Notes</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={`Additional notes for the ${documentType === "quote" ? "quote" : "client"}...`} rows={2} className="text-sm" />
                    </div>
                  </div>
                </details>

                <Button className="w-full" onClick={() => setCreateStep("branding")}>
                  Next: Your Branding →
                </Button>
              </div>
            )}

            {createStep === "branding" && (
              <div className="space-y-4">
                <InvoiceBrandingForm branding={branding} onChange={setBranding} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setCreateStep("details")}>← Back</Button>
                  <Button className="flex-1" onClick={() => setCreateStep("payment")}>Next: Payment →</Button>
                </div>
              </div>
            )}

            {createStep === "payment" && (
              <div className="space-y-4">
                <InvoicePaymentForm config={paymentConfig} onChange={setPaymentConfig} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setCreateStep("branding")}>← Back</Button>
                  <Button className="flex-1" onClick={() => setCreateStep("preview")}>Preview {docLabel} →</Button>
                </div>
              </div>
            )}

            {createStep === "preview" && (
              <div className="space-y-4">
                <InvoicePreview
                  branding={branding}
                  recipient={{ name: recipientName, email: recipientEmail, address: recipientAddress }}
                  invoiceNumber={documentType === "quote" ? "QUO-DRAFT" : "INV-DRAFT"}
                  dueDate={documentType === "invoice" ? dueDate : ""}
                  lineItems={lineItems}
                  taxRate={parseFloat(taxRate)}
                  discount={{ type: discountType, value: parseFloat(discountValue), amount: calculateDiscount() }}
                  notes={notes}
                  payment={paymentConfig}
                  currency={currency}
                  documentType={documentType}
                  validUntil={documentType === "quote" ? validUntil : ""}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setCreateStep("payment")}>← Back</Button>
                  <Button className="flex-1" onClick={editingInvoiceId ? handleUpdateInvoice : handleCreateInvoice} disabled={loading}>
                    {loading ? (editingInvoiceId ? "Saving..." : "Creating...") : (editingInvoiceId ? "Save Changes" : `Create ${docLabel}`)}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(previewInvoice?.document_type || "invoice") === "quote" ? "Quote" : "Invoice"} Preview</DialogTitle>
          </DialogHeader>
          {previewInvoice && (
            <InvoicePreview
              branding={{
                brand_name: previewInvoice.brand_name || "",
                brand_logo_url: previewInvoice.brand_logo_url || "",
                brand_address: previewInvoice.brand_address || "",
                brand_email: previewInvoice.brand_email || "",
                brand_website: previewInvoice.brand_website || "",
                brand_color: previewInvoice.brand_color || "#6366f1",
              }}
              recipient={{
                name: previewInvoice.recipient_name || previewInvoice.issued_to_profile?.full_name || "",
                email: previewInvoice.recipient_email || "",
                address: previewInvoice.recipient_address || "",
              }}
              invoiceNumber={previewInvoice.invoice_number}
              dueDate={previewInvoice.due_date}
              lineItems={previewInvoice.line_items || []}
              taxRate={previewInvoice.tax_rate || 0}
              discount={{
                type: previewInvoice.discount_type || "",
                value: previewInvoice.discount_value || 0,
                amount: previewInvoice.discount_amount || 0,
              }}
              notes={previewInvoice.notes || ""}
              payment={{
                payment_method: previewInvoice.payment_method || "",
                payment_details: previewInvoice.payment_details || {},
                terms_conditions: previewInvoice.terms_conditions || "",
              }}
              currency={previewInvoice.currency}
              documentType={previewInvoice.document_type || "invoice"}
              validUntil={previewInvoice.valid_until || ""}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
