import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AchievementCard } from "./AchievementCard";

interface AwardItem {
  id: string;
  title: string;
  organization: string;
  year: number;
  description?: string;
  category?: string;
  image_url?: string;
  verification_status?: "unverified" | "pending" | "verified";
  is_featured?: boolean;
}

interface AwardsSectionProps {
  userId: string;
  isOwnProfile: boolean;
  onRefresh: () => void;
}

const INITIAL_DISPLAY_COUNT = 6;

export const AwardsSection = ({ userId, isOwnProfile, onRefresh }: AwardsSectionProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [awards, setAwards] = useState<AwardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [newAward, setNewAward] = useState({
    title: "",
    organization: "",
    year: new Date().getFullYear(),
    description: "",
    category: "",
  });

  useEffect(() => {
    fetchAwards();
  }, [userId]);

  const fetchAwards = async () => {
    try {
      const { data, error } = await supabase
        .from("awards")
        .select("*")
        .eq("user_id", userId)
        .order("year", { ascending: false });

      if (error) throw error;
      setAwards((data || []) as AwardItem[]);
    } catch (error) {
      console.error("Error fetching awards:", error);
      toast.error("Failed to load awards");
    } finally {
      setLoading(false);
    }
  };

  const displayedAwards = showAll ? awards : awards.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMore = awards.length > INITIAL_DISPLAY_COUNT;

  const addAward = async () => {
    if (!newAward.title || !newAward.organization || !newAward.year) {
      toast.error("Please fill in title, organization, and year");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("awards").insert({
        user_id: user.id,
        ...newAward,
      });

      if (error) throw error;

      toast.success("Award added successfully");
      setNewAward({
        title: "",
        organization: "",
        year: new Date().getFullYear(),
        description: "",
        category: "",
      });
      fetchAwards();
      onRefresh();
    } catch (error) {
      console.error("Error adding award:", error);
      toast.error("Failed to add award");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("awards").delete().eq("id", id);
      if (error) throw error;

      toast.success("Award deleted");
      fetchAwards();
      onRefresh();
    } catch (error) {
      console.error("Error deleting award:", error);
      toast.error("Failed to delete award");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading awards...</div>;
  }

  if (awards.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Awards & Recognition</h3>
        {isOwnProfile && (
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Award
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Award</DialogTitle>
                <DialogDescription>Showcase your achievements and recognition</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Award Title *</Label>
                  <Input
                    id="title"
                    value={newAward.title}
                    onChange={(e) => setNewAward({ ...newAward, title: e.target.value })}
                    placeholder="e.g., Best Director Award"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization *</Label>
                    <Input
                      id="organization"
                      value={newAward.organization}
                      onChange={(e) => setNewAward({ ...newAward, organization: e.target.value })}
                      placeholder="e.g., Academy Awards"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year *</Label>
                    <Input
                      id="year"
                      type="number"
                      value={newAward.year}
                      onChange={(e) => setNewAward({ ...newAward, year: parseInt(e.target.value) })}
                      placeholder="e.g., 2023"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={newAward.category}
                    onChange={(e) => setNewAward({ ...newAward, category: e.target.value })}
                    placeholder="e.g., Film, Music, Design"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newAward.description}
                    onChange={(e) => setNewAward({ ...newAward, description: e.target.value })}
                    placeholder="Additional details about the award..."
                    rows={3}
                  />
                </div>
                
                <Button onClick={addAward} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Award
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {awards.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Award className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No awards yet</h3>
          <p className="text-sm text-muted-foreground">
            {isOwnProfile ? "Add your achievements and recognition" : "No awards to display"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedAwards.map((award) => (
              <AchievementCard
                key={award.id}
                variant="award"
                title={award.title}
                subtitle={award.organization}
                description={award.description}
                year={award.year}
                imageUrl={award.image_url}
                verificationStatus={award.verification_status}
                isFeatured={award.is_featured}
                isOwnProfile={isOwnProfile}
                onDelete={() => handleDelete(award.id)}
                icon={<Award className="h-16 w-16" />}
                metadata={award.category ? { Category: award.category } : undefined}
              />
            ))}
          </div>
          
          {hasMore && (
            <div className="text-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAll(!showAll)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showAll ? `Show less` : `Show ${awards.length - INITIAL_DISPLAY_COUNT} more awards`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
