import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocationCategories } from "@/hooks/useLocationCategories";
import { SuggestCategoryDialog } from "./SuggestCategoryDialog";
import { Loader2, MapPin, Camera, X, DollarSign } from "lucide-react";

interface AddCreativeLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  defaultLocation?: { lat: number; lng: number };
}

const LOCATION_TYPES = [
  { value: 'studio', label: '🎙Studio', desc: 'Recording, photo, or production studio' },
  { value: 'creative_space', label: 'Creative Space', desc: 'Coworking, workshop, or art space' },
  { value: 'shoot_spot', label: 'Shoot Spot', desc: 'Mural walls, scenic locations, backdrops' },
  { value: 'venue', label: 'Venue', desc: 'Event venue, gallery, or performance space' },
  { value: 'music_store', label: 'Music Store', desc: 'Instruments, gear, and music equipment' },
  { value: 'art_supply', label: 'Art Supply', desc: 'Art materials, craft supplies, stationery' },
  { value: 'rental_house', label: 'Rental House', desc: 'Equipment rental, camera gear, lighting' },
  { value: 'photo_lab', label: '📷 Photo Lab', desc: 'Film processing, printing, scanning' },
];

// Categories now fetched from location_categories table

const AMENITY_OPTIONS = [
  'WiFi', 'Parking', 'AC', 'Sound System', 'Lighting Equipment',
  'Green Screen', 'Kitchen', 'Restroom', 'Wheelchair Accessible',
  'Outdoor Space', 'Projector', 'Whiteboard', 'Props Available',
];

export function AddCreativeLocationDialog({ 
  open, onOpenChange, onCreated, defaultLocation 
}: AddCreativeLocationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationType, setLocationType] = useState('shoot_spot');
  const [category, setCategory] = useState('');
  const { data: subcategories = [] } = useLocationCategories(locationType);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [isRentable, setIsRentable] = useState(false);
  const [pricePerHour, setPricePerHour] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [contactInfo, setContactInfo] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showSuggestCategory, setShowSuggestCategory] = useState(false);
  const handleSubmit = async () => {
    if (!user || !name.trim() || !defaultLocation) return;
    
    setLoading(true);
    try {
      // Upload images first
      let uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('location-images')
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('location-images')
          .getPublicUrl(filePath);
        uploadedUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase
        .from('creative_locations')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          location_type: locationType,
          category,
          address: address.trim() || null,
          city: city.trim() || null,
          latitude: defaultLocation.lat,
          longitude: defaultLocation.lng,
          is_rentable: isRentable,
          price_per_hour: isRentable && pricePerHour ? parseFloat(pricePerHour) : null,
          price_currency: priceCurrency,
          contact_info: contactInfo.trim() || null,
          website_url: websiteUrl.trim() || null,
          tags,
          amenities,
          cover_image_url: uploadedUrls[0] || null,
          image_urls: uploadedUrls,
        });
      
      if (error) throw error;
      
      toast({ title: "Spot pinned!", description: `${name} has been added to Nearby.` });
      onCreated();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName(''); setDescription(''); setLocationType('shoot_spot');
    setCategory('General'); setAddress(''); setCity('');
    setIsRentable(false); setPricePerHour(''); setTags([]);
    setAmenities([]); setContactInfo(''); setWebsiteUrl('');
    setImageFiles([]); setImagePreviews([]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 5) {
      toast({ title: "Max 5 images", variant: "destructive" });
      return;
    }
    const newFiles = [...imageFiles, ...files].slice(0, 5);
    setImageFiles(newFiles);
    const previews = newFiles.map(f => URL.createObjectURL(f));
    setImagePreviews(previews);
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const toggleAmenity = (amenity: string) => {
    setAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Pin a Creative Spot
          </DialogTitle>
          <DialogDescription>
            Share a studio, creative space, or shoot spot with the community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-2">
            {LOCATION_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => setLocationType(type.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  locationType === type.value 
                    ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-sm font-medium">{type.label}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{type.desc}</p>
              </button>
            ))}
          </div>

          {/* Name */}
          <div>
            <Label className="text-sm font-medium">Name *</Label>
            <Input 
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Blue Mural Wall on Frederick St"
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm font-medium">Description</Label>
            <Textarea 
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this spot special?"
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Photos */}
          <div>
            <Label className="text-sm font-medium">Photos (up to 5)</Label>
            <div className="mt-2">
              {imagePreviews.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                  {imagePreviews.map((url, i) => (
                    <div key={i} className="relative shrink-0 h-20 w-20 rounded-lg overflow-hidden border border-border">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center text-xs"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {imageFiles.length < 5 && (
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Add photos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
              )}
            </div>
          </div>

          {subcategories.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Subcategory</Label>
                <button
                  type="button"
                  onClick={() => setShowSuggestCategory(true)}
                  className="text-[10px] text-primary hover:underline"
                >
                  Missing one? Suggest it
                </button>
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a subcategory" /></SelectTrigger>
                <SelectContent>
                  {subcategories.map(c => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.emoji} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Address & City */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} 
                placeholder="Street address" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} 
                placeholder="City" className="mt-1" />
            </div>
          </div>

          {/* Rentable Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Available for Rent?</p>
              <p className="text-xs text-muted-foreground">Allow others to book this space</p>
            </div>
            <Switch checked={isRentable} onCheckedChange={setIsRentable} />
          </div>

          {isRentable && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Price / Hour</Label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)}
                    placeholder="50" type="number" className="pl-9" />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Currency</Label>
                <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="TTD">TTD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Amenities */}
          {(locationType === 'studio' || locationType === 'creative_space' || locationType === 'venue') && (
            <div>
              <Label className="text-sm font-medium">Amenities</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {AMENITY_OPTIONS.map(a => (
                  <Badge 
                    key={a}
                    variant={amenities.includes(a) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleAmenity(a)}
                  >
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <Label className="text-sm font-medium">Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag" 
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button variant="outline" size="sm" onClick={addTag} type="button">Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs gap-1">
                    {t}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter(x => x !== t))} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Contact */}
          <div>
            <Label className="text-sm font-medium">Contact Info (optional)</Label>
            <Input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Phone, email, or IG handle" className="mt-1" />
          </div>

          {/* Location Note */}
          {defaultLocation && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
              <MapPin className="h-3 w-3" />
              Pinning at your current location ({defaultLocation.lat.toFixed(4)}, {defaultLocation.lng.toFixed(4)})
            </div>
          )}

          <Button onClick={handleSubmit} disabled={loading || !name.trim() || !defaultLocation} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
            Pin This Spot
          </Button>
        </div>
      </DialogContent>
      <SuggestCategoryDialog open={showSuggestCategory} onOpenChange={setShowSuggestCategory} />
    </Dialog>
  );
}
