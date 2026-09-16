import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Loader2, TrendingUp, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIOpportunityInsightsProps {
  opportunityId: string;
  opportunityTitle: string;
  opportunityDescription: string;
  userRole?: string;
  userBio?: string;
}

export const AIOpportunityInsights = ({
  opportunityId,
  opportunityTitle,
  opportunityDescription,
  userRole,
  userBio
}: AIOpportunityInsightsProps) => {
  const [insights, setInsights] = useState<{
    matchScore: number;
    strengths: string[];
    tips: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Analyze how well this creator matches this opportunity and provide application insights.

Creator Profile:
Role: ${userRole || 'Content Creator'}
Bio: ${userBio || 'No bio provided'}

Opportunity:
Title: ${opportunityTitle}
Description: ${opportunityDescription}

Provide:
1. Match score (0-100)
2. 2-3 key strengths that make them a good fit
3. 2-3 actionable tips for their application

Return as JSON:
{
  "matchScore": 75,
  "strengths": ["strength 1", "strength 2"],
  "tips": ["tip 1", "tip 2"]
}`
            }
          ]
        }
      });

      if (error) throw error;

      if (data?.content) {
        let raw = data.content.trim();
        // Strip markdown code fences if present
        if (raw.startsWith('```')) {
          raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        const parsed = JSON.parse(raw);
        setInsights(parsed);
      }
    } catch (error: any) {
      toast({
        title: "Failed to generate insights",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-primary" />
          Application Coach
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!insights ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Get Smart insights on how well you match this opportunity and tips to improve your application.
            </p>
            <Button 
              onClick={generateInsights} 
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Get Insights
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Match Score */}
            <div className="text-center p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
              <div className="text-3xl font-bold text-primary mb-1">{insights.matchScore}%</div>
              <p className="text-sm text-muted-foreground">Match Score</p>
            </div>

            {/* Your Strengths */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Your Strengths
              </div>
              <div className="space-y-1">
                {insights.strengths.map((strength, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className="mt-0.5">✓</Badge>
                    <span className="text-muted-foreground">{strength}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Application Tips */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Application Tips
              </div>
              <div className="space-y-1">
                {insights.tips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <Badge variant="secondary" className="mt-0.5">{idx + 1}</Badge>
                    <span className="text-muted-foreground">{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={() => setInsights(null)} 
              variant="ghost"
              size="sm"
              className="w-full"
            >
              Generate New Insights
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};