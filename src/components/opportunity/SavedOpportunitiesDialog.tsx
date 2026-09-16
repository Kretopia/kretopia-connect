import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export const SavedOpportunitiesDialog = () => {
  const [open, setOpen] = useState(false);
  const [savedOpportunities, setSavedOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fetchSavedOpportunities();
    }
  }, [open]);

  const fetchSavedOpportunities = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("saved_opportunities")
      .select(`
        *,
        opportunities (
          id,
          title,
          type,
          compensation,
          location,
          description,
          created_at
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading saved opportunities",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSavedOpportunities(data || []);
    }
    setLoading(false);
  };

  const handleUnsave = async (savedId: string) => {
    const { error } = await supabase
      .from("saved_opportunities")
      .delete()
      .eq("id", savedId);

    if (error) {
      toast({
        title: "Error removing bookmark",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Removed from saved",
      });
      fetchSavedOpportunities();
    }
  };

  const handleViewOpportunity = (opportunityId: string) => {
    setOpen(false);
    navigate(`/opportunity/${opportunityId}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Bookmark className="h-4 w-4" />
          Saved ({savedOpportunities.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Saved Opportunities</DialogTitle>
          <DialogDescription>View and manage your bookmarked opportunities</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : savedOpportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bookmark className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No saved opportunities yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedOpportunities.map((saved) => (
                <Card key={saved.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-2">
                          <h3 className="font-semibold text-lg">
                            {saved.opportunities?.title}
                          </h3>
                          <Badge variant="secondary">{saved.opportunities?.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {saved.opportunities?.description}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {saved.opportunities?.location && (
                            <span>{saved.opportunities.location}</span>
                          )}
                          {saved.opportunities?.compensation && (
                            <span>{saved.opportunities.compensation}</span>
                          )}
                        </div>
                        {saved.notes && (
                          <div className="mt-2 p-2 bg-secondary/50 rounded text-xs">
                            <strong>Notes:</strong> {saved.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewOpportunity(saved.opportunities.id)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnsave(saved.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
