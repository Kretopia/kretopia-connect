import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Users, Briefcase, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Suggestion {
  type: 'skill' | 'connection' | 'opportunity' | 'profile';
  title: string;
  description: string;
  action: string;
  actionUrl: string;
  priority: 'high' | 'medium' | 'low';
}

interface SmartSuggestionsProps {
  userId: string;
  userProfile: any;
}

export const SmartSuggestions = ({ userId, userProfile }: SmartSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    generateSuggestions();
  }, [userId, userProfile]);

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const mySkills = [
        ...(Array.isArray(userProfile.professional_skills) 
          ? userProfile.professional_skills 
          : Object.keys(userProfile.professional_skills || {})),
        ...(Array.isArray(userProfile.passion_skills) 
          ? userProfile.passion_skills 
          : Object.keys(userProfile.passion_skills || {}))
      ];

      // Get user's stats for context
      const { data: connections } = await supabase
        .from('connections')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const { data: portfolio } = await supabase
        .from('credits')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Generate 3-5 personalized suggestions for this creator to grow their profile and career:

PROFILE:
- Name: ${userProfile.full_name}
- Role: ${userProfile.role}
- Bio: ${userProfile.bio || 'No bio'}
- Skills: ${mySkills.join(', ')}
- Connections: ${connections?.length || 0}
- Portfolio items: ${portfolio?.length || 0}
- Level: ${userProfile.level || 1}
- XP: ${userProfile.xp || 0}

Create actionable suggestions for:
1. Profile improvements (if incomplete)
2. Skill development (based on role and current skills)
3. Networking opportunities (based on their niche)
4. Content creation (portfolio)
5. Collaboration opportunities

Return ONLY valid JSON array:
[{
  "type": "skill|connection|opportunity|profile",
  "title": "Short title",
  "description": "Brief explanation why this helps",
  "action": "Button text",
  "priority": "high|medium|low"
}]`
            }
          ],
          type: 'suggest'
        }
      });

      if (error) throw error;

      const aiSuggestions = data?.content ? JSON.parse(data.content) : [];
      
      // Map suggestions to include action URLs
      const enrichedSuggestions = aiSuggestions.map((s: any) => ({
        ...s,
        actionUrl: getActionUrl(s.type)
      }));

      setSuggestions(enrichedSuggestions);

    } catch (error: any) {
      console.error('Error generating suggestions:', error);
      // Provide fallback suggestions
      setSuggestions([
        {
          type: 'profile',
          title: 'Complete Your Profile',
          description: 'Profiles with portfolio items get 3x more connections',
          action: 'Add Portfolio',
          actionUrl: '/profile',
          priority: 'high'
        },
        {
          type: 'connection',
          title: 'Grow Your Network',
          description: 'Connect with creators in your industry',
          action: 'Discover Creators',
          actionUrl: '/discover',
          priority: 'medium'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getActionUrl = (type: string): string => {
    switch (type) {
      case 'skill': return '/profile';
      case 'connection': return '/discover';
      case 'opportunity': return '/discover?tab=opportunities';
      case 'profile': return '/profile';
      default: return '/circle';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'skill': return <TrendingUp className="h-4 w-4" />;
      case 'connection': return <Users className="h-4 w-4" />;
      case 'opportunity': return <Briefcase className="h-4 w-4" />;
      case 'profile': return <Sparkles className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-red-500';
      case 'medium': return 'border-l-4 border-l-yellow-500';
      case 'low': return 'border-l-4 border-l-violet-500';
      default: return '';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 animate-pulse text-primary" />
            Smart Suggestions
          </CardTitle>
          <CardDescription>Analyzing your profile...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Suggestions
        </CardTitle>
        <CardDescription>
          Personalized recommendations to grow your career
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`p-4 border rounded-lg hover:bg-accent/50 transition-colors ${getPriorityColor(suggestion.priority)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">{getIcon(suggestion.type)}</div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {suggestion.description}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(suggestion.actionUrl)}
                className="flex-shrink-0"
              >
                {suggestion.action}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          className="w-full mt-2"
          onClick={generateSuggestions}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Refresh Suggestions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
