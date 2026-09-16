import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageTipProps {
  id: string;
  title: string;
  message: string;
  className?: string;
}

export function PageTip({ id, title, message, className }: PageTipProps) {
  const storageKey = `tip_dismissed_${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show once ever — mark as seen on first display so it never re-appears,
    // even if the user navigates away without explicitly dismissing it.
    if (localStorage.getItem(storageKey) !== "true") {
      const t = setTimeout(() => {
        setVisible(true);
        try { localStorage.setItem(storageKey, "true"); } catch {}
      }, 800);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(storageKey, "true");
  };

  return (
    <Card className={cn(
      "border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 animate-in fade-in slide-in-from-top-2 duration-300",
      className
    )}>
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{message}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={dismiss} aria-label="Dismiss tip">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
