import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Monitor, Smartphone, Tablet, RefreshCw, ExternalLink, X, Save, Loader2,
  Eye, EyeOff, GripVertical, ChevronDown, ChevronRight, Wand2, Layout,
  PanelLeft, CheckCircle2, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { BlockEditor } from "@/components/creator-site/blocks/BlockEditor";
import type { ContentBlock } from "@/components/creator-site/blocks/BlockTypes";
import { SiteSection } from "@/components/settings/CreatorSiteSectionEditor";
import { TEMPLATES, isTemplateAccessible } from "@/components/creator-site/templateConfig";
import { hasCreatorProAccess } from "@/lib/subscriptionConfig";
import { Lock, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DEVICES = [
  { id: 'desktop', icon: Monitor, width: '100%', label: 'Desktop' },
  { id: 'tablet', icon: Tablet, width: '768px', label: 'Tablet' },
  { id: 'mobile', icon: Smartphone, width: '375px', label: 'Mobile' },
] as const;

const DEFAULT_SECTIONS: SiteSection[] = [
  { id: "hero", label: "Hero", visible: true },
  { id: "services", label: "Services", visible: true },
  { id: "credits", label: "Work & Credits", visible: true },
  { id: "testimonials", label: "Testimonials", visible: true },
  { id: "contact", label: "Contact", visible: true },
];

interface FullScreenEditorProps {
  open: boolean;
  onClose: () => void;
  siteUrl: string;
  initialData: {
    template: string;
    sections: SiteSection[];
    headline: string;
    bio: string;
    customBlocks: ContentBlock[];
  };
  onSaved: () => void;
  onOpenAI: () => void;
}

type EditorTab = 'content' | 'sections' | 'blocks' | 'template';

export const FullScreenSiteEditor = ({ open, onClose, siteUrl, initialData, onSaved, onOpenAI }: FullScreenEditorProps) => {
  const { user, subscriptionInfo } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isCreatorPro = hasCreatorProAccess(subscriptionInfo.tier as any);

  const [device, setDevice] = useState<string>('desktop');
  const [previewKey, setPreviewKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('content');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Editor state
  const [template, setTemplate] = useState(initialData.template);
  const [headline, setHeadline] = useState(initialData.headline);
  const [bio, setBio] = useState(initialData.bio);
  const [sections, setSections] = useState<SiteSection[]>(
    initialData.sections?.length ? initialData.sections : DEFAULT_SECTIONS
  );
  const [customBlocks, setCustomBlocks] = useState<ContentBlock[]>(initialData.customBlocks || []);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setTemplate(initialData.template);
      setHeadline(initialData.headline);
      setBio(initialData.bio);
      setSections(initialData.sections?.length ? initialData.sections : DEFAULT_SECTIONS);
      setCustomBlocks(initialData.customBlocks || []);
      setHasChanges(false);
    }
  }, [open]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        site_template: template,
        site_headline: headline || null,
        site_bio: bio || null,
        site_sections: sections as any,
        site_custom_blocks: customBlocks as any,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      toast({ title: "Site saved!" });
      setHasChanges(false);
      setPreviewKey(k => k + 1);
      onSaved();
    }
    setSaving(false);
  };

  const handleTemplateChange = async (templateId: string) => {
    setTemplate(templateId);
    markChanged();
  };

  // Section drag handlers
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

  if (!open) return null;

  const currentDevice = DEVICES.find(d => d.id === device) || DEVICES[0];

  const tabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'content', label: 'Content', icon: <Layout className="h-4 w-4" /> },
    { id: 'sections', label: 'Sections', icon: <GripVertical className="h-4 w-4" /> },
    { id: 'blocks', label: 'Blocks', icon: <PanelLeft className="h-4 w-4" /> },
    { id: 'template', label: 'Template', icon: <Eye className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-3 bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Back</span>
          </Button>
          <div className="h-5 w-px bg-border" />
          <span className="text-sm font-medium hidden md:inline">Site Editor</span>
          {hasChanges && (
            <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
              Unsaved
            </span>
          )}
        </div>

        {/* Device switcher - center */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {DEVICES.map((d) => (
            <Button
              key={d.id}
              variant={device === d.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setDevice(d.id)}
              title={d.label}
            >
              <d.icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>

        {/* Actions - right */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setPreviewKey(k => k + 1)} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Open site">
            <a href={siteUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 hidden sm:flex" onClick={onOpenAI}>
            <Wand2 className="h-3.5 w-3.5" />
            AI
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={cn(
          "border-r border-border bg-background flex flex-col transition-all duration-200 shrink-0",
          sidebarCollapsed ? "w-12" : "w-80 lg:w-96"
        )}>
          {/* Tab strip */}
          {!sidebarCollapsed && (
            <div className="flex border-b border-border shrink-0">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2",
                    activeTab === tab.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              ))}
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="px-2 py-2.5 text-muted-foreground hover:text-foreground transition-colors hidden md:flex items-center"
                title="Collapse sidebar"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Collapse toggle - inside sidebar at top */}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="flex items-center justify-center w-full py-3 hover:bg-muted transition-colors"
              title="Expand editor"
            >
              <PanelLeft className="h-4 w-4 rotate-180" />
            </button>
          )}

          {/* Tab content */}
          {!sidebarCollapsed && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Content tab */}
                {activeTab === 'content' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Headline</Label>
                      <Input
                        placeholder="e.g. Award-Winning Director"
                        value={headline}
                        onChange={(e) => { setHeadline(e.target.value); markChanged(); }}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Site Bio</Label>
                      <Textarea
                        placeholder="Write a custom bio..."
                        value={bio}
                        onChange={(e) => { setBio(e.target.value); markChanged(); }}
                        rows={6}
                        className="text-sm resize-none"
                      />
                    </div>
                  </>
                )}

                {/* Sections tab */}
                {activeTab === 'sections' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Drag to reorder. Toggle visibility.</p>
                    {sections.map((section, index) => (
                      <div key={section.id}>
                        <div
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing",
                            dragIndex === index ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:bg-muted/50",
                            !section.visible && "opacity-50"
                          )}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <button
                            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                            className="flex items-center gap-1 flex-1 text-left"
                          >
                            {expandedSection === section.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="text-sm font-medium">{section.customTitle || section.label}</span>
                          </button>
                          <button
                            onClick={() => {
                              setSections(prev => prev.map(s => s.id === section.id ? { ...s, visible: !s.visible } : s));
                              markChanged();
                            }}
                            className="p-1 rounded hover:bg-muted"
                          >
                            {section.visible ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </div>
                        {expandedSection === section.id && (
                          <div className="ml-6 mt-1 mb-2 p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                            <Input
                              placeholder={section.label}
                              value={section.customTitle || ""}
                              onChange={(e) => {
                                setSections(prev => prev.map(s => s.id === section.id ? { ...s, customTitle: e.target.value } : s));
                                markChanged();
                              }}
                              className="text-xs h-8"
                            />
                            {section.id !== 'hero' && (
                              <Textarea
                                placeholder="Custom subtitle..."
                                value={section.customContent || ""}
                                onChange={(e) => {
                                  setSections(prev => prev.map(s => s.id === section.id ? { ...s, customContent: e.target.value } : s));
                                  markChanged();
                                }}
                                rows={2}
                                className="text-xs resize-none"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Blocks tab */}
                {activeTab === 'blocks' && (
                  <BlockEditor
                    blocks={customBlocks}
                    onChange={(blocks) => { setCustomBlocks(blocks); markChanged(); }}
                  />
                )}

                {/* Template tab */}
                {activeTab === 'template' && (
                  <div className="space-y-2">
                    {TEMPLATES.map(t => {
                      const accessible = isTemplateAccessible(t.id, isCreatorPro);
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            if (!accessible) {
                              toast({ title: "Creator Pro Template", description: `"${t.name}" requires Creator Pro.` });
                              navigate("/subscription");
                              return;
                            }
                            handleTemplateChange(t.id);
                          }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border w-full text-left transition-all",
                            template === t.id ? "border-primary ring-1 ring-primary bg-primary/5" : accessible ? "border-border hover:border-muted-foreground/30" : "border-border opacity-60 hover:opacity-80"
                          )}
                        >
                          <div className={cn("w-8 h-8 rounded-md border border-border flex items-center justify-center shrink-0", t.preview)}>
                            <div className={cn("w-2.5 h-2.5 rounded-full", t.accent)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">{t.name}</span>
                              {!accessible && <Lock className="h-3 w-3 text-muted-foreground" />}
                            </div>
                            {!accessible && <p className="text-[10px] text-primary">Creator Pro</p>}
                          </div>
                          {template === t.id && accessible && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                          {!accessible && <Crown className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Preview area */}
        <div className="flex-1 flex items-start justify-center overflow-auto bg-muted/30 p-4">
          <div
            className="bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-300 h-full"
            style={{ width: currentDevice.width, maxWidth: '100%' }}
          >
            <iframe
              key={previewKey}
              src={siteUrl}
              className="w-full h-full border-0"
              title="Site Preview"
              style={{ minHeight: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Mobile bottom bar - visible on small screens */}
      <div className="md:hidden border-t border-border bg-background p-2 flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onOpenAI}>
          <Wand2 className="h-3.5 w-3.5 mr-1" /> AI
        </Button>
        <Button size="sm" className="flex-1 text-xs" onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Save
        </Button>
      </div>
    </div>
  );
};
