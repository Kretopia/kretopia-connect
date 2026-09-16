import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Star, Sparkles, Briefcase, ThumbsUp, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Skill {
  skill: string;
  level: number;
  category: string;
  /** Absent/"confirmed" = user-added or user-confirmed. "ai_suggested" =
   * drafted by Kreto (onboarding autofill, Passport builder) and not yet
   * reviewed — shown separately until the user confirms or removes it. */
  source?: "confirmed" | "ai_suggested";
}

interface SkillsSectionProps {
  professionalSkills: Skill[];
  passionSkills: Skill[];
  jobTitle?: string;
  industry?: string;
  isOwnProfile: boolean;
  userId: string;
  onRefresh: () => void;
}

// Predefined skills by category for easy selection
const SKILL_OPTIONS: Record<string, string[]> = {
  "Photography & Visual": [
    "Portrait Photography", "Fashion Photography", "Product Photography", "Event Photography",
    "Landscape Photography", "Food Photography", "Architectural Photography", "Street Photography",
    "Concert Photography", "Documentary Photography", "Photo Retouching", "Studio Lighting"
  ],
  "Video & Film": [
    "Videography", "Film Production", "Cinematography", "Video Editing",
    "Color Grading", "Documentary Filmmaking", "Commercial Production", "Music Videos",
    "Screenwriting", "Film Directing", "Producing", "Stunt Coordination",
    "Drone Videography", "Live Streaming", "Short Films"
  ],
  "Audio & Music": [
    "Music Production", "Audio Engineering", "Sound Design", "Mixing & Mastering",
    "Composition", "Beat Making", "Podcast Production", "Voiceover",
    "Singing", "Rapping", "Songwriting", "DJing",
    "Session Recording", "Foley", "Audio Post-Production", "Music Supervision",
    "Soca Production", "Calypso", "Steelpan Arrangement"
  ],
  "Performance & Movement": [
    "Dance", "Choreography", "Acting", "Voice Acting",
    "Instrument Performance", "Live Performance", "Stage Direction", "Improvisation",
    "Modeling", "Stunt Performance", "Stand-up Comedy", "Theatre"
  ],
  "Design": [
    "Graphic Design", "UI/UX Design", "Brand Design", "Logo Design",
    "Illustration", "Typography", "Print Design", "Packaging Design",
    "Environmental Design", "Signage Design", "Infographics", "Tattoo Design"
  ],
  "Fashion & Beauty": [
    "Fashion Design", "Styling", "Makeup Artistry", "Hair Styling",
    "Costume Design", "Wardrobe Design", "Jewelry Design", "Textile Design",
    "Pattern Making", "Fashion Illustration", "Accessory Design",
    "Carnival / Mas Design", "Nail Art", "Special FX Makeup"
  ],
  "Motion & Animation": [
    "Motion Graphics", "2D Animation", "3D Animation", "VFX",
    "After Effects", "Character Animation", "Stop Motion", "CGI",
    "Title Design", "Explainer Videos"
  ],
  "Content & Social": [
    "Content Creation", "Social Media Management", "Copywriting", "Influencer Marketing",
    "YouTube Content", "TikTok Content", "Instagram Strategy", "Community Management",
    "Blogging", "Newsletter Writing", "SEO Content", "Podcast Hosting"
  ],
  "Styling & Production": [
    "Set Design", "Prop Design", "Event Production",
    "Stage Management", "Lighting Design", "Sound Engineering (Live)",
    "Festival Production", "Carnival Production"
  ],
  "Creative Direction": [
    "Creative Direction", "Art Direction", "Brand Strategy", "Campaign Development",
    "Project Management", "Team Leadership", "A&R", "Music Supervision",
    "Talent Management"
  ],
  "Writing & Journalism": [
    "Scriptwriting", "Ghostwriting", "Journalism", "Technical Writing",
    "Grant Writing", "Press Releases", "Book Writing", "Editing"
  ],
  "Technical": [
    "Web Development", "Mobile Development", "3D Modeling", "Game Design",
    "Virtual Reality", "Augmented Reality", "Technical Direction", "Drones",
    "AI Tools", "No-Code Development"
  ]
};

