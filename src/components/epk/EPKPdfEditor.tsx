import { useState, useEffect, useCallback, useRef, type ReactNode, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Monitor, Smartphone, X, Save, Eye, EyeOff,
  GripVertical, ChevronDown, ChevronRight, ChevronLeft, Wand2,
  PanelLeft, ArrowLeft, Crown, Lock, FileDown, Palette, Star,
  Type, Image as ImageIcon, Plus, Trash2, LayoutTemplate, Check, Upload, FolderOpen, RotateCw, ArrowUp, ArrowDown, Maximize
} from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { hasProAccess, hasCreatorProAccess } from "@/lib/subscriptionConfig";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import type { EPKPdfInput } from "@/lib/epkPdfGenerator";
import { EPK_DEFAULT_ACCENT_HEX, EPK_TEMPLATES, type EPKTemplateId } from "@/lib/epkPdfGenerator";

import { avatarEPKAccent, buildEPKDefaults, EPK_TOPICS, suggestedEPKTemplate, validateEPKFile } from "@/lib/epkDraft";
import { EPKDraftField } from "./EPKDraftTopics";
import { EPKDocumentViewer } from "./EPKDocumentViewer";
import { editEPKDocument, epkDraftStorage, epkPassportPath, type EPKPageEdit } from "@/lib/epkDocument";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Editable sections for the EPK
interface EPKSection {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_SECTIONS: EPKSection[] = [
  { id: "hero", label: "Cover / Hero", visible: true },
  { id: "bio", label: "Bio & About", visible: true },
  { id: "stats", label: "Quick Stats", visible: true },
  { id: "contact", label: "Contact", visible: true },
  { id: "skills", label: "Skills & Expertise", visible: true },
  { id: "credits", label: "Work History", visible: true },
  { id: "press", label: "Press Coverage", visible: true },
  { id: "awards", label: "Awards & Recognition", visible: true },
  { id: "credentials", label: "Credentials & Stats", visible: true },
  { id: "reviews", label: "Client Reviews", visible: true },
];

interface EPKBranding {
  primaryColor: string;
  accentColor: string;
  darkColor: string;
  logoUrl: string;
  tagline: string;
}

interface EPKEditableData {
  displayName: string;
  displayRole: string;
  bio: string;
  location: string;
  tagline: string;
  contactEmail: string;
  sections: EPKSection[];
  branding: EPKBranding;
  // Credits can be reordered/hidden
  creditOverrides: Record<string, { hidden?: boolean; customRole?: string }>;
}

interface EPKPdfEditorProps {
  open: boolean;
  onClose: () => void;
  epkData: EPKPdfInput;
  userId: string;
}

type EditorTab = "content" | "sections" | "template" | "branding" | "files";

export const EPKPdfEditor = ({ open, onClose, epkData, userId }: EPKPdfEditorProps) => {
  const { subscriptionInfo } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previewRef = useRef<HTMLDivElement>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [documentMode, setDocumentMode] = useState<"kretopia" | "original">("kretopia");
  const [pageEdits, setPageEdits] = useState<EPKPageEdit[]>([]);
  const [documentEdited, setDocumentEdited] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const isPro = hasProAccess((subscriptionInfo?.tier || "free") as any);
  const isCreatorPlus = hasCreatorProAccess((subscriptionInfo?.tier || "free") as any);

  const defaults = buildEPKDefaults(epkData);
  const [topics, setTopics] = useState<Record<string, string>>(defaults.topics);
  const [importedText, setImportedText] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("content");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Editable state
  const [displayName, setDisplayName] = useState(epkData.profile.full_name || "");
  const [displayRole, setDisplayRole] = useState(epkData.profile.job_title || epkData.profile.role || "");
  const [bio, setBio] = useState(defaults.bio);
  const [location, setLocation] = useState(epkData.profile.location || "");
  const [tagline, setTagline] = useState(defaults.tagline);
  const [sections, setSections] = useState<EPKSection[]>(DEFAULT_SECTIONS);
  const [branding, setBranding] = useState<EPKBranding>({
    // Default before the creator customizes it: the first template's own accent, shared with it.
    primaryColor: EPK_DEFAULT_ACCENT_HEX,
    accentColor: EPK_DEFAULT_ACCENT_HEX,
    darkColor: "#05070D",
    logoUrl: "",
    tagline: "",
  });
  const [creditOverrides, setCreditOverrides] = useState<Record<string, { hidden?: boolean; customRole?: string }>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<EPKTemplateId>('cinematic-dark');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Reset state when data changes
  useEffect(() => {
    if (open && epkData) {
      setDisplayName(epkData.profile.full_name || "");
      setDisplayRole(epkData.profile.job_title || epkData.profile.role || "");
      setBio(defaults.bio);
      setTopics(defaults.topics);
      setTagline(defaults.tagline);
      const template = EPK_TEMPLATES.find(t => t.id === suggestedEPKTemplate(epkData)) || EPK_TEMPLATES[0];
      setSelectedTemplate(template.id);
      setBranding(prev => ({ ...prev, primaryColor: rgbToHex(template.palette.primary), accentColor: rgbToHex(template.palette.accent), darkColor: rgbToHex(template.palette.bg) }));
      setLocation(epkData.profile.location || "");
      setHasChanges(false);
    }
  }, [open, epkData]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  useEffect(() => {
    if (!open || !epkData.profile.avatar_url || suggestedEPKTemplate(epkData) === "clean-light") return;
    let active = true;
    void avatarEPKAccent(epkData.profile.avatar_url).then(accent => {
      if (active && accent) setBranding(prev => ({ ...prev, primaryColor: rgbToHex(accent) }));
    });
    return () => { active = false; };
  }, [open, epkData, isCreatorPlus]);

  // Build modified EPK data from editor state
  const buildModifiedData = useCallback((): EPKPdfInput => {
    const visibleSectionIds = new Set(sections.filter(s => s.visible).map(s => s.id));
    
    return {
      profile: {
        ...epkData.profile,
        full_name: displayName,
        job_title: displayRole,
        role: displayRole,
        bio: visibleSectionIds.has("bio") ? bio : "",
        professional_skills: visibleSectionIds.has("skills") ? epkData.profile.professional_skills : [],
        passion_skills: visibleSectionIds.has("skills") ? epkData.profile.passion_skills : [],
        location,
      },
      credits: visibleSectionIds.has("credits")
        ? epkData.credits.filter(c => {
            const id = (c as any).id;
            return !creditOverrides[id]?.hidden;
          }).map(c => {
            const id = (c as any).id;
            const override = creditOverrides[id];
            return override?.customRole ? { ...c, role: override.customRole } : c;
          })
        : [],
      awards: visibleSectionIds.has("awards") ? epkData.awards : [],
      pressLinks: visibleSectionIds.has("press") ? epkData.pressLinks : [],
      industryStats: visibleSectionIds.has("credentials") ? epkData.industryStats : [],
      reviews: visibleSectionIds.has("reviews") ? epkData.reviews : [],
      narratives: Object.fromEntries(Object.entries(topics).filter(([key]) => key === "practice" || key === "approach" ? visibleSectionIds.has("skills") : key === "portfolio" ? visibleSectionIds.has("credits") : key === "recognition" ? visibleSectionIds.has("awards") || visibleSectionIds.has("press") : key === "credentials" || key === "reviews" ? visibleSectionIds.has(key) : visibleSectionIds.has("contact"))),
    };
  }, [epkData, displayName, displayRole, bio, location, sections, creditOverrides, topics]);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      if (documentMode === "original" && (documentBlob || originalFile)) {
        downloadBlob(documentBlob || originalFile as Blob, originalFile?.name || "EPK.pdf");
        return;
      }
      const modifiedData = buildModifiedData();
      
      if (isCreatorPlus) {
        // Pass custom branding + template
        const { generateEPKPdf } = await import("@/lib/epkPdfGenerator");
        await generateEPKPdf(modifiedData, {
          templateId: selectedTemplate,
          primaryColor: hexToRgb(branding.primaryColor),
          accentColor: hexToRgb(branding.accentColor),
          darkColor: hexToRgb(branding.darkColor),
          logoUrl: branding.logoUrl || undefined,
          tagline: tagline || branding.tagline || undefined,
        });
      } else {
        const { generateEPKPdf } = await import("@/lib/epkPdfGenerator");
        await generateEPKPdf(modifiedData, { tagline, templateId: selectedTemplate, primaryColor: hexToRgb(branding.primaryColor) });
      }
      toast({ title: "EPK PDF downloaded!", description: "Your professional EPK deck has been saved." });
    } catch (error) {
      console.error("EPK PDF generation error:", error);
      toast({ title: "Failed to generate PDF", description: "Please try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    const invalid = validateEPKFile(file);
    if (invalid) { toast({ title: invalid, variant: "destructive" }); return; }
    setImporting(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      setOriginalFile(file);
      setDocumentBlob(file);
      setPageEdits(Array.from({ length: pdf.getPageCount() }, (_, index) => ({ index, rotation: 0 })));
      setDocumentEdited(false);
      setDocumentMode("original");
      setImportName(file.name);
      setActiveTab("files");
      markChanged();
    } catch (e) { toast({ title: e instanceof Error ? e.message : "Could not read this PDF", variant: "destructive" }); }
    finally { setImporting(false); if (uploadRef.current) uploadRef.current.value = ""; }
  };

  useEffect(() => {
    if (!open || documentMode !== "kretopia") return;
    let active = true;
    const timer = window.setTimeout(() => {
      void import("@/lib/epkPdfGenerator").then(({ generateEPKPdf }) => generateEPKPdf(buildModifiedData(), {
        output: "blob", templateId: selectedTemplate, tagline,
        primaryColor: hexToRgb(branding.primaryColor), accentColor: hexToRgb(branding.accentColor), darkColor: hexToRgb(branding.darkColor), logoUrl: branding.logoUrl || undefined,
      })).then(blob => { if (active) setDocumentBlob(blob); }).catch(() => { if (active) toast({ title: "Could not refresh the PDF preview", variant: "destructive" }); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, documentMode, buildModifiedData, branding, selectedTemplate, tagline, toast]);

  const updatePages = async (next: EPKPageEdit[]) => {
    if (!originalFile) return;
    try {
      const bytes = await editEPKDocument(new Uint8Array(await originalFile.arrayBuffer()), next);
      setDocumentBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      setPageEdits(next); setDocumentEdited(true); markChanged();
    } catch (e) { toast({ title: e instanceof Error ? e.message : "Could not edit PDF", variant: "destructive" }); }
  };

  const storageAction = async (action: "save" | "read" | "delete" | "publish" | "unpublish") => {
    setStorageBusy(true);
    try {
      if (action === "save") {
        await epkDraftStorage(userId, "save", { name: originalFile?.name || "Kretopia EPK.pdf", file: originalFile || documentBlob || new Blob(), editor: JSON.stringify({ displayName, displayRole, bio, location, tagline, topics, sections, branding, creditOverrides, selectedTemplate, documentMode, pageEdits, documentEdited }), savedAt: Date.now() });
        setSavedAt(Date.now()); setHasChanges(false);
        toast({ title: "Draft saved on this device" });
      } else if (action === "read") {
        const draft = await epkDraftStorage(userId, "read");
        if (!draft) { toast({ title: "No saved draft on this device" }); return; }
        const editor = JSON.parse(draft.editor);
        setDisplayName(editor.displayName); setDisplayRole(editor.displayRole); setBio(editor.bio); setLocation(editor.location); setTagline(editor.tagline); setTopics(editor.topics); setSections(editor.sections); setBranding(editor.branding); setCreditOverrides(editor.creditOverrides); setSelectedTemplate(editor.selectedTemplate); setSavedAt(draft.savedAt);
        if (editor.documentMode === "original") {
          const file = new File([draft.file], draft.name, { type: "application/pdf" });
          setOriginalFile(file); setImportName(draft.name); setPageEdits(editor.pageEdits); setDocumentEdited(editor.documentEdited);
          const bytes = editor.documentEdited ? await editEPKDocument(new Uint8Array(await file.arrayBuffer()), editor.pageEdits) : null;
          setDocumentBlob(bytes ? new Blob([bytes as BlobPart], { type: "application/pdf" }) : file);
        }
        setDocumentMode(editor.documentMode); toast({ title: "Draft restored" });
      } else if (action === "delete") {
        await epkDraftStorage(userId, "delete"); setSavedAt(null); toast({ title: "Device draft deleted" });
      } else {
        const { data: session, error: authError } = await supabase.auth.getUser();
        if (authError || session.user?.id !== userId) throw new Error("Sign in to your own Passport to manage its EPK.");
        const path = epkPassportPath(userId);
        if (action === "publish") {
          if (!documentBlob) throw new Error("Wait for your PDF preview to finish.");
          const { error } = await supabase.storage.from("portfolio").upload(path, documentBlob, { contentType: "application/pdf", upsert: true, cacheControl: "60" });
          if (error) throw new Error("Your EPK could not be saved to your Passport. Your local document is safe.");
        } else {
          const { error } = await supabase.storage.from("portfolio").remove([path]);
          if (error) throw new Error("Could not remove the published EPK.");
        }
        await queryClient.invalidateQueries({ queryKey: ["passport-original-epk", userId] });
        toast({ title: action === "publish" ? "Complete PDF added to your public Passport" : "EPK removed from Passport" });
      }
    } catch (e) { toast({ title: e instanceof Error ? e.message : "Storage unavailable", variant: "destructive" }); }
    finally { setStorageBusy(false); }
  };

  // Section drag & drop
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...sections];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setSections(updated);
    setDragIndex(index);
    markChanged();
  };
  const handleDragEnd = () => setDragIndex(null);

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
    markChanged();
  };

  if (!open) return null;

  const TABS: { id: EditorTab; label: string; icon: any; proOnly?: boolean }[] = [
    { id: "content", label: "Content", icon: Type },
    { id: "sections", label: "Sections", icon: GripVertical },
    { id: "template", label: "Template", icon: LayoutTemplate, proOnly: true },
    { id: "branding", label: "Branding", icon: Palette, proOnly: true },
    { id: "files", label: "Files", icon: FolderOpen },
  ];

  return (
    <div className="k-epk-editor fixed inset-0 z-50 bg-background flex flex-col" role="dialog" aria-modal="true" aria-label="EPK PDF Editor">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 px-2" aria-label="Back to Passport">
            <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back</span>
          </Button>
          <div className="hidden min-w-0 items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 sm:flex">
            <BrandLogo iconOnly size="md" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-black uppercase tracking-[0.16em] text-foreground">EPK PDF Editor</h2>
              <p className="truncate text-[11px] text-muted-foreground">
                {displayName} · {documentMode === "original" ? "Your PDF" : "Creative Passport"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Toggle EPK preview" onClick={() => setSidebarCollapsed(v => !v)}><Eye /></Button>
          <Button variant="ghost" size="icon" title="Save device draft" aria-label="Save device draft" disabled={storageBusy} onClick={() => void storageAction("save")}><Save className="h-4 w-4" /></Button>
          <input ref={uploadRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Upload your EPK" onChange={e => void handleImport(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => uploadRef.current?.click()} disabled={importing} aria-label="Upload your EPK">
            {importing ? <KretopiaSpinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}<span className="hidden sm:inline">Import EPK</span>
          </Button>
          {hasChanges && (
            <Badge variant="outline" className="hidden sm:inline-flex text-xs text-muted-foreground border-border">PDF draft</Badge>
          )}
          <Button size="sm" onClick={handleDownload} disabled={generating} className="gap-1.5" aria-label={generating ? "Generating..." : "Download PDF"}>
            {generating ? <KretopiaSpinner className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
            <span className="hidden sm:inline">{generating ? "Generating..." : "Download PDF"}</span><span className="sm:hidden">PDF</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close EPK editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={cn(
          "border-r bg-muted/30 transition-all duration-200 flex flex-col shrink-0",
          sidebarCollapsed ? "hidden" : "w-full sm:w-80"
        )}>
          {/* Tab bar */}
          <div className="flex border-b shrink-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const locked = tab.proOnly && !isCreatorPlus;
              return (
                <Button variant="ghost"
                  key={tab.id}
                  onClick={() => {
                    if (locked) {
                      toast({
                        title: "Creator+ feature",
                        description: "Upgrade to Creator+ for custom branding.",
                      });
                      return;
                    }
                    setActiveTab(tab.id);
                  }}
                  className={cn(
                    "h-auto flex-1 rounded-none flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-xs font-medium transition-colors",
                    activeTab === tab.id ? "bg-background text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground",
                    locked && "opacity-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {locked && <Lock className="h-3 w-3" />}
                </Button>
              );
            })}
          </div>

          {/* Tab content */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {documentMode === "original" && activeTab !== "files" && <Button variant="outline" className="w-full" onClick={() => setActiveTab("files")}><FolderOpen className="mr-2 h-4 w-4" />Edit original PDF pages</Button>}
              {activeTab === "files" && <div className="space-y-4">
                <div className="flex items-center gap-2"><BrandLogo iconOnly size="sm" /><h3 className="text-sm font-semibold">EPK library</h3></div>
                <div className="flex gap-1"><Button variant={documentMode === "kretopia" ? "secondary" : "ghost"} size="sm" onClick={() => { setDocumentMode("kretopia"); setDocumentBlob(null); }}>Kretopia draft</Button><Button variant={documentMode === "original" ? "secondary" : "ghost"} size="sm" disabled={!originalFile} onClick={() => { setDocumentMode("original"); if (originalFile) { if (documentEdited) void updatePages(pageEdits); else setDocumentBlob(originalFile); } }}>Your PDF</Button></div>
                {originalFile && <><p className="break-all text-sm font-medium">{importName}</p><p className="text-xs text-muted-foreground">{(originalFile.size / 1024 / 1024).toFixed(2)} MB · {pageEdits.length} pages · {documentEdited ? "Edited copy" : "Original intact"}</p>
                  <Button variant="outline" size="sm" onClick={() => downloadBlob(originalFile, originalFile.name)}><FileDown className="mr-1 h-4 w-4" />Download untouched original</Button>
                  <div className="space-y-1">{pageEdits.map((edit, index) => <div key={`${edit.index}-${index}`} className="flex items-center gap-1 border-b border-border py-2"><span className="flex-1 text-xs">Page {edit.index + 1} · {edit.rotation}°</span><Button variant="ghost" size="icon" title="Move page up" aria-label={`Move page ${index + 1} up`} disabled={index === 0 || storageBusy} onClick={() => { const next = [...pageEdits]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; void updatePages(next); }}><ArrowUp className="h-3 w-3" /></Button><Button variant="ghost" size="icon" title="Move page down" aria-label={`Move page ${index + 1} down`} disabled={index === pageEdits.length - 1 || storageBusy} onClick={() => { const next = [...pageEdits]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; void updatePages(next); }}><ArrowDown className="h-3 w-3" /></Button><Button variant="ghost" size="icon" title="Rotate page" aria-label={`Rotate page ${index + 1}`} onClick={() => void updatePages(pageEdits.map((p, i) => i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))}><RotateCw className="h-3 w-3" /></Button><Button variant="ghost" size="icon" title="Remove page from copy" aria-label={`Remove page ${index + 1}`} disabled={pageEdits.length <= 1} onClick={() => void updatePages(pageEdits.filter((_, i) => i !== index))}><Trash2 className="h-3 w-3" /></Button></div>)}</div>
                  <Button variant="ghost" size="sm" onClick={() => { setDocumentEdited(false); setDocumentBlob(originalFile); void import("pdf-lib").then(async ({ PDFDocument }) => { const pdf = await PDFDocument.load(await originalFile.arrayBuffer()); setPageEdits(Array.from({ length: pdf.getPageCount() }, (_, index) => ({ index, rotation: 0 }))); }); }}>Restore all original pages</Button>
                </>}
                <div className="space-y-2 border-t border-border pt-4"><p className="text-xs font-semibold">Device storage</p>{savedAt && <p className="text-xs text-muted-foreground">Saved {new Date(savedAt).toLocaleString()}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={storageBusy} onClick={() => void storageAction("save")}><Save className="mr-1 h-4 w-4" />Save draft</Button><Button variant="outline" size="sm" disabled={storageBusy} onClick={() => void storageAction("read")}><FolderOpen className="mr-1 h-4 w-4" />Restore draft</Button><Button variant="ghost" size="sm" disabled={storageBusy} onClick={() => void storageAction("delete")}><Trash2 className="mr-1 h-4 w-4" />Delete draft</Button></div></div>
                <div className="space-y-2 border-t border-border pt-4"><p className="text-xs font-semibold">Public Passport</p><Button className="w-full" disabled={storageBusy || !documentBlob} onClick={() => { if (window.confirm("Make this complete PDF public on your Passport? It will replace your current published EPK.")) void storageAction("publish"); }}>{storageBusy ? <KretopiaSpinner className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}Add complete PDF to Passport</Button><Button variant="ghost" size="sm" disabled={storageBusy} onClick={() => { if (window.confirm("Remove your published EPK from your Passport?")) void storageAction("unpublish"); }}>Remove from Passport</Button></div>
              </div>}
              {activeTab === "content" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Display Name</Label>
                    <Input
                      value={displayName}
                      onChange={e => { setDisplayName(e.target.value); markChanged(); }}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Title / Role</Label>
                    <Input
                      value={displayRole}
                      onChange={e => { setDisplayRole(e.target.value); markChanged(); }}
                      placeholder="Creative Director, Music Producer, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Tagline</Label>
                    <Input
                      value={tagline}
                      onChange={e => { setTagline(e.target.value); markChanged(); }}
                      placeholder="A short tagline for your EPK cover"
                    />
                  </div>
                  <EPKDraftField label="Bio" value={bio} data={buildModifiedData()} onChange={value => { setBio(value); markChanged(); }} />
                  {EPK_TOPICS.map(topic => <EPKDraftField key={topic.id} label={topic.label} value={topics[topic.id] || ""} data={buildModifiedData()} onChange={value => { setTopics(prev => ({ ...prev, [topic.id]: value })); markChanged(); }} />)}
                  {importedText && <div className="space-y-2 rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold break-all">{importName} · Imported draft</p>
                    <Textarea aria-label="Imported EPK text" value={importedText} onChange={e => setImportedText(e.target.value)} rows={8} />
                    <div className="flex flex-wrap gap-2">{[{ id: "bio", label: "Bio" }, ...EPK_TOPICS].map(topic => <Button key={topic.id} variant="outline" size="sm" onClick={() => { if (topic.id === "bio") setBio(importedText); else setTopics(prev => ({ ...prev, [topic.id]: importedText })); markChanged(); }}><Check className="h-3 w-3" />{topic.label}</Button>)}</div>
                    <Button variant="ghost" size="sm" onClick={() => setImportedText("")}>Discard import</Button>
                  </div>}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Location</Label>
                    <Input
                      value={location}
                      onChange={e => { setLocation(e.target.value); markChanged(); }}
                      placeholder="City, Country"
                    />
                  </div>

                  {/* Credits editing */}
                  {epkData.credits.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-semibold">Credits ({epkData.credits.length})</Label>
                      <p className="text-[10px] text-muted-foreground">Toggle visibility or edit roles</p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {epkData.credits.map((credit, i) => {
                          const id = (credit as any).id || `credit-${i}`;
                          const override = creditOverrides[id];
                          const isHidden = override?.hidden;
                          return (
                            <div key={id} className={cn(
                              "flex items-center gap-2 p-2 rounded-md border text-xs",
                              isHidden ? "opacity-50 bg-muted/50" : "bg-background"
                            )}>
                              <button
                                onClick={() => {
                                  setCreditOverrides(prev => ({
                                    ...prev,
                                    [id]: { ...prev[id], hidden: !isHidden }
                                  }));
                                  markChanged();
                                }}
                                className="shrink-0"
                              >
                                {isHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{credit.project_name || credit.title}</p>
                                <Input
                                  value={override?.customRole || credit.role}
                                  onChange={e => {
                                    setCreditOverrides(prev => ({
                                      ...prev,
                                      [id]: { ...prev[id], customRole: e.target.value }
                                    }));
                                    markChanged();
                                  }}
                                  className="h-6 text-xs mt-1 px-1.5"
                                  placeholder="Role"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === "sections" && (
                <>
                  <p className="text-xs text-muted-foreground">Drag to reorder, toggle visibility</p>
                  <div className="space-y-1">
                    {sections.map((section, index) => (
                      <div
                        key={section.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-md border cursor-move transition-colors",
                          dragIndex === index ? "bg-primary/10 border-primary/30" : "bg-background hover:bg-muted/50",
                          !section.visible && "opacity-50"
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm font-medium">{section.label}</span>
                        <button onClick={() => toggleSection(section.id)}>
                          {section.visible
                            ? <Eye className="h-4 w-4 text-primary" />
                            : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "template" && isCreatorPlus && (
                <>
                  <p className="text-xs text-muted-foreground">Choose a design template for your EPK deck</p>
                  <div className="space-y-3">
                    {EPK_TEMPLATES.map(tpl => {
                      const isSelected = selectedTemplate === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => {
                            setSelectedTemplate(tpl.id);
                            // Auto-update branding colors to match template
                            setBranding(prev => ({
                              ...prev,
                              primaryColor: rgbToHex(tpl.palette.primary),
                              accentColor: rgbToHex(tpl.palette.accent),
                              darkColor: rgbToHex(tpl.palette.bg),
                            }));
                            markChanged();
                          }}
                          className={cn(
                            "w-full text-left rounded-lg border-2 p-3 transition-all",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-muted-foreground/30"
                          )}
                        >
                          {/* Preview swatch */}
                          <div className="flex items-center gap-3 mb-2">
                            <div className={cn("w-10 h-10 rounded-md flex items-center justify-center", tpl.previewBg)}>
                              <div className={cn("w-4 h-4 rounded-full", tpl.previewAccent)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{tpl.name}</span>
                                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-tight">{tpl.description}</p>
                            </div>
                          </div>
                          {/* Color strip preview */}
                          <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                            <div className="flex-1" style={{ backgroundColor: rgbToHex(tpl.palette.bg) }} />
                            <div className="flex-1" style={{ backgroundColor: rgbToHex(tpl.palette.primary) }} />
                            <div className="flex-1" style={{ backgroundColor: rgbToHex(tpl.palette.accent) }} />
                            <div className="flex-1" style={{ backgroundColor: rgbToHex(tpl.palette.gold) }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}


              {activeTab === "branding" && isCreatorPlus && (
                <>
                  <p className="text-xs text-muted-foreground">Customize your EPK branding</p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Primary Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={branding.primaryColor}
                          onChange={e => { setBranding(prev => ({ ...prev, primaryColor: e.target.value })); markChanged(); }}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <Input
                          value={branding.primaryColor}
                          onChange={e => { setBranding(prev => ({ ...prev, primaryColor: e.target.value })); markChanged(); }}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Accent Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={branding.accentColor}
                          onChange={e => { setBranding(prev => ({ ...prev, accentColor: e.target.value })); markChanged(); }}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <Input
                          value={branding.accentColor}
                          onChange={e => { setBranding(prev => ({ ...prev, accentColor: e.target.value })); markChanged(); }}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Dark / Background Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={branding.darkColor}
                          onChange={e => { setBranding(prev => ({ ...prev, darkColor: e.target.value })); markChanged(); }}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <Input
                          value={branding.darkColor}
                          onChange={e => { setBranding(prev => ({ ...prev, darkColor: e.target.value })); markChanged(); }}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Logo URL</Label>
                      <Input
                        value={branding.logoUrl}
                        onChange={e => { setBranding(prev => ({ ...prev, logoUrl: e.target.value })); markChanged(); }}
                        placeholder="https://your-logo.com/logo.png"
                      />
                      <p className="text-[10px] text-muted-foreground">Appears in the footer of each page</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Footer Tagline</Label>
                      <Input
                        value={branding.tagline}
                        onChange={e => { setBranding(prev => ({ ...prev, tagline: e.target.value })); markChanged(); }}
                        placeholder="Your brand tagline"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Preview area */}
        <div className={cn("flex-1 min-w-0 flex-col overflow-hidden bg-muted/20", sidebarCollapsed ? "flex" : "hidden sm:flex")}>
          <div ref={previewRef} className="flex-1 min-h-0 w-full overflow-hidden bg-background">
            {documentBlob ? <EPKDocumentViewer source={documentBlob} label={documentMode === "original" ? "Your PDF" : "Kretopia draft"} toolbarLeading={<Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Toggle editor panels" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><PanelLeft className="h-4 w-4" /></Button>} /> : <div className="flex h-full items-center justify-center"><KretopiaSpinner className="h-10 w-10" /></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Live preview ────────────────────────────────────────────────────────
// A landscape, page-by-page mirror of the real generateEPKPdf() output --
// same dark canvas, bordered cards, pink accent, K-icon eyebrows and page
// order as the actual PDF, instead of the old single-column mobile-card
// mockup that shared none of the PDF's structure or visual language.

const PdfPageFrame = ({
  dark,
  children,
}: {
  dark: string;
  children: ReactNode;
}) => (
  <div
    className="relative w-full aspect-[338/190] rounded-lg border border-[var(--epk-line)] overflow-hidden shrink-0"
    style={{ background: dark, fontFamily: "var(--font-family-brand)" }}
  >
    {children}
  </div>
);

const PdfCard = ({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) => (
  <div className={cn("rounded-md border border-[var(--epk-line)] bg-[var(--epk-surface)]", className)} style={style}>
    {children}
  </div>
);

const PdfEyebrow = ({ label, primary }: { label: string; primary: string }) => (
  <div className="flex items-center gap-1.5 mb-2">
    <BrandLogo size="sm" iconOnly className="[&_img]:h-[10px] [&_img]:w-[10px]" />
    <span className="text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: primary }}>{label}</span>
  </div>
);

const PdfPill = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--epk-line)] bg-[var(--epk-surface)] px-2 py-0.5 text-[7px] text-[var(--epk-muted)]">
    {label}
  </span>
);

const EPKPreview = ({
  data,
  branding,
  sections,
  templateId,
}: {
  data: EPKPdfInput;
  branding?: EPKBranding;
  tagline?: string;
  sections: EPKSection[];
  templateId?: EPKTemplateId;
}) => {
  const template = EPK_TEMPLATES.find(t => t.id === templateId) || EPK_TEMPLATES[0];
  const primary = branding?.primaryColor || rgbToHex(template.palette.primary);
  const dark = branding?.darkColor || rgbToHex(template.palette.bg);
  const { profile, credits, awards, pressLinks, industryStats, reviews } = data;
  // Content-driven sections (credits/awards/press/credentials/reviews) are
  // already filtered into empty arrays by buildModifiedData() when hidden,
  // so pages below check array length only -- re-checking visibleIds too
  // would incorrectly hide, say, still-visible press links whenever only
  // the separate "Awards" toggle was off. bio/skills have no such backing
  // data filter (a real, pre-existing gap -- see EPK_PDF investigation),
  // so those two still gate on visibleIds directly.
  const visibleIds = new Set(sections.filter(s => s.visible).map(s => s.id));

  // Build the same page list generateEPKPdf() would, in the same order,
  // so "page 3 of 5" in the preview really is credits, not a guess.
  const pages: { key: string; render: () => ReactNode }[] = [];

  pages.push({
    key: "cover",
    render: () => (
      <div className="relative h-full p-4 flex flex-col">
        <BrandLogo size="sm" className="[&_img]:h-3" />
        <div className="mt-3">
          <PdfEyebrow label="Creative Passport" primary={primary} />
        </div>
        <div className="mt-1 flex items-center gap-3">
          {profile.avatar_url && (
            <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-md object-cover" />
          )}
          <div>
            <p className="text-lg font-bold text-[var(--epk-ink)] leading-tight">{profile.full_name || "Creator"}</p>
            <p className="text-[10px] font-semibold" style={{ color: primary }}>{profile.job_title || profile.role || "Creative Professional"}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.location && <PdfPill label={profile.location} />}
          {(profile.verification_tier || profile.verification_status === "verified") && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[7px] font-semibold" style={{ backgroundColor: `${primary}22`, color: primary }}>
              Verified Creator
            </span>
          )}
        </div>
        {profile.bio && <p className="mt-3 max-w-lg text-[9px] leading-relaxed text-[var(--epk-muted)] line-clamp-4">{profile.bio}</p>}
        {data.narratives?.practice && <p className="mt-2 text-[8px] text-[var(--epk-muted)] line-clamp-2">{data.narratives.practice}</p>}
        <div className="mt-auto flex gap-2 self-end">
          {[
            credits.length > 0 && { l: "Credits", v: credits.length },
            awards.length > 0 && { l: "Awards", v: awards.length },
            profile.average_rating && { l: "Rating", v: profile.average_rating.toFixed(1) },
          ].filter(Boolean).map((s: any) => (
            <PdfCard key={s.l} className="px-3 py-1.5 text-center">
              <p className="text-sm font-bold" style={{ color: primary }}>{s.v}</p>
              <p className="text-[6px] uppercase tracking-wide text-[var(--epk-muted)]">{s.l}</p>
            </PdfCard>
          ))}
        </div>
      </div>
    ),
  });

  if ((visibleIds.has("bio") && profile.bio) || (visibleIds.has("skills") && ((Array.isArray(profile.professional_skills) && profile.professional_skills.length) || (Array.isArray(profile.passion_skills) && profile.passion_skills.length)))) {
    pages.push({
      key: "about",
      render: () => (
        <div className="h-full p-4 grid grid-cols-2 gap-4">
          <div>
            <PdfEyebrow label="Profile" primary={primary} />
            <p className="text-[11px] font-bold text-[var(--epk-ink)] mb-1.5">About</p>
            {visibleIds.has("bio") && profile.bio && (
              <p className="text-[7.5px] leading-relaxed text-[var(--epk-muted)] line-clamp-6">{profile.bio}</p>
            )}
          </div>
          <div>
            <PdfEyebrow label="Expertise" primary={primary} />
            <p className="text-[11px] font-bold text-[var(--epk-ink)] mb-1.5">Skills</p>
            {visibleIds.has("skills") && (
              <div className="flex flex-wrap gap-1">
                {[...(Array.isArray(profile.professional_skills) ? profile.professional_skills : []), ...(Array.isArray(profile.passion_skills) ? profile.passion_skills : [])]
                  .slice(0, 6)
                  .map((s: any, i: number) => <PdfPill key={i} label={typeof s === "string" ? s : s?.skill || s?.name} />)}
              </div>
            )}
          </div>
        </div>
      ),
    });
  }

  if (credits.length > 0) {
    pages.push({
      key: "credits",
      render: () => (
        <div className="h-full p-4">
          <PdfEyebrow label="Portfolio" primary={primary} />
          <p className="text-[11px] font-bold text-[var(--epk-ink)] mb-2">Selected Work — {credits.length} Credits</p>
          <div className="grid grid-cols-4 gap-2">
            {credits.slice(0, 4).map((c, i) => (
              <PdfCard key={i} className="overflow-hidden">
                <div className="h-1" style={{ backgroundColor: primary }} />
                <div className="p-1.5">
                  <p className="text-[7px] font-bold text-[var(--epk-ink)] truncate">{c.project_name || c.title}</p>
                  <p className="text-[6px] text-[var(--epk-muted)] truncate">{c.role}</p>
                </div>
              </PdfCard>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (awards.length > 0 || pressLinks.length > 0) {
    pages.push({
      key: "awards",
      render: () => (
        <div className="h-full p-4 grid grid-cols-2 gap-4">
          <div>
            <PdfEyebrow label="Recognition" primary={primary} />
            <p className="text-[11px] font-bold text-[var(--epk-ink)] mb-1.5">Awards</p>
            <div className="space-y-1">
              {awards.slice(0, 3).map((a, i) => (
                <PdfCard key={i} className="p-1.5">
                  <p className="text-[7px] font-bold" style={{ color: primary }}>{a.title}</p>
                  <p className="text-[6px] text-[var(--epk-muted)]">{a.organization}</p>
                </PdfCard>
              ))}
            </div>
          </div>
          <div>
            <PdfEyebrow label="Coverage" primary={primary} />
            <p className="text-[11px] font-bold text-[var(--epk-ink)] mb-1.5">Featured In</p>
            <div className="space-y-1">
              {pressLinks.slice(0, 3).map((p, i) => (
                <PdfCard key={i} className="p-1.5">
                  <p className="text-[7px] font-bold text-[var(--epk-ink)]">{p.title}</p>
                </PdfCard>
              ))}
            </div>
          </div>
        </div>
      ),
    });
  }

  if (reviews.length > 0) {
    pages.push({
      key: "reviews",
      render: () => (
        <div className="h-full p-4">
          <PdfEyebrow label="Word of Mouth" primary={primary} />
          <p className="text-[11px] font-bold text-[var(--epk-ink)] mb-2">Client Testimonials</p>
          <div className="grid grid-cols-2 gap-2">
            {reviews.slice(0, 2).map((r, i) => (
              <PdfCard key={i} className="p-2">
                <div className="flex gap-0.5 mb-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-2 w-2" fill={s < Math.round(r.rating) ? "#FFC440" : "none"} stroke="#FFC440" />
                  ))}
                </div>
                {r.reviewer_name && <p className="text-[7px] font-bold" style={{ color: primary }}>{r.reviewer_name}</p>}
                {r.review_text && <p className="text-[6.5px] italic text-[var(--epk-muted)] line-clamp-3 mt-0.5">"{r.review_text}"</p>}
              </PdfCard>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (industryStats.length > 0) {
    pages.push({
      key: "credentials",
      render: () => (
        <div className="h-full p-4">
          <PdfEyebrow label="Credentials" primary={primary} />
          <p className="text-[11px] font-bold text-[var(--epk-ink)] mb-2">Credentials &amp; Industry Stats</p>
          <div className="flex gap-2">
            {industryStats.slice(0, 4).map((s, i) => (
              <PdfCard key={i} className="flex-1 p-2 text-center">
                <p className="text-sm font-bold" style={{ color: primary }}>{s.value}</p>
                <p className="text-[6px] font-semibold text-[var(--epk-muted)] mt-0.5">{s.title}</p>
              </PdfCard>
            ))}
          </div>
        </div>
      ),
    });
  }

  const narrativeTopics = EPK_TOPICS.filter(topic => data.narratives?.[topic.id]?.trim());
  for (let offset = 0; offset < narrativeTopics.length; offset += 4) {
    const group = narrativeTopics.slice(offset, offset + 4);
    pages.push({ key: `dossier-${offset / 4 + 1}`, render: () => <div className="h-full p-4"><PdfEyebrow label="Creative dossier" primary={primary} /><div className="grid grid-cols-2 gap-3">{group.map(topic => <div key={topic.id}><p className="text-[10px] font-bold text-[var(--epk-ink)] mb-1">{topic.label}</p><p className="text-[8px] leading-relaxed whitespace-pre-line text-[var(--epk-muted)] line-clamp-6">{data.narratives?.[topic.id]}</p></div>)}</div></div> });
  }

  pages.push({
    key: "closing",
    render: () => (
      <div className="relative h-full p-4 flex flex-col">
        <BrandLogo size="sm" className="[&_img]:h-3" />
        <div className="mt-auto flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-[var(--epk-ink)] leading-tight">Let's create</p>
            <p className="text-xl font-bold leading-tight" style={{ color: primary }}>together.</p>
            <div className="h-[2px] w-8 mt-1.5 mb-2" style={{ backgroundColor: primary }} />
            <span className="inline-block rounded-full px-3 py-1 text-[8px] font-bold" style={{ backgroundColor: primary, color: dark }}>
              View Full Passport
            </span>
          </div>
          <PdfCard className="p-2.5 w-32">
            <p className="text-[6px] uppercase tracking-wide text-[var(--epk-muted)]">Contact</p>
            <p className="text-[9px] font-bold text-[var(--epk-ink)] mt-0.5">{profile.full_name}</p>
            <p className="text-[7px]" style={{ color: primary }}>{profile.job_title || profile.role}</p>
          </PdfCard>
        </div>
      </div>
    ),
  });

  const [pageIdx, setPageIdx] = useState(0);
  const clampedIdx = Math.min(pageIdx, pages.length - 1);

  return (
    <div className="k-epk-preview w-full max-w-2xl" style={{ "--epk-ink": rgbToHex(template.palette.white), "--epk-muted": rgbToHex(template.palette.muted), "--epk-line": rgbToHex(template.palette.cardBorder), "--epk-surface": rgbToHex(template.palette.card), "--epk-accent": primary, "--epk-canvas": dark } as CSSProperties}>
      <PdfPageFrame dark={dark}>
        {pages[clampedIdx]?.render()}
        <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ backgroundColor: primary, opacity: 0.6 }} />
      </PdfPageFrame>
      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={clampedIdx === 0} onClick={() => setPageIdx(i => Math.max(0, i - 1))}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {clampedIdx + 1} of {pages.length} — {pages[clampedIdx].key}
        </span>
        <Button variant="ghost" size="sm" disabled={clampedIdx === pages.length - 1} onClick={() => setPageIdx(i => Math.min(pages.length - 1, i + 1))}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Utilities
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
