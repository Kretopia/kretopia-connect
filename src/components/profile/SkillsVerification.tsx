import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, Share2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Skill {
  name: string;
  endorsements?: number;
  averageLevel?: string;
}

interface SkillsVerificationProps {
  skills: Skill[];
  userId: string;
  onSkillsUpdate?: () => void;
}

export const SkillsVerification = ({ skills, userId, onSkillsUpdate }: SkillsVerificationProps) => {
  const [personalMessage, setPersonalMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [fullName, setFullName] = useState("");
  const { toast } = useToast();

  const handleGenerateLink = async () => {
    setSubmitting(true);
    try {
      // Get user's full name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .single();

      if (profileData) {
        setFullName(profileData.full_name);
      }

      const { data, error } = await supabase
        .from("skill_endorsement_requests")
        .insert({
          profile_id: userId,
          skill_name: "All Skills", // Generic request for all skills
          personal_message: personalMessage || null,
        })
        .select()
        .single();

      if (error) throw error;

      const link = `https://kretopia.com/endorse?token=${data.share_token}`;
      setShareLink(link);
      
      // Auto-copy the full message
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

      onSkillsUpdate?.();
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

  const copyMessage = () => {
    const message = `Hi there,

${personalMessage || "I hope you're doing well! I'm reaching out because your endorsement would mean a lot to me."} 

Would you mind taking a few minutes to endorse my skills? Your validation helps build credibility and trust with future clients.

Simply click the link below:
${shareLink}

Thank you so much!`;

    navigator.clipboard.writeText(message);
    toast({
      title: "Message Copied!",
      description: "Pre-written message with link copied to clipboard",
    });
  };

  const getSkillStats = (skill: Skill) => ({
    endorsements: skill.endorsements || 0,
    level: skill.averageLevel || 'No endorsements yet',
  });

  const getLevelBadge = (level: string) => {
    const levels: Record<string, { variant: any; icon: any }> = {
      expert: { variant: "default", icon: <Star className="h-3 w-3" /> },
      advanced: { variant: "secondary", icon: <Star className="h-3 w-3" /> },
      intermediate: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
      beginner: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
    };

    const config = levels[level.toLowerCase()] || levels.beginner;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {level}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skill Endorsements</CardTitle>
        <CardDescription>
          Request endorsements from clients to validate your skills and proficiency levels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Skills Display */}
        <div className="grid gap-2 sm:gap-3">
          {skills.map((skill) => {
            const stats = getSkillStats(skill);
            return (
              <div
                key={skill.name}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-2"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm sm:text-base">{skill.name}</span>
                    {stats.endorsements > 0 && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                    <span>{stats.endorsements} endorsement{stats.endorsements !== 1 ? 's' : ''}</span>
                    {stats.level !== 'No endorsements yet' && getLevelBadge(stats.level)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Generate Link Section */}
        <div className="pt-4 border-t space-y-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" variant="default">
                <Share2 className="h-4 w-4 mr-2" />
                Request Endorsements
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Generate Endorsement Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="personalMessage">Personal Message (Optional)</Label>
                  <Textarea
                    id="personalMessage"
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                    placeholder="Add a note for your clients..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <Button
                  onClick={handleGenerateLink}
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? "Generating..." : "Generate Link"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {shareLink && (
            <div className="p-3 sm:p-4 bg-accent/10 border border-accent/20 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">Message ready to share!</p>
                  <p className="text-xs text-muted-foreground">
                    The pre-written message with your endorsement link has been copied to your clipboard. 
                    Simply paste it in an email or message to send to your clients or collaborators.
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={copyMessage} 
                variant="outline"
                size="sm"
                className="w-full"
              >
                Copy Message Again
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
