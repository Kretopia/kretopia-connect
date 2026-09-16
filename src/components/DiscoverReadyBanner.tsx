import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus } from "lucide-react";
import { Link } from "react-router-dom";

interface DiscoverReadyBannerProps {
  portfolioCount: number;
}

export const DiscoverReadyBanner = ({ portfolioCount }: DiscoverReadyBannerProps) => {
  if (portfolioCount > 0) return null;

  return (
    <Alert className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 mb-6">
      <Sparkles className="h-5 w-5 text-primary" />
      <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold text-foreground mb-1">
            Almost ready to be discovered!           </p>
          <p className="text-sm text-muted-foreground">
            Add at least one portfolio item to start appearing in Discover and get matched with other creators
          </p>
        </div>
        <Link to="/profile">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Portfolio Item
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
};
