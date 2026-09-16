import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Wand2, Target, Loader2 } from "lucide-react";

interface AIProfileEnhancerProps {
  currentBio?: string;
  currentRole?: string;
  currentSkills?: any[];
  onBioGenerated: (bio: string) => void;
  onSkillsGenerated: (skills: string[]) => void;
}

export const AIProfileEnhancer = ({
  currentBio,
  currentRole,
  currentSkills,
  onBioGenerated,
  onSkillsGenerated
}: AIProfileEnhancerProps) => {
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'bio' | 'skills'>('bio');
  const [bioPrompt, setBioPrompt] = useState('');
  const { toast } = useToast();

  const generateBio = async () => {
    if (!bioPrompt.trim() && !currentRole) {
      toast({
        title: "Need more info",
        description: "Tell us about yourself or set your role first",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Generate a compelling professional bio for a creator profile. 

Current role: ${currentRole || 'Not specified'}
About them: ${bioPrompt || 'Creative professional'}

Create a 2-3 sentence bio that:
- Highlights their expertise and passion
- Shows personality and authenticity
- Mentions collaboration opportunities
- Is engaging but professional

Return ONLY the bio text, nothing else.`
            }
          ]
        }
      });

      if (error) throw error;

      if (data?.content) {
        onBioGenerated(data.content);
        toast({
          title: "Bio generated!",
          description: "Your bio is ready",
        });
        setBioPrompt('');
      }
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateSkills = async () => {
    if (!currentRole && !currentBio) {
      toast({
        title: "Need more info",
        description: "Add your role or bio first for better suggestions",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Suggest 8-10 relevant skills for this creator profile:

Role: ${currentRole || 'Creator'}
Bio: ${currentBio || 'Creative professional'}
Current skills: ${JSON.stringify(currentSkills || [])}

Suggest professional skills that are:
- Specific and industry-relevant
- Mix of technical and soft skills
- Complementary to their role
- Attractive to collaborators

Return as JSON array of strings only: ["skill1", "skill2", ...]`
            }
          ],
          type: 'suggest'
        }
      });

      if (error) throw error;

      if (data?.content) {
        const skills = JSON.parse(data.content);
        onSkillsGenerated(skills);
        toast({
          title: "Skills suggested!",
          description: "Review and add the ones that fit",
        });
      }
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Profile Enhancer
        </CardTitle>
        <CardDescription>
          Let Thrive help you create a standout profile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'bio' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('bio')}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Bio
          </Button>
          <Button
            variant={activeTab === 'skills' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('skills')}
          >
            <Target className="h-4 w-4 mr-2" />
            Suggest Skills
          </Button>
        </div>

        {activeTab === 'bio' && (
          <div className="space-y-3">
            <Textarea
              placeholder="Tell us about yourself... (your experience, passions, what you're looking for)"
              value={bioPrompt}
              onChange={(e) => setBioPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button 
              onClick={generateBio} 
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Bio
                </>
              )}
            </Button>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Based on your role and bio, we'll suggest relevant skills to highlight
            </p>
            <Button 
              onClick={generateSkills} 
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  Suggest Skills
                </>
              )}
            </Button>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-background/50 rounded-lg border">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Smart suggestions is a starting point. Edit and personalize it to make it truly yours!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
