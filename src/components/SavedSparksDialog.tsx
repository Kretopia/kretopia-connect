import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Award, Newspaper, Briefcase, FileText } from "lucide-react";
import { toast } from "sonner";

interface SavedSparksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SavedSparksDialog = ({ open, onOpenChange }: SavedSparksDialogProps) => {
  const { data: savedSparks, isLoading, refetch } = useQuery({
    queryKey: ['saved-sparks'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('saved_sparks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limit initial load

      if (error) throw error;

      // Group saved items by type for batch fetching
      const groupedByType: Record<string, string[]> = {};
      data.forEach(saved => {
        if (!groupedByType[saved.item_type]) {
          groupedByType[saved.item_type] = [];
        }
        groupedByType[saved.item_type].push(saved.item_id);
      });

      // Batch fetch all items by type
      const detailsMap: Record<string, any> = {};
      
      await Promise.all([
        groupedByType['portfolio'] && supabase
          .from('credits')
          .select('id, project_name, primary_media_url, thumbnail_url, profiles:user_id(full_name, avatar_url)')
          .in('id', groupedByType['portfolio'])
          .then(({ data }) => data?.forEach(item => detailsMap[item.id] = item)),
        
        groupedByType['award'] && supabase
          .from('awards')
          .select('id, title, organization, profiles:user_id(full_name, avatar_url)')
          .in('id', groupedByType['award'])
          .then(({ data }) => data?.forEach(item => detailsMap[item.id] = item)),
        
        groupedByType['press'] && supabase
          .from('press_links')
          .select('id, title, url, profiles:user_id(full_name, avatar_url)')
          .in('id', groupedByType['press'])
          .then(({ data }) => data?.forEach(item => detailsMap[item.id] = item)),
        
        groupedByType['credit'] && supabase
          .from('credits')
          .select('id, project_name, role, profiles:user_id(full_name, avatar_url)')
          .in('id', groupedByType['credit'])
          .then(({ data }) => data?.forEach(item => detailsMap[item.id] = item)),
        
        groupedByType['post'] && supabase
          .from('feed_posts')
          .select('id, content, profiles:user_id(full_name, avatar_url)')
          .in('id', groupedByType['post'])
          .then(({ data }) => data?.forEach(item => detailsMap[item.id] = item)),
      ]);

      // Map details to saved items
      return data.map(saved => ({
        ...saved,
        details: detailsMap[saved.item_id]
      })).filter(item => item.details);
    },
    enabled: open,
    staleTime: 30000, // Cache for 30 seconds
  });

  const handleUnsave = async (itemType: string, itemId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('saved_sparks')
      .delete()
      .eq('user_id', user.id)
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    if (error) {
      toast.error("Failed to unclip item");
      return;
    }

    toast.success("Unclipped!");
    refetch();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'portfolio':
        return <Briefcase className="h-4 w-4" />;
      case 'award':
        return <Award className="h-4 w-4" />;
      case 'press':
        return <Newspaper className="h-4 w-4" />;
      case 'credit':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTitle = (item: any) => {
    return item.details?.title || item.details?.name || item.details?.project_name || 'Untitled';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Clipped Items
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3" role="list" aria-label="Saved items">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3" aria-busy="true">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading saved items...</p>
            </div>
          ) : savedSparks?.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Paperclip className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-semibold mb-2">No clipped items yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Save posts and work that inspire you for quick reference</p>
            </div>
          ) : (
            savedSparks?.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getIcon(item.item_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{getTitle(item)}</h4>
                  <p className="text-sm text-muted-foreground capitalize">{item.item_type}</p>
                  {item.details?.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {item.details.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnsave(item.item_type, item.item_id)}
                >
                  <Paperclip className="h-4 w-4 fill-current" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
