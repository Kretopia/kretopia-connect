import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ThumbsUp } from "lucide-react";

interface SkillWithEndorsements {
  skill: string;
  category: string;
  level: number;
  endorsementCount: number;
}

export default function EndorseSkill() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestData, setRequestData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [skills, setSkills] = useState<SkillWithEndorsements[]>([]);
  const [endorsedSkills, setEndorsedSkills] = useState<Set<string>>(new Set());
  const [endorserName, setEndorserName] = useState("");
  const [endorserEmail, setEndorserEmail] = useState("");
  const [showNameForm, setShowNameForm] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetchRequestData();
  }, [token]);

  const fetchRequestData = async () => {
    try {
      const { data, error } = await supabase.rpc("get_endorsement_request_by_token", {
        token_param: token,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        setLoading(false);
        return;
      }

      const request = data[0];
      setRequestData(request);

      // Fetch profile data with professional and passion skills
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, professional_skills, passion_skills")
        .eq("user_id", request.profile_id)
        .single();

      setProfileData(profile);

      // Combine professional and passion skills
      const allSkills: SkillWithEndorsements[] = [];
      
      if (profile?.professional_skills) {
        (profile.professional_skills as any[]).forEach((s: any) => {
          allSkills.push({
            skill: s.skill,
            category: s.category,
            level: s.level,
            endorsementCount: 0
          });
        });
      }
      
      if (profile?.passion_skills) {
        (profile.passion_skills as any[]).forEach((s: any) => {
          allSkills.push({
            skill: s.skill,
            category: s.category,
            level: s.level,
            endorsementCount: 0
          });
        });
      }

      // Fetch endorsement counts for each skill
      const { data: endorsementCounts } = await supabase
        .from("skill_endorsement_counts")
        .select("skill_name, endorsement_count")
        .eq("profile_id", request.profile_id);

      if (endorsementCounts) {
        endorsementCounts.forEach((ec: any) => {
          const skill = allSkills.find(s => s.skill === ec.skill_name);
          if (skill) {
            skill.endorsementCount = ec.endorsement_count;
          }
        });
      }

      setSkills(allSkills);
    } catch (error: any) {
      console.error("Error fetching endorsement request:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!endorserName.trim() || !endorserEmail.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and email",
        variant: "destructive",
      });
      return;
    }
    setShowNameForm(false);
  };

  const handleEndorseSkill = async (skillName: string) => {
    if (endorsedSkills.has(skillName)) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("skill_endorsements")
        .insert({
          profile_id: requestData.profile_id,
          request_id: requestData.id,
          skill_name: skillName,
          endorser_name: endorserName,
          endorser_email: endorserEmail,
          proficiency_level: "advanced", // Default level for quick endorsements
        });

      if (error) throw error;

      setEndorsedSkills(new Set([...endorsedSkills, skillName]));
      
      // Update local count
      setSkills(skills.map(s => 
        s.skill === skillName 
          ? { ...s, endorsementCount: s.endorsementCount + 1 }
          : s
      ));

      toast({
        title: "Endorsed!",
        description: `You've endorsed ${skillName}`,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Invalid or expired token - show friendly message
  if (!requestData || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Link Not Found</CardTitle>
            <CardDescription>
              This endorsement link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Want to build your own verified creative profile?
              </p>
            </div>
            <Button 
              onClick={() => navigate("/auth")} 
              variant="gradient" 
              className="w-full"
            >
              Join Kretopia
            </Button>
            <Button 
              onClick={() => navigate("/")} 
              variant="outline" 
              className="w-full"
            >
              Learn More
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showNameForm) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Endorse {profileData?.full_name}'s Skills</CardTitle>
            <CardDescription>
              Please provide your information to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Your Name *</Label>
                <Input
                  id="name"
                  value={endorserName}
                  onChange={(e) => setEndorserName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Your Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={endorserEmail}
                  onChange={(e) => setEndorserEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <Button type="submit" className="w-full" variant="gradient">
                Continue
              </Button>
              
              <div className="pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Are you a creative? Build your own verified profile!
                </p>
                <Button 
                  type="button"
                  onClick={() => navigate("/auth")} 
                  variant="link" 
                  className="text-sm"
                >
                  Join Kretopia →
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allEndorsed = endorsedSkills.size === skills.length && skills.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-20">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">
            Endorse {profileData?.full_name}'s Skills
          </CardTitle>
          <CardDescription>
            Click the + button to endorse skills you've seen them demonstrate
          </CardDescription>
          {requestData?.personal_message && (
            <div className="mt-4 p-3 sm:p-4 bg-muted rounded-lg">
              <p className="text-sm italic">{requestData.personal_message}</p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {skills.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">
                {profileData?.full_name} hasn't added any skills to their profile yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Please let them know they need to add skills in their profile settings before requesting endorsements.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => {
                const isEndorsed = endorsedSkills.has(skill.skill);
                return (
                  <div
                    key={skill.skill}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{skill.skill}</p>
                      <p className="text-sm text-muted-foreground">{skill.category}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {skill.endorsementCount} {skill.endorsementCount === 1 ? 'endorsement' : 'endorsements'}
                      </p>
                    </div>
                    <Button
                      variant={isEndorsed ? "outline" : "gradient"}
                      size="icon"
                      onClick={() => handleEndorseSkill(skill.skill)}
                      disabled={submitting || isEndorsed}
                      className="shrink-0"
                    >
                      <ThumbsUp className={`h-4 w-4 ${isEndorsed ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {allEndorsed && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-green-700 dark:text-green-400">
                Thank you for endorsing all skills!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {profileData?.full_name} will appreciate your support
              </p>
            </div>
          )}

          <div className="pt-4 border-t space-y-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">
                Are you a creative? Build your own verified profile!
              </p>
              <Button 
                onClick={() => navigate("/auth")} 
                variant="gradient" 
                className="w-full"
              >
                Join Kretopia
              </Button>
            </div>
            <Button 
              onClick={() => navigate("/")} 
              variant="outline" 
              className="w-full"
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
