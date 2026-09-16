import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Briefcase, Sparkles, ArrowRight, MessageCircle } from "lucide-react";

interface ConnectionSuccessStepProps {
  connectionCount: number;
  onComplete: () => void;
}

export const ConnectionSuccessStep = ({ 
  connectionCount, 
  onComplete 
}: ConnectionSuccessStepProps) => {
  const suggestions = [
    {
      icon: Briefcase,
      title: "Explore Opportunities",
      description: "Browse open collaborations that match your combined skills",
      action: "Browse Opportunities",
      route: "/discover",
      variant: "gradient" as const,
    },
    {
      icon: MessageCircle,
      title: "Send a Message",
      description: "Break the ice by sending a message to your new connections",
      action: "Open Messages",
      route: "/messages",
      variant: "default" as const,
    },
    {
      icon: Sparkles,
      title: "Start a Project",
      description: "Create a collaborative project and invite your connections",
      action: "Create Project",
      route: "/projects",
      variant: "outline" as const,
    },
  ];

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-4">
          <CheckCircle2 className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold mb-3">
          {connectionCount > 0 ? "Connections Sent!" : "You're All Set!"}
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {connectionCount > 0 
            ? `You've sent ${connectionCount} connection request${connectionCount > 1 ? 's' : ''}. Here's what you can do next to start collaborating:`
            : "You can always connect with creators later. Here's how to get started on the platform:"
          }
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {suggestions.map((suggestion, idx) => {
          const Icon = suggestion.icon;
          return (
            <Card 
              key={idx} 
              className="p-6 hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <div className="flex flex-col items-center text-center h-full">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{suggestion.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  {suggestion.description}
                </p>
                <Button
                  variant={suggestion.variant}
                  size="sm"
                  className="w-full"
                  onClick={() => window.location.href = suggestion.route}
                >
                  {suggestion.action}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {connectionCount > 0 && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Pro Tip: Ice Breaker Ideas</h3>
              <p className="text-sm text-muted-foreground mb-3">
                When your connections accept, try these conversation starters:
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">1</Badge>
                  <span className="text-muted-foreground">
                    Share a recent project you're proud of and ask about theirs
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">2</Badge>
                  <span className="text-muted-foreground">
                    Suggest the AI-recommended collaboration idea you saw in their profile
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">3</Badge>
                  <span className="text-muted-foreground">
                    Ask about their creative process or favorite tools they use
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="text-center pt-4">
        <Button onClick={onComplete} variant="gradient" size="lg">
          Complete Onboarding <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
