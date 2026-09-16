import { useState, useEffect, useCallback, type ReactNode, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Monitor, Smartphone, X, Save, Loader2, Eye, EyeOff,
  GripVertical, ChevronDown, ChevronRight, ChevronLeft, Wand2,
  PanelLeft, ArrowLeft, Crown, Lock, FileDown, Palette, Star,
  Type, Image as ImageIcon, Plus, Trash2, LayoutTemplate, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { hasProAccess, hasCreatorProAccess } from "@/lib/subscriptionConfig";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import type { EPKPdfInput } from "@/lib/epkPdfGenerator";
import { EPK_TEMPLATES, type EPKTemplateId } from "@/lib/epkPdfGenerator";

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
  { id: "contact", label: "Contact & Links", visible: true },
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

type EditorTab = "content" | "sections" | "template" | "branding";

export const EPKPdfEditor = ({ open, onClose, epkData, userId }: EPKPdfEditorProps) => {
  const { subscriptionInfo } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isPro = hasProAccess((subscriptionInfo?.tier || "free") as any);
  const isCreatorPlus = hasCreatorProAccess((subscriptionInfo?.tier || "free") as any);

  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("content");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Editable state
  const [displayName, setDisplayName] = useState(epkData.profile.full_name || "");
  const [displayRole, setDisplayRole] = useState(epkData.profile.job_title || epkData.profile.role || "");
  const [bio, setBio] = useState(epkData.profile.bio || "");
  const [location, setLocation] = useState(epkData.profile.location || "");
  const [tagline, setTagline] = useState("");
  const [sections, setSections] = useState<EPKSection[]>(DEFAULT_SECTIONS);
  const [branding, setBranding] = useState<EPKBranding>({
    primaryColor: "#FF2DA1",
    accentColor: "#FF2DA1",
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
      setBio(epkData.profile.bio || "");
      setLocation(epkData.profile.location || "");
      setHasChanges(false);
    }
  }, [open, epkData]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  // Build modified EPK data from editor state
  const buildModifiedData = useCallback((): EPKPdfInput => {
    const visibleSectionIds = new Set(sections.filter(s => s.visible).map(s => s.id));
    
    return {
      profile: {
        ...epkData.profile,
        full_name: displayName,
        job_title: displayRole,
        role: displayRole,
        bio,
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
    };
  }, [epkData, displayName, displayRole, bio, location, sections, creditOverrides]);

  const handleDownload = async () => {
    setGenerating(true);
    try {
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
        await generateEPKPdf(modifiedData);
      }
      toast({ title: "EPK PDF downloaded!", description: "Your professional EPK deck has been saved." });
    } catch (error) {
      console.error("EPK PDF generation error:", error);
      toast({ title: "Failed to generate PDF", description: "Please try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
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
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="hidden sm:block">
            <h2 className="text-sm font-semibold">EPK PDF Editor</h2>
            <p className="text-xs text-muted-foreground">
              {isCreatorPlus ? "Creator+ • Full Branding" : "Creator • Basic Editor"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Unsaved changes</Badge>
          )}
          <Button size="sm" onClick={handleDownload} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {generating ? "Generating..." : "Download PDF"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={cn(
          "border-r bg-muted/30 transition-all duration-200 flex flex-col shrink-0",
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-80"
        )}>
          {/* Tab bar */}
          <div className="flex border-b shrink-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const locked = tab.proOnly && !isCreatorPlus;
              return (
                <button
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
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                    activeTab === tab.id ? "bg-background text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground",
                    locked && "opacity-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {locked && <Lock className="h-3 w-3" />}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
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
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Bio</Label>
                    <Textarea
                      value={bio}
                      onChange={e => { setBio(e.target.value); markChanged(); }}
                      placeholder="About you..."
                      rows={5}
                    />
                  </div>
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
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Live Preview</span>
            <div />
          </div>
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center">
            <EPKPreview
              data={buildModifiedData()}
              branding={isCreatorPlus ? branding : undefined}
              tagline={tagline}
              sections={sections}
            />
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
    className="relative w-full aspect-[338/190] rounded-xl border border-white/10 overflow-hidden shrink-0"
    style={{ background: dark, fontFamily: "'Satoshi', 'Inter', sans-serif" }}
  >
    {children}
  </div>
);

const PdfCard = ({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) => (
  <div className={cn("rounded-md border border-white/[0.08] bg-white/[0.03]", className)} style={style}>
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
  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[7px] text-white/70">
    {label}
  </span>
);

const EPKPreview = ({
  data,
  branding,
  sections,
}: {
  data: EPKPdfInput;
  branding?: EPKBranding;
  tagline?: string;
  sections: EPKSection[];
}) => {
  const primary = branding?.primaryColor || "#FF2DA1";
  const dark = branding?.darkColor || "#05070D";
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
            <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-md object-cover ring-2" style={{ ["--tw-ring-color" as string]: primary }} />
          )}
          <div>
            <p className="text-lg font-bold text-white leading-tight">{profile.full_name || "Creator"}</p>
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
        <div className="mt-auto flex gap-2 self-end">
          {[
            credits.length > 0 && { l: "Credits", v: credits.length },
            awards.length > 0 && { l: "Awards", v: awards.length },
            profile.average_rating && { l: "Rating", v: profile.average_rating.toFixed(1) },
          ].filter(Boolean).map((s: any) => (
            <PdfCard key={s.l} className="px-3 py-1.5 text-center">
              <p className="text-sm font-bold" style={{ color: primary }}>{s.v}</p>
              <p className="text-[6px] uppercase tracking-wide text-white/50">{s.l}</p>
            </PdfCard>
          ))}
        </div>
      </div>
    ),
  });

  if (visibleIds.has("bio") || visibleIds.has("skills")) {
    pages.push({
      key: "about",
      render: () => (
        <div className="h-full p-4 grid grid-cols-2 gap-4">
          <div>
            <PdfEyebrow label="Profile" primary={primary} />
            <p className="text-[11px] font-bold text-white mb-1.5">About</p>
            {visibleIds.has("bio") && profile.bio && (
              <p className="text-[7.5px] leading-relaxed text-white/70 line-clamp-6">{profile.bio}</p>
            )}
          </div>
          <div>
            <PdfEyebrow label="Expertise" primary={primary} />
            <p className="text-[11px] font-bold text-white mb-1.5">Skills &amp; Connect</p>
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
          <p className="text-[11px] font-bold text-white mb-2">Selected Work — {credits.length} Credits</p>
          <div className="grid grid-cols-4 gap-2">
            {credits.slice(0, 4).map((c, i) => (
              <PdfCard key={i} className="overflow-hidden">
                <div className="h-1" style={{ backgroundColor: primary }} />
                <div className="p-1.5">
                  <p className="text-[7px] font-bold text-white truncate">{c.project_name || c.title}</p>
                  <p className="text-[6px] text-white/60 truncate">{c.role}</p>
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
            <p className="text-[11px] font-bold text-white mb-1.5">Awards</p>
            <div className="space-y-1">
              {awards.slice(0, 3).map((a, i) => (
                <PdfCard key={i} className="p-1.5">
                  <p className="text-[7px] font-bold" style={{ color: primary }}>{a.title}</p>
                  <p className="text-[6px] text-white/50">{a.organization}</p>
                </PdfCard>
              ))}
            </div>
          </div>
          <div>
            <PdfEyebrow label="Coverage" primary={primary} />
            <p className="text-[11px] font-bold text-white mb-1.5">Featured In</p>
            <div className="space-y-1">
              {pressLinks.slice(0, 3).map((p, i) => (
                <PdfCard key={i} className="p-1.5">
                  <p className="text-[7px] font-bold text-white">{p.title}</p>
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
          <p className="text-[11px] font-bold text-white mb-2">Client Testimonials</p>
          <div className="grid grid-cols-2 gap-2">
            {reviews.slice(0, 2).map((r, i) => (
              <PdfCard key={i} className="p-2">
                <div className="flex gap-0.5 mb-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-2 w-2" fill={s < Math.round(r.rating) ? "#FFC440" : "none"} stroke="#FFC440" />
                  ))}
                </div>
                {r.reviewer_name && <p className="text-[7px] font-bold" style={{ color: primary }}>{r.reviewer_name}</p>}
                {r.review_text && <p className="text-[6.5px] italic text-white/60 line-clamp-3 mt-0.5">"{r.review_text}"</p>}
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
          <p className="text-[11px] font-bold text-white mb-2">Credentials &amp; Industry Stats</p>
          <div className="flex gap-2">
            {industryStats.slice(0, 4).map((s, i) => (
              <PdfCard key={i} className="flex-1 p-2 text-center">
                <p className="text-sm font-bold" style={{ color: primary }}>{s.value}</p>
                <p className="text-[6px] font-semibold text-white/70 mt-0.5">{s.title}</p>
              </PdfCard>
            ))}
          </div>
        </div>
      ),
    });
  }

  pages.push({
    key: "closing",
    render: () => (
      <div className="relative h-full p-4 flex flex-col">
        <BrandLogo size="sm" className="[&_img]:h-3" />
        <div className="mt-auto flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-white leading-tight">Let's create</p>
            <p className="text-xl font-bold leading-tight" style={{ color: primary }}>together.</p>
            <div className="h-[2px] w-8 mt-1.5 mb-2" style={{ backgroundColor: primary }} />
            <span className="inline-block rounded-full px-3 py-1 text-[8px] font-bold" style={{ backgroundColor: primary, color: dark }}>
              View Full Passport
            </span>
          </div>
          <PdfCard className="p-2.5 w-32">
            <p className="text-[6px] uppercase tracking-wide text-white/40">Contact</p>
            <p className="text-[9px] font-bold text-white mt-0.5">{profile.full_name}</p>
            <p className="text-[7px]" style={{ color: primary }}>{profile.job_title || profile.role}</p>
          </PdfCard>
        </div>
      </div>
    ),
  });

  const [pageIdx, setPageIdx] = useState(0);
  const clampedIdx = Math.min(pageIdx, pages.length - 1);

  return (
    <div className="w-full max-w-2xl">
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
