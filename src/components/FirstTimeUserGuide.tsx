import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, X } from "lucide-react";
import { useState } from "react";

interface FirstTimeUserGuideProps {
  title: string;
  description: string;
  tips: string[];
  onDismiss?: () => void;
}

export const FirstTimeUserGuide = ({ 
  title, 
  description, 
  tips,
  onDismiss 
}: FirstTimeUserGuideProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
            aria-label="Dismiss guide"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {tips.map((tip, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-primary font-semibold">{index + 1}.</span>
              <span className="text-muted-foreground">{tip}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
