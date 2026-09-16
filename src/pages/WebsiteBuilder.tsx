import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Monitor, Smartphone, Tablet, RefreshCw, ExternalLink, Save, Loader2,
  Eye, EyeOff, GripVertical, ChevronDown, ChevronRight, Wand2, Layout,
  PanelLeft, CheckCircle2, ArrowLeft, Copy, Globe, Crown, Lock, BarChart3,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { BlockEditor } from "@/components/creator-site/blocks/BlockEditor";
import type { ContentBlock } from "@/components/creator-site/blocks/BlockTypes";
import { SiteSection } from "@/components/settings/CreatorSiteSectionEditor";
import { TEMPLATES, isTemplateAccessible } from "@/components/creator-site/templateConfig";
import { hasProAccess, hasCreatorProAccess } from "@/lib/subscriptionConfig";
import { SiteAnalyticsDashboard } from "@/components/creator-site/SiteAnalyticsDashboard";
import { AIWebsiteGenerator } from "@/components/creator-site/AIWebsiteGenerator";
import { SiteSetupWizard } from "@/components/creator-site/SiteSetupWizard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type EditorTab = 'content' | 'sections' | 'blocks' | 'template';
type MainView = 'editor' | 'dashboard' | 'settings' | 'analytics';

const WebsiteBuilder = () => {
  const { user, subscriptionInfo } = useAuth();
  const isPro = hasProAccess(subscriptionInfo.tier as any);
  const isCreatorPro = hasCreatorProAccess(subscriptionInfo.tier as any);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteEnabled, setSiteEnabled] = useState(false);
  const [device, setDevice] = useState<string>('desktop');
  const [previewKey, setPreviewKey] = useState(0);
  const [activeTab, setActiveTab] = useState<EditorTab>('template');
  const [mainView, setMainView] = useState<MainView>('editor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copied, setCopied] = useState(false);

  // Data state
  const [template, setTemplate] = useState('bold-electric');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [sections, setSections] = useState<SiteSection[]>(DEFAULT_SECTIONS);
  const [customBlocks, setCustomBlocks] = useState<ContentBlock[]>([]);
  const [username, setUsername] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Dialogs
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // For live preview iframe, use current origin so it works in both preview and production
  const previewOrigin = typeof window !== 'undefined' ? window.location.origin : APP_URL;
  const previewUrl = username
    ? `${previewOrigin}/${username}`
    : user ? `${previewOrigin}/site/${user.id}` : '';
  // For sharing/display, always use the canonical production URL
  const siteUrl = username
    ? `${APP_URL}/${username}`
    : user ? `${APP_URL}/site/${user.id}` : '';

  const loadData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('site_enabled, site_template, site_sections, site_headline, site_bio, site_custom_blocks, username')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setSiteEnabled(data.site_enabled || false);
      setTemplate(data.site_template || 'bold-electric');
      setSections((data.site_sections as any)?.length ? (data.site_sections as any) : DEFAULT_SECTIONS);
      setHeadline(data.site_headline || '');
      setBio(data.site_bio || '');
      setCustomBlocks((data.site_custom_blocks as any) || []);
      setUsername((data as any).username || '');
      setUsernameInput((data as any).username || '');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Redirect if not Pro
  useEffect(() => {
    if (!loading && !isPro) {
      navigate('/subscription');
    }
  }, [loading, isPro, navigate]);

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
    }
    setSaving(false);
  };

  const handleToggleSite = async (enabled: boolean) => {
    if (!user) return;
    if (enabled && !siteEnabled) {
      setShowWizard(true);
      return;
    }
    setSaving(true);
    await supabase.from('profiles').update({ site_enabled: enabled }).eq('user_id', user.id);
    setSiteEnabled(enabled);
    setSaving(false);
    toast({ title: enabled ? "Site enabled!" : "Site disabled" });
  };

  const handleSaveUsername = async () => {
    if (!user || !usernameInput) return;
    setSavingUsername(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: usernameInput.toLowerCase() })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: "Username unavailable", description: "Try a different username", variant: "destructive" });
    } else {
      setUsername(usernameInput.toLowerCase());
      toast({ title: "Username saved!" });
    }
    setSavingUsername(false);
  };

  const handleTemplateChange = (templateId: string) => {
    setTemplate(templateId);
    markChanged();
    // Auto-save template for instant preview refresh
    if (user) {
      supabase.from('profiles').update({ site_template: templateId }).eq('user_id', user.id).then(() => {
        setPreviewKey(k => k + 1);
      });
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  // Section drag
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

  const currentDevice = DEVICES.find(d => d.id === device) || DEVICES[0];

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!siteEnabled) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-6 text-center gap-6">
        <Globe className="h-16 w-16 text-primary" />
        <div>
          <h1 className="text-2xl font-bold mb-2">Website Builder</h1>
          <p className="text-muted-foreground max-w-md">
            Transform your profile into a professional standalone website powered by your real data.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowWizard(true)} size="lg">
            <Wand2 className="h-5 w-5 mr-2" />
            Create My Website
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <SiteSetupWizard
          open={showWizard}
          onOpenChange={setShowWizard}
          onComplete={() => { loadData(); setShowWizard(false); }}
        />
      </div>
    );
  }

  const tabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'template', label: 'Templates', icon: <Layout className="h-4 w-4" /> },
    { id: 'content', label: 'Content', icon: <Settings2 className="h-4 w-4" /> },
    { id: 'sections', label: 'Sections', icon: <GripVertical className="h-4 w-4" /> },
    { id: 'blocks', label: 'Blocks', icon: <PanelLeft className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-3 bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Back</span>
          </Button>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <span className="text-sm font-semibold hidden md:inline">Website Builder</span>
          {hasChanges && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
              Unsaved
            </Badge>
          )}
        </div>

        {/* Main view switcher - center on desktop */}
        <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {([
            { id: 'editor', label: 'Editor', icon: Layout },
            { id: 'settings', label: 'Settings', icon: Settings2 },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ] as { id: MainView; label: string; icon: any }[]).map(v => (
            <Button
              key={v.id}
              variant={mainView === v.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setMainView(v.id)}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
            </Button>
          ))}
        </div>

        {/* Actions - right */}
        <div className="flex items-center gap-2">
          {mainView === 'editor' && (
            <>
              {/* Device switcher */}
              <div className="hidden sm:flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
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
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setPreviewKey(k => k + 1)} title="Refresh">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="View live site">
            <a href={siteUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 hidden sm:flex" onClick={() => setShowAIGenerator(true)}>
            <Wand2 className="h-3.5 w-3.5" />
            Smart Build
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
      </div>

      {/* Main content */}
      {mainView === 'editor' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className={cn(
            "border-r border-border bg-background flex flex-col transition-all duration-200 shrink-0",
            sidebarCollapsed ? "w-12" : "w-80 lg:w-96"
          )}>
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
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="flex items-center justify-center w-full py-3 hover:bg-muted transition-colors"
              >
                <PanelLeft className="h-4 w-4 rotate-180" />
              </button>
            )}

            {!sidebarCollapsed && (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Template tab */}
                  {activeTab === 'template' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Choose a template — preview updates instantly.</p>
                      {TEMPLATES.map(t => {
                        const accessible = isTemplateAccessible(t.id, isCreatorPro);
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              if (!accessible) {
                                toast({ title: "Creator+ Template", description: `"${t.name}" requires Creator+.` });
                                return;
                              }
                              handleTemplateChange(t.id);
                            }}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border w-full text-left transition-all",
                              template === t.id ? "border-primary ring-1 ring-primary bg-primary/5" : accessible ? "border-border hover:border-muted-foreground/30" : "border-border opacity-60 hover:opacity-80"
                            )}
                          >
                            <div className={cn("w-10 h-10 rounded-md border border-border flex items-center justify-center shrink-0", t.preview)}>
                              <div className={cn("w-3 h-3 rounded-full", t.accent)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium">{t.name}</span>
                                {!accessible && <Lock className="h-3 w-3 text-muted-foreground" />}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                              {!accessible && <p className="text-[10px] text-primary">Creator+</p>}
                            </div>
                            {template === t.id && accessible && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            {!accessible && <Crown className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

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
                              onClick={() => { setSections(prev => prev.map(s => s.id === section.id ? { ...s, visible: !s.visible } : s)); markChanged(); }}
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
                                onChange={(e) => { setSections(prev => prev.map(s => s.id === section.id ? { ...s, customTitle: e.target.value } : s)); markChanged(); }}
                                className="text-xs h-8"
                              />
                              {section.id !== 'hero' && (
                                <Textarea
                                  placeholder="Custom subtitle..."
                                  value={section.customContent || ""}
                                  onChange={(e) => { setSections(prev => prev.map(s => s.id === section.id ? { ...s, customContent: e.target.value } : s)); markChanged(); }}
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
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Preview area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
            {/* Browser chrome */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-1.5 border border-border max-w-2xl mx-auto">
                <div className="flex gap-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <code className="text-[11px] text-muted-foreground truncate flex-1">{siteUrl}</code>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={copyUrl}>
                  {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <div className="flex-1 relative overflow-auto px-4 pb-4">
              <div className="flex items-start justify-center min-h-full">
                <div
                  className="bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-300"
                  style={{ 
                    width: currentDevice.width, 
                    maxWidth: '100%',
                    height: 'calc(100vh - 140px)',
                  }}
                >
                  <iframe
                    key={previewKey}
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="Site Preview"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings view */}
      {mainView === 'settings' && (
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h2 className="text-xl font-bold">Site Settings</h2>

            {/* URL */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Your Site URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded truncate">{siteUrl}</code>
                <Button variant="outline" size="sm" onClick={copyUrl}>
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Username / Vanity URL</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="your-username"
                    className="text-sm pl-[105px]"
                    maxLength={30}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    kretopia.com/
                  </span>
                </div>
                {usernameInput !== username && (
                  <Button size="sm" onClick={handleSaveUsername} disabled={savingUsername || usernameInput.length < 3}>
                    {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                )}
              </div>
            </div>

            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Site Status</p>
                <p className="text-xs text-muted-foreground">{siteEnabled ? "Your site is live and visible" : "Your site is offline"}</p>
              </div>
              <Button
                variant={siteEnabled ? "destructive" : "default"}
                size="sm"
                onClick={() => handleToggleSite(!siteEnabled)}
              >
                {siteEnabled ? "Disable" : "Enable"}
              </Button>
            </div>

            {/* Custom Domain */}
            {isCreatorPro && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-medium">Custom Domain Redirect</p>
                  <Badge variant="secondary" className="text-[10px]">Creator+</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Point your own domain to your Kretopia creator site using a URL redirect.
                </p>
                <div className="bg-background rounded-md p-3 border space-y-2">
                  <p className="text-[11px] font-semibold">Setup: Add a URL Redirect/Forward in your domain registrar pointing to:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] bg-muted px-2 py-1 rounded font-mono flex-1 truncate">{siteUrl}</code>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={copyUrl}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">Choose "Permanent (301)" for best SEO.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics view */}
      {mainView === 'analytics' && (
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
            <SiteAnalyticsDashboard />
          </div>
        </div>
      )}

      {/* Mobile bottom bar */}
      <div className="md:hidden border-t border-border bg-background p-2 flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setMainView(mainView === 'editor' ? 'settings' : 'editor')}>
          {mainView === 'editor' ? <Settings2 className="h-3.5 w-3.5 mr-1" /> : <Layout className="h-3.5 w-3.5 mr-1" />}
          {mainView === 'editor' ? 'Settings' : 'Editor'}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setShowAIGenerator(true)}>
          <Wand2 className="h-3.5 w-3.5 mr-1" /> AI
        </Button>
        <Button size="sm" className="flex-1 text-xs" onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Save
        </Button>
      </div>

      {/* Dialogs */}
      <AIWebsiteGenerator
        open={showAIGenerator}
        onOpenChange={setShowAIGenerator}
        onComplete={() => { loadData(); setShowAIGenerator(false); }}
      />
      <SiteSetupWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={() => { loadData(); setShowWizard(false); }}
      />
    </div>
  );
};

export default WebsiteBuilder;