export const SkillsSection = ({ 
  professionalSkills = [], 
  passionSkills = [], 
  jobTitle = "",
  industry = "",
  isOwnProfile,
  userId,
  onRefresh 
}: SkillsSectionProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editJobTitle, setEditJobTitle] = useState(jobTitle);
  const [editIndustry, setEditIndustry] = useState(industry);
  const [editProfessional, setEditProfessional] = useState<Skill[]>(professionalSkills);
  const [editPassion, setEditPassion] = useState<Skill[]>(passionSkills);
  const [selectedCategory, setSelectedCategory] = useState<string>(Object.keys(SKILL_OPTIONS)[0]);
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<number>(3);
  const [skillType, setSkillType] = useState<"professional" | "passion">("professional");
  const [endorsementCounts, setEndorsementCounts] = useState<Record<string, number>>({});
  const [endorsementDialogOpen, setEndorsementDialogOpen] = useState(false);
  const [personalMessage, setPersonalMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [editingSkillIndex, setEditingSkillIndex] = useState<{type: 'professional' | 'passion', index: number} | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchEndorsementCounts();
    }
  }, [userId]);

  // Real-time subscription for endorsement updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('skill-endorsements-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'skill_endorsements',
          filter: `profile_id=eq.${userId}`
        },
        () => {
          // Refetch endorsement counts when a new endorsement is added
          fetchEndorsementCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchEndorsementCounts = async () => {
    const { data } = await supabase
      .from("skill_endorsement_counts")
      .select("skill_name, endorsement_count")
      .eq("profile_id", userId);
    
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((item: any) => {
        counts[item.skill_name] = item.endorsement_count;
      });
      setEndorsementCounts(counts);
    }
  };

  const addSkill = () => {
    if (!selectedSkill.trim()) {
      toast({ title: "Please select a skill", variant: "destructive" });
      return;
    }
    
    const newSkillObj = { skill: selectedSkill, level: selectedLevel, category: selectedCategory };
    
    if (skillType === "professional") {
      if (editProfessional.some(s => s.skill === selectedSkill)) {
        toast({ title: "Skill already added", variant: "destructive" });
        return;
      }
      setEditProfessional([...editProfessional, newSkillObj]);
    } else {
      if (editPassion.some(s => s.skill === selectedSkill)) {
        toast({ title: "Skill already added", variant: "destructive" });
        return;
      }
      setEditPassion([...editPassion, newSkillObj]);
    }
    
    setSelectedSkill("");
    setSelectedLevel(3);
  };

  const removeSkill = (type: string, index: number) => {
    if (type === "professional") {
      setEditProfessional(editProfessional.filter((_, i) => i !== index));
    } else {
      setEditPassion(editPassion.filter((_, i) => i !== index));
    }
  };

  const updateSkillLevel = (type: 'professional' | 'passion', index: number, newLevel: number) => {
    if (type === "professional") {
      const updated = [...editProfessional];
      updated[index] = { ...updated[index], level: newLevel };
      setEditProfessional(updated);
    } else {
      const updated = [...editPassion];
      updated[index] = { ...updated[index], level: newLevel };
      setEditPassion(updated);
    }
    setEditingSkillIndex(null);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        job_title: editJobTitle,
        industry: editIndustry,
        professional_skills: editProfessional as any,
        passion_skills: editPassion as any,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update skills", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Skills updated successfully" });
      setIsEditOpen(false);
      onRefresh();
    }
  };

  // Confirm or remove a single Kreto-suggested skill directly from the main
  // view — no need to open the full edit dialog just to triage a suggestion.
  const respondToSuggestion = async (type: "professional" | "passion", skillName: string, action: "confirm" | "remove") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const source = type === "professional" ? professionalSkills : passionSkills;
    const updated = action === "remove"
      ? source.filter((s) => s.skill !== skillName)
      : source.map((s) => (s.skill === skillName ? { ...s, source: "confirmed" as const } : s));
    const column = type === "professional" ? "professional_skills" : "passion_skills";
    const { error } = await supabase.from('profiles').update({ [column]: updated as any }).eq('user_id', user.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update skill", variant: "destructive" });
    } else {
      onRefresh();
    }
  };

  const handleGenerateEndorsementLink = async () => {
    setSubmitting(true);
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .single();

      const { data, error } = await supabase
        .from("skill_endorsement_requests")
        .insert({
          profile_id: userId,
          skill_name: "All Skills",
          personal_message: personalMessage || null,
        })
        .select()
        .single();

      if (error) throw error;

      const link = `https://www.kretopia.com/endorse?token=${data.share_token}`;
      setShareLink(link);
      
      const message = `Hi there,

${personalMessage || "I hope you're doing well! I'm reaching out because your endorsement would mean a lot to me."} 

Would you mind taking a few minutes to endorse my skills? Your validation helps build credibility and trust with future clients.

Simply click the link below:
${link}

Thank you so much!`;

      await navigator.clipboard.writeText(message);

      toast({
        title: "Message Copied!",
        description: "Pre-written message with link copied to clipboard - ready to share!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const SkillBadge = ({ skill, type }: { skill: Skill; type: "professional" | "passion" }) => {
    const endorsements = endorsementCounts[skill.skill] || 0;
    const isSuggested = skill.source === "ai_suggested";
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-2",
        isSuggested ? "border-dashed border-primary/40 bg-primary/5" : "border-border bg-card",
      )}>
        <div className="flex-1">
          <p className="font-medium text-sm">{skill.skill}</p>
          <p className="text-xs text-muted-foreground">{skill.category}</p>
          {endorsements > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <ThumbsUp className="h-3 w-3 text-primary" />
              <span className="text-xs text-muted-foreground">
                {endorsements} {endorsements === 1 ? 'endorsement' : 'endorsements'}
              </span>
            </div>
          )}
          {isSuggested && isOwnProfile && (
            <div className="flex items-center gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => respondToSuggestion(type, skill.skill, "confirm")}
                className="text-[11px] font-semibold text-white hover:text-[#FF2DA1] hover:underline transition-colors"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => respondToSuggestion(type, skill.skill, "remove")}
                className="text-[11px] font-semibold text-muted-foreground hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-3 w-3 ${i < skill.level ? 'fill-primary text-primary' : 'text-muted'}`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Skills & Expertise</h3>
        {isOwnProfile && (
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Edit Skills
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Manage Your Skills</DialogTitle>
                <DialogDescription>Add and organize your professional and passion skills</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input
                      value={editJobTitle}
                      onChange={(e) => setEditJobTitle(e.target.value)}
                      placeholder="e.g., Creative Director, Photographer, Music Producer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input
                      value={editIndustry}
                      onChange={(e) => setEditIndustry(e.target.value)}
                      placeholder="e.g., Film & Video, Music, Design, Marketing"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Professional Skills
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="grid gap-3">
                      <Select value={skillType} onValueChange={(v: "professional" | "passion") => setSkillType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional Skill</SelectItem>
                          <SelectItem value="passion">Passion / Hobby</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(SKILL_OPTIONS).map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select skill" />
                        </SelectTrigger>
                        <SelectContent>
                          {SKILL_OPTIONS[selectedCategory]?.map(skill => (
                            <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select value={String(selectedLevel)} onValueChange={(v) => setSelectedLevel(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Beginner</SelectItem>
                          <SelectItem value="2">Intermediate</SelectItem>
                          <SelectItem value="3">Proficient</SelectItem>
                          <SelectItem value="4">Advanced</SelectItem>
                          <SelectItem value="5">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button onClick={addSkill} className="w-full" variant="gradient" size="sm">
                        <Plus className="h-4 w-4 mr-2" /> Add {skillType === "professional" ? "Professional" : "Passion"} Skill
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {editProfessional.map((skill, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent/5 transition-colors">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{skill.skill}</p>
                            <p className="text-xs text-muted-foreground">{skill.category}</p>
                          </div>
                          {editingSkillIndex?.type === 'professional' && editingSkillIndex?.index === idx ? (
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <Button
                                  key={level}
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0"
                                  onClick={() => updateSkillLevel('professional', idx, level)}
                                >
                                  <Star className={`h-3 w-3 ${level <= skill.level ? 'fill-primary text-primary' : 'text-muted'}`} />
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <div 
                              className="flex gap-0.5 cursor-pointer hover:opacity-70 transition-opacity"
                              onClick={() => setEditingSkillIndex({ type: 'professional', index: idx })}
                              title="Click to edit skill level"
                            >
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`h-3 w-3 ${i < skill.level ? 'fill-primary text-primary' : 'text-muted'}`} />
                              ))}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeSkill("professional", idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-semibold flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-secondary" />
                    Passion Skills Added
                  </h4>
                  <div className="space-y-2">
                    {editPassion.map((skill, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent/5 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{skill.skill}</p>
                          <p className="text-xs text-muted-foreground">{skill.category}</p>
                        </div>
                        {editingSkillIndex?.type === 'passion' && editingSkillIndex?.index === idx ? (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <Button
                                key={level}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0"
                                onClick={() => updateSkillLevel('passion', idx, level)}
                              >
                                <Star className={`h-3 w-3 ${level <= skill.level ? 'fill-secondary text-secondary' : 'text-muted'}`} />
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <div 
                            className="flex gap-0.5 cursor-pointer hover:opacity-70 transition-opacity"
                            onClick={() => setEditingSkillIndex({ type: 'passion', index: idx })}
                            title="Click to edit skill level"
                          >
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`h-3 w-3 ${i < skill.level ? 'fill-secondary text-secondary' : 'text-muted'}`} />
                            ))}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeSkill("passion", idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {editPassion.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No passion skills added yet</p>
                    )}
                  </div>
                </div>

                <Button onClick={handleSave} className="w-full" variant="gradient">
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(jobTitle || industry) && (
        <div className="rounded-2xl border border-border bg-card p-4">
          {jobTitle && <p className="font-semibold text-lg">{jobTitle}</p>}
          {industry && <p className="text-sm text-muted-foreground">{industry}</p>}
        </div>
      )}

      {professionalSkills.length > 0 && (() => {
        const suggested = professionalSkills.filter((s) => s.source === "ai_suggested");
        const confirmed = professionalSkills.filter((s) => s.source !== "ai_suggested");
        return (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-primary" />
              Professional Skills
            </h4>
            {suggested.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Suggested by Kreto — review these</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggested.map((skill) => (
                    <SkillBadge key={skill.skill} skill={skill} type="professional" />
                  ))}
                </div>
              </div>
            )}
            {confirmed.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {confirmed.map((skill) => (
                  <SkillBadge key={skill.skill} skill={skill} type="professional" />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {passionSkills.length > 0 && (() => {
        const suggested = passionSkills.filter((s) => s.source === "ai_suggested");
        const confirmed = passionSkills.filter((s) => s.source !== "ai_suggested");
        return (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-secondary" />
              Passion Projects & Hobbies
            </h4>
            {suggested.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Suggested by Kreto — review these</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggested.map((skill) => (
                    <SkillBadge key={skill.skill} skill={skill} type="passion" />
                  ))}
                </div>
              </div>
            )}
            {confirmed.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {confirmed.map((skill) => (
                  <SkillBadge key={skill.skill} skill={skill} type="passion" />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {professionalSkills.length === 0 && passionSkills.length === 0 && !isOwnProfile && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Star className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No skills added yet</p>
        </div>
      )}

      {/* Request Endorsements Button */}
      {isOwnProfile && (professionalSkills.length > 0 || passionSkills.length > 0) && (
        <div className="pt-4 border-t border-border">
          <Dialog open={endorsementDialogOpen} onOpenChange={setEndorsementDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" className="w-full" size="lg">
                <Share2 className="h-4 w-4 mr-2" />
                Request Endorsements
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Request Skill Endorsements</DialogTitle>
                <DialogDescription>
                  Create a shareable link to request endorsements from clients and colleagues
                </DialogDescription>
              </DialogHeader>
              
              {!shareLink ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="message">Personal Message (Optional)</Label>
                    <Textarea
                      id="message"
                      placeholder="Add a personal touch to your endorsement request..."
                      value={personalMessage}
                      onChange={(e) => setPersonalMessage(e.target.value)}
                      rows={4}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleGenerateEndorsementLink} 
                    disabled={submitting}
                    variant="gradient"
                    className="w-full"
                  >
                    {submitting ? "Generating..." : "Generate Link"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                      ✓ Message copied to clipboard!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Paste and send to your clients or colleagues
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setEndorsementDialogOpen(false);
                      setShareLink("");
                      setPersonalMessage("");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Done
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};
