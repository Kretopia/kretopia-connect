import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Newspaper, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PressLink {
  id: string;
  title: string;
  url: string;
  publication?: string;
  published_date?: string;
  thumbnail_url?: string;
  excerpt?: string;
  verification_status?: "unverified" | "pending" | "verified";
  is_featured?: boolean;
}

interface PressLinksSectionProps {
  userId: string;
  isOwnProfile: boolean;
  onRefresh: () => void;
}

export const PressLinksSection = ({ userId, isOwnProfile, onRefresh }: PressLinksSectionProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [pressLinks, setPressLinks] = useState<PressLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingOG, setFetchingOG] = useState(false);
  const [newLink, setNewLink] = useState({
    title: "",
    url: "",
    publication: "",
    published_date: "",
    image_url: "",
    excerpt: "",
  });

  useEffect(() => {
    fetchPressLinks();
  }, [userId]);

  const fetchPressLinks = async () => {
    try {
      const { data, error } = await supabase
        .from("press_links")
        .select("*")
        .eq("user_id", userId)
        .order("published_date", { ascending: false });

      if (error) throw error;
      setPressLinks((data || []) as PressLink[]);
    } catch (error) {
      console.error("Error fetching press links:", error);
      toast.error("Failed to load press links");
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenGraphData = async (url: string) => {
    setFetchingOG(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-og-data", {
        body: { url },
      });

      if (error) throw error;
      
      console.log("OG data received:", data);
      
      if (data.success) {
        const updatedLink = {
          ...newLink,
          title: data.data.title || newLink.title,
          publication: data.data.siteName || newLink.publication,
          image_url: data.data.image || newLink.image_url,
          excerpt: data.data.description || newLink.excerpt,
        };
        
        console.log("Updated link data:", updatedLink);
        setNewLink(updatedLink);
        toast.success("Article details loaded!");
      }
    } catch (error) {
      console.error("Error fetching OG data:", error);
      toast.error("Could not auto-fill - please enter details manually");
    } finally {
      setFetchingOG(false);
    }
  };

  const addLink = async () => {
    if (!newLink.title || !newLink.url) {
      toast.error("Please fill in title and URL");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Build insert data with only non-empty fields
      const insertData: any = {
        user_id: user.id,
        title: newLink.title,
        url: newLink.url,
      };

      // Only add optional fields if they have values
      if (newLink.publication) insertData.publication = newLink.publication;
      if (newLink.published_date) insertData.published_date = newLink.published_date;
      if (newLink.image_url) insertData.thumbnail_url = newLink.image_url;
      if (newLink.excerpt) insertData.excerpt = newLink.excerpt;

      console.log("Inserting press link:", insertData);

      const { error } = await supabase.from("press_links").insert(insertData);

      if (error) throw error;

      toast.success("Press link added successfully");
      setNewLink({
        title: "",
        url: "",
        publication: "",
        published_date: "",
        image_url: "",
        excerpt: "",
      });
      setIsEditOpen(false);
      fetchPressLinks();
      onRefresh();
    } catch (error) {
      console.error("Error adding press link:", error);
      toast.error("Failed to add press link");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("press_links").delete().eq("id", id);
      if (error) throw error;

      toast.success("Press link deleted");
      fetchPressLinks();
      onRefresh();
    } catch (error) {
      console.error("Error deleting press link:", error);
      toast.error("Failed to delete press link");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading press links...</div>;
  }

  if (pressLinks.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Press & Media</h3>
        {isOwnProfile && (
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Press
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Press Coverage</DialogTitle>
                <DialogDescription>Share articles and media mentions</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Article URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    onBlur={() => {
                      if (newLink.url && (newLink.url.startsWith('http://') || newLink.url.startsWith('https://'))) {
                        fetchOpenGraphData(newLink.url);
                      }
                    }}
                    placeholder="Paste article URL here..."
                  />
                  {fetchingOG && (
                    <p className="text-sm text-muted-foreground animate-pulse">
                      Fetching article details...
                    </p>
                  )}
                </div>

                {/* Preview Card */}
                {(newLink.title || newLink.image_url) && !fetchingOG && (
                  <div className="border border-border rounded-lg overflow-hidden bg-muted/50">
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground mb-3">Preview</p>
                      <div className="flex gap-4">
                        {newLink.image_url && (
                          <div className="flex-shrink-0 w-24 h-24 rounded overflow-hidden bg-background">
                            <img 
                              src={newLink.image_url} 
                              alt="Article preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {newLink.publication && (
                            <p className="text-sm font-medium text-muted-foreground mb-1">
                              {newLink.publication}
                            </p>
                          )}
                          <h4 className="font-semibold text-sm line-clamp-2 mb-1">
                            {newLink.title}
                          </h4>
                          {newLink.excerpt && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {newLink.excerpt}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="title">Title {!newLink.title && "*"}</Label>
                  <Input
                    id="title"
                    value={newLink.title}
                    onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                    placeholder="Article title (auto-filled if available)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="publication">Publication (optional)</Label>
                    <Input
                      id="publication"
                      value={newLink.publication}
                      onChange={(e) => setNewLink({ ...newLink, publication: e.target.value })}
                      placeholder="e.g., Forbes, TechCrunch"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date (optional)</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newLink.published_date}
                      onChange={(e) => setNewLink({ ...newLink, published_date: e.target.value })}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={addLink} 
                  className="w-full"
                  disabled={!newLink.title || !newLink.url || fetchingOG}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Press Coverage
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {pressLinks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Newspaper className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No press coverage yet</h3>
          <p className="text-sm text-muted-foreground">
            {isOwnProfile ? "Add articles and media mentions" : "No press coverage to display"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pressLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-lg border border-border bg-card hover:bg-accent transition-colors overflow-hidden"
            >
              <div className="flex gap-4 p-4">
                {link.thumbnail_url && (
                  <div className="flex-shrink-0 w-32 h-32 rounded overflow-hidden bg-muted">
                    <img
                      src={link.thumbnail_url}
                      alt={link.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {link.publication && (
                        <>
                          <span className="font-medium">{link.publication}</span>
                          <span>•</span>
                        </>
                      )}
                      {link.published_date && (
                        <time>{new Date(link.published_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}</time>
                      )}
                    </div>
                    {isOwnProfile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(link.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-primary group-hover:underline mb-2 line-clamp-2">
                    {link.title}
                  </h3>
                  {link.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {link.excerpt}
                    </p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
