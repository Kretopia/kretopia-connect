import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Loader2 } from "lucide-react";

interface SuggestCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LOCATION_TYPES = [
  { value: 'studio', label: '🎙Studio' },
  { value: 'creative_space', label: 'Creative Space' },
  { value: 'shoot_spot', label: 'Shoot Spot' },
  { value: 'venue', label: 'Venue' },
  { value: 'music_store', label: 'Music Store' },
  { value: 'art_supply', label: 'Art Supply' },
  { value: 'rental_house', label: 'Rental House' },
  { value: 'photo_lab', label: '📷 Photo Lab' },
];

export function SuggestCategoryDialog({ open, onOpenChange }: SuggestCategoryDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!user || !name.trim() || !locationType) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('category_suggestions')
        .insert({
          user_id: user.id,
          suggested_name: name.trim(),
          location_type: locationType,
          description: description.trim() || null,
        });
      if (error) throw error;
      toast({ title: "Suggestion submitted!", description: "We'll review it and add it to the atlas." });
      setName('');
      setLocationType('');
      setDescription('');
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Suggest a Category
          </DialogTitle>
          <DialogDescription>
            Missing a category? Help us grow the Nearby taxonomy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Category Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tattoo Studio, Darkroom, Rehearsal Space"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Belongs Under *</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Why is this needed?</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this category and why creatives need it..."
              rows={3}
              className="mt-1"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !locationType}
            className="w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-2" />}
            Submit Suggestion
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
