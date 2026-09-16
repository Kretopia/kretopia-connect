import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Briefcase, Users, Sparkles, MapPin, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ConnectionInsightCardProps {
  profile: any;
  insights: {
    matchScore?: number;
    mutualConnections?: number;
    reasons: string[];
    conversationStarters?: string[];
  };
  onConnect: (profile: any) => void;
  onMessage?: (profile: any) => void;
}

export const ConnectionInsightCard = ({
  profile,
  insights,
  onConnect,
  onMessage
}: ConnectionInsightCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20">
      <div className="flex items-start gap-4 mb-4">
        <Avatar 
          className="h-16 w-16 cursor-pointer ring-2 ring-primary/10" 
          onClick={() => navigate(`/profile/${profile.user_id}`)}
        >
          <AvatarImage src={profile.avatar_url || ''} />
          <AvatarFallback className="text-lg">{profile.full_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 
                className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors truncate"
                onClick={() => navigate(`/profile/${profile.user_id}`)}
              >
                {profile.full_name}
              </h3>
              <p className="text-sm text-muted-foreground">{profile.role}</p>
            </div>
            {insights.matchScore && (
              <Badge className="bg-gradient-to-r from-primary to-accent text-white gap-1 shrink-0">
                <Sparkles className="h-3 w-3" />
                {insights.matchScore}% Match
              </Badge>
            )}
          </div>
          {profile.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {profile.location}
            </p>
          )}
        </div>
      </div>

      {/* Connection Insights */}
      <div className="space-y-3 mb-4">
        {insights.mutualConnections && insights.mutualConnections > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              {insights.mutualConnections} mutual connection{insights.mutualConnections !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Reasons to Connect */}
        {insights.reasons.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Why Connect
            </p>
            <div className="space-y-1.5">
              {insights.reasons.slice(0, 3).map((reason, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversation Starters */}
        {insights.conversationStarters && insights.conversationStarters.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Conversation Starter
            </p>
            <p className="text-sm text-foreground italic">
              "{insights.conversationStarters[0]}"
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          onClick={() => onConnect(profile)} 
          className="flex-1 gap-2"
          size="sm"
        >
          <Briefcase className="h-4 w-4" />
          Connect
        </Button>
        {onMessage && (
          <Button 
            onClick={() => onMessage(profile)} 
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Message
          </Button>
        )}
      </div>
    </Card>
  );
};
