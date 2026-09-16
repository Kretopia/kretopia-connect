import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: any;
  onSuccess: () => void;
}

export function LocationDialog({
  open,
  onOpenChange,
  location,
  onSuccess,
}: LocationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "cafe",
    address: "",
    city: "",
    country: "",
    latitude: "",
    longitude: "",
    description: "",
    tier_required: "free",
    points_per_visit: "10",
    check_in_radius_meters: "100",
    is_active: true,
    image_url: "",
    logo_url: "",
  });

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name || "",
        type: location.type || "cafe",
        address: location.address || "",
        city: location.city || "",
        country: location.country || "",
        latitude: location.latitude?.toString() || "",
        longitude: location.longitude?.toString() || "",
        description: location.description || "",
        tier_required: location.tier_required || "free",
        points_per_visit: location.points_per_visit?.toString() || "10",
        check_in_radius_meters:
          location.check_in_radius_meters?.toString() || "100",
        is_active: location.is_active ?? true,
        image_url: location.image_url || "",
        logo_url: location.logo_url || "",
      });
    } else {
      setFormData({
        name: "",
        type: "cafe",
        address: "",
        city: "",
        country: "",
        latitude: "",
        longitude: "",
        description: "",
        tier_required: "free",
        points_per_visit: "10",
        check_in_radius_meters: "100",
        is_active: true,
        image_url: "",
        logo_url: "",
      });
    }
  }, [location, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        points_per_visit: parseInt(formData.points_per_visit),
        check_in_radius_meters: parseInt(formData.check_in_radius_meters),
      };

      let error;
      if (location) {
        ({ error } = await supabase
          .from("partner_locations")
          .update(data)
          .eq("id", location.id));
      } else {
        ({ error } = await supabase.from("partner_locations").insert(data));
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: `Location ${location ? "updated" : "created"} successfully`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving location:", error);
      toast({
        title: "Error",
        description: "Failed to save location",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {location ? "Edit Location" : "Add Location"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cafe">Cafe</SelectItem>
                  <SelectItem value="coworking">Co-working Space</SelectItem>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="gym">Gym</SelectItem>
                  <SelectItem value="spa">Spa</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude *</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude *</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tier">Tier Required *</Label>
              <Select
                value={formData.tier_required}
                onValueChange={(value) =>
                  setFormData({ ...formData, tier_required: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="points">Points/Visit *</Label>
              <Input
                id="points"
                type="number"
                value={formData.points_per_visit}
                onChange={(e) =>
                  setFormData({ ...formData, points_per_visit: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="radius">Check-in Radius (m) *</Label>
              <Input
                id="radius"
                type="number"
                value={formData.check_in_radius_meters}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    check_in_radius_meters: e.target.value,
                  })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                type="url"
                value={formData.image_url}
                onChange={(e) =>
                  setFormData({ ...formData, image_url: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                type="url"
                value={formData.logo_url}
                onChange={(e) =>
                  setFormData({ ...formData, logo_url: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
            <Label htmlFor="active">Active</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : location ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
