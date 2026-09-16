import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical, Eye, EyeOff, Save, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { BlockEditor } from "@/components/creator-site/blocks/BlockEditor";
import type { ContentBlock } from "@/components/creator-site/blocks/BlockTypes";

export interface SiteSection {
  id: string;
  label: string;
  visible: boolean;
  customTitle?: string;
  customContent?: string;
}

// Re-export for backward compat
export type { ContentBlock as CustomBlock };

const DEFAULT_SECTIONS: SiteSection[] = [
  { id: "hero", label: "Hero", visible: true },
  { id: "services", label: "Services", visible: true },
  { id: "credits", label: "Work & Credits", visible: true },
  { id: "testimonials", label: "Testimonials", visible: true },
  { id: "contact", label: "Contact", visible: true },
];

interface Props {
  initialSections?: SiteSection[];
  initialHeadline?: string;
  initialBio?: string;
  initialCustomBlocks?: ContentBlock[];
}

export const CreatorSiteSectionEditor = ({ initialSections, initialHeadline, initialBio, initialCustomBlocks }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sections, setSections] = useState<SiteSection[]>(initialSections?.length ? initialSections : DEFAULT_SECTIONS);
  const [headline, setHeadline] = useState(initialHeadline || "");
  const [bio, setBio] = useState(initialBio || "");
  const [customBlocks, setCustomBlocks] = useState<ContentBlock[]>(initialCustomBlocks || []);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  const updateSectionTitle = (id: string, customTitle: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, customTitle } : s));
  };

  const updateSectionContent = (id: string, customContent: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, customContent } : s));
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...sections];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setSections(updated);
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        site_sections: sections as any,
        site_headline: headline || null,
        site_bio: bio || null,
        site_custom_blocks: customBlocks as any,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      toast({ title: "Site customizations saved!" });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Customize Your Site</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Custom headline */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Custom Headline</Label>
          <Input
            placeholder="e.g. Award-Winning Director & Visual Storyteller"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">Overrides your role/title on your site. Leave blank to use your profile role.</p>
        </div>

        {/* Custom bio */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Site Bio</Label>
          <Textarea
            placeholder="Write a custom bio for your site visitors..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground">A custom bio just for your site. Leave blank to use your profile bio.</p>
        </div>

        {/* Section order with inline editing */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Section Order & Visibility</Label>
          <p className="text-xs text-muted-foreground mb-2">Drag to reorder. Click to expand and edit. Toggle to show/hide.</p>
          <div className="space-y-1">
            {sections.map((section, index) => (
              <div key={section.id}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                    dragIndex === index ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:bg-muted/50'
                  } ${!section.visible ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <button
                    onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                    className="flex items-center gap-1 flex-1 text-left"
                  >
                    {expandedSection === section.id ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{section.customTitle || section.label}</span>
                  </button>
                  <button onClick={() => toggleSection(section.id)} className="p-1 rounded hover:bg-muted">
                    {section.visible ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>

                {expandedSection === section.id && (
                  <div className="ml-8 mr-2 mt-1 mb-2 p-3 rounded-lg bg-muted/30 border border-border space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Section Title Override</Label>
                      <Input
                        placeholder={section.label}
                        value={section.customTitle || ""}
                        onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                    {section.id !== 'hero' && (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Custom Subtitle / Description</Label>
                        <Textarea
                          placeholder="Add a custom subtitle for this section..."
                          value={section.customContent || ""}
                          onChange={(e) => updateSectionContent(section.id, e.target.value)}
                          rows={2}
                          className="text-xs resize-none"
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {section.id === 'credits' && "Your verified credits are pulled automatically from your profile."}
                      {section.id === 'services' && "Services are pulled automatically from your Work With Me listings."}
                      {section.id === 'testimonials' && "Testimonials come from your endorsements and client reviews."}
                      {section.id === 'contact' && "Contact section uses your profile social links and booking URL."}
                      {section.id === 'hero' && "Hero uses your headline, bio, avatar, and cover image from above."}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Block Editor */}
        <BlockEditor blocks={customBlocks} onChange={setCustomBlocks} />

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
};
