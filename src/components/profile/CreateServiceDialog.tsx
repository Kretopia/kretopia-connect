import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Sparkles, Loader2, ImagePlus, X, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CurrencySelector } from "@/components/CurrencySelector";
import { SUPPORTED_CURRENCIES } from "@/hooks/useCurrencyConversion";

const CATEGORIES = [
  "music", "design", "video", "photography", "fashion", "art", "writing", "development", "coaching", "consulting", "other"
];

interface Tier {
  id?: string;
  tier_name: string;
  price: string;
  price_max: string;
  currency: string;
  delivery_days: string;
  deliverables: string[];
  is_range: boolean;
}

interface EditService {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  service_format: string | null;
  cover_image_url: string | null;
  tiers: {
    id: string;
    tier_name: string;
    price: number;
    price_max: number | null;
    currency: string;
    deliverables: string[];
    delivery_days: number | null;
    tier_order: number;
  }[];
}

interface CreateServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editService?: EditService | null;
}

export const CreateServiceDialog = ({ open, onOpenChange, onCreated, editService }: CreateServiceDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [aiImageGenerating, setAiImageGenerating] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [showAiImageInput, setShowAiImageInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [serviceFormat, setServiceFormat] = useState("virtual");
  const [coverImage, setCoverImage] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([
    { tier_name: "Standard", price: "", price_max: "", currency: "USD", delivery_days: "", deliverables: [""], is_range: false },
  ]);

  const isEditing = !!editService;

  // Populate form when editing
  useEffect(() => {
    if (editService && open) {
      setTitle(editService.title);
      setDescription(editService.description || "");
      setCategory(editService.category || "");
      setServiceFormat(editService.service_format || "virtual");
      setCoverImage(editService.cover_image_url || "");
      setTiers(
        editService.tiers.length > 0
          ? editService.tiers.map(t => ({
              id: t.id,
              tier_name: t.tier_name,
              price: t.price.toString(),
              price_max: t.price_max?.toString() || "",
              currency: t.currency || "USD",
              delivery_days: t.delivery_days?.toString() || "",
              deliverables: t.deliverables.length > 0 ? t.deliverables : [""],
              is_range: !!t.price_max && t.price_max > 0,
            }))
          : [{ tier_name: "Standard", price: "", price_max: "", currency: "USD", delivery_days: "", deliverables: [""], is_range: false }]
      );
    } else if (!editService && open) {
      resetForm();
    }
  }, [editService, open]);

  const resetForm = () => {
    setTitle(""); setDescription(""); setCategory(""); setServiceFormat("virtual"); setCoverImage("");
    setShowAiImageInput(false); setAiImagePrompt("");
    setTiers([{ tier_name: "Standard", price: "", price_max: "", currency: "USD", delivery_days: "", deliverables: [""], is_range: false }]);
  };

  const addTier = () => {
    if (tiers.length >= 3) return;
    const names = ["Basic", "Standard", "Premium"];
    const nextName = names.find(n => !tiers.some(t => t.tier_name === n)) || `Tier ${tiers.length + 1}`;
    const currency = tiers[0]?.currency || "USD";
    setTiers([...tiers, { tier_name: nextName, price: "", price_max: "", currency, delivery_days: "", deliverables: [""], is_range: false }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof Tier, value: any) => {
    setTiers(tiers.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const updateAllCurrencies = (currency: string) => {
    setTiers(tiers.map(t => ({ ...t, currency })));
  };

  const addDeliverable = (tierIndex: number) => {
    const updated = [...tiers];
    updated[tierIndex].deliverables.push("");
    setTiers(updated);
  };

  const updateDeliverable = (tierIndex: number, delIndex: number, value: string) => {
    const updated = [...tiers];
    updated[tierIndex].deliverables[delIndex] = value;
    setTiers(updated);
  };

  const removeDeliverable = (tierIndex: number, delIndex: number) => {
    const updated = [...tiers];
    updated[tierIndex].deliverables = updated[tierIndex].deliverables.filter((_, i) => i !== delIndex);
    setTiers(updated);
  };

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setImageUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `services/${user.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      setCoverImage(publicUrl);
      toast({ title: "Image uploaded!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setImageUploading(false);
    }
  };
  const handleAiImageGenerate = async () => {
    if (!user) return;
    const prompt = aiImagePrompt.trim() || `A professional, modern cover image for a ${category || 'creative'} service called "${title || 'Creative Service'}". Clean, polished, visually appealing for a portfolio.`;
    setAiImageGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          type: 'image',
          messages: [{ role: 'user', content: `Generate a professional service cover image: ${prompt}. Make it visually striking, modern, and suitable as a banner image. No text in the image.` }],
        },
      });
      if (error) throw error;
      const imageUrl = data?.images?.[0]?.image_url?.url;
      if (!imageUrl) throw new Error("No image generated");
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const path = `services/${user.id}-ai-${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage.from('media').upload(path, blob, { contentType: 'image/png' });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      setCoverImage(publicUrl);
      setShowAiImageInput(false);
      setAiImagePrompt("");
      toast({ title: "AI image generated!", description: "Cover image created and saved." });
    } catch (err: any) {
      const msg = err?.message || "Failed to generate image";
      if (msg.includes("429") || msg.includes("rate")) {
        toast({ title: "Too many requests", description: "Please wait and try again.", variant: "destructive" });
      } else if (msg.includes("402")) {
        toast({ title: "Credits needed", description: "AI credits exhausted.", variant: "destructive" });
      } else {
        toast({ title: "Generation failed", description: msg, variant: "destructive" });
      }
    } finally {
      setAiImageGenerating(false);
    }
  };

  const handleAIEnhance = async () => {
    if (!title && !description) {
      toast({ title: "Add some details first", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-listing-ai', {
        body: { title, description, category, type: 'service' },
      });
      if (error) throw error;
      if (data?.title) setTitle(data.title);
      if (data?.description) setDescription(data.description);
      toast({ title: "Enhanced!", description: "AI improved your listing." });
    } catch {
      toast({ title: "AI unavailable", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const validTiers = tiers.filter(t => t.price && parseFloat(t.price) > 0);
    if (validTiers.length === 0) {
      toast({ title: "Add at least one tier with a price", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const servicePayload = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category: category || null,
        service_format: serviceFormat,
        cover_image_url: coverImage || null,
      };

      let serviceId: string;

      if (isEditing && editService) {
        const { error } = await supabase
          .from('creator_services')
          .update(servicePayload)
          .eq('id', editService.id);
        if (error) throw error;
        serviceId = editService.id;

        // Delete old tiers and re-insert
        await supabase.from('service_tiers').delete().eq('service_id', serviceId);
      } else {
        const { data: service, error } = await supabase
          .from('creator_services')
          .insert(servicePayload)
          .select()
          .single();
        if (error) throw error;
        serviceId = service.id;
      }

      const tierInserts = validTiers.map((t, i) => ({
        service_id: serviceId,
        tier_name: t.tier_name,
        price: parseFloat(t.price),
        price_max: t.is_range && t.price_max ? parseFloat(t.price_max) : null,
        currency: t.currency,
        delivery_days: t.delivery_days ? parseInt(t.delivery_days) : null,
        deliverables: t.deliverables.filter(d => d.trim()),
        tier_order: i,
      }));

      const { error: tierError } = await supabase.from('service_tiers').insert(tierInserts);
      if (tierError) throw tierError;

      toast({ title: isEditing ? "Service updated!" : "Service created!" });
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      console.error('Save service error:', err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currSymbol = SUPPORTED_CURRENCIES.find(c => c.code === (tiers[0]?.currency || "USD"))?.symbol || "$";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Create"} Service</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cover Image */}
          <div>
            <Label className="text-xs">Cover Image</Label>
            {coverImage ? (
              <div className="relative mt-1 rounded-lg overflow-hidden aspect-[16/9] bg-muted">
                <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 h-7 w-7 p-0"
                  onClick={() => setCoverImage("")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="mt-1 space-y-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading || aiImageGenerating}
                  className="w-full aspect-[16/9] rounded-lg border-2 border-dashed border-border hover:border-[#FF2DA1]/50 transition-colors flex flex-col items-center justify-center gap-1.5 bg-muted/30"
                >
                  {imageUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Upload image</span>
                    </>
                  )}
                </button>
                {showAiImageInput ? (
                  <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                    <Label className="text-xs">Describe the image you want</Label>
                    <Input
                      placeholder={`e.g. A vibrant ${category || 'creative'} service banner`}
                      value={aiImagePrompt}
                      onChange={e => setAiImagePrompt(e.target.value)}
                      disabled={aiImageGenerating}
                    />
                    <p className="text-[10px] text-muted-foreground">Leave empty to auto-generate based on your service details.</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => { setShowAiImageInput(false); setAiImagePrompt(""); }}
                        disabled={aiImageGenerating}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={handleAiImageGenerate}
                        disabled={aiImageGenerating}
                      >
                        {aiImageGenerating ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                        ) : (
                          <><Wand2 className="h-3.5 w-3.5" /> Generate</>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs"
                    onClick={() => setShowAiImageInput(true)}
                    disabled={aiImageGenerating}
                  >
                    <Wand2 className="h-3.5 w-3.5 text-primary" /> Generate with AI
                  </Button>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* AI Enhance */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAIEnhance}
            disabled={aiLoading}
            className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Enhance with AI
          </Button>

          {/* Title */}
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Professional Music Production" />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what you offer..." rows={3} />
          </div>

          {/* Category, Format, Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Format</Label>
              <Select value={serviceFormat} onValueChange={setServiceFormat}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <CurrencySelector value={tiers[0]?.currency || "USD"} onChange={updateAllCurrencies} compact />
            </div>
          </div>

          {/* Tiers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Pricing Tiers</Label>
              {tiers.length < 3 && (
                <Button variant="ghost" size="sm" onClick={addTier} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Tier
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {tiers.map((tier, ti) => (
                <div key={ti} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Input
                      value={tier.tier_name}
                      onChange={e => updateTier(ti, 'tier_name', e.target.value)}
                      className="h-7 text-sm font-medium w-28"
                    />
                    {tiers.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeTier(ti)} className="h-7 w-7 p-0 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Price row */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-[10px]">{tier.is_range ? "From" : "Price"} ({currSymbol}) *</Label>
                        <Input
                          type="number" min="0" step="0.01"
                          value={tier.price}
                          onChange={e => updateTier(ti, 'price', e.target.value)}
                          placeholder="0.00"
                          className="h-8"
                        />
                      </div>
                      {tier.is_range && (
                        <div className="flex-1">
                          <Label className="text-[10px]">To ({currSymbol})</Label>
                          <Input
                            type="number" min="0" step="0.01"
                            value={tier.price_max}
                            onChange={e => updateTier(ti, 'price_max', e.target.value)}
                            placeholder="0.00"
                            className="h-8"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <Label className="text-[10px]">Delivery (days)</Label>
                        <Input
                          type="number" min="1"
                          value={tier.delivery_days}
                          onChange={e => updateTier(ti, 'delivery_days', e.target.value)}
                          placeholder="e.g. 7"
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tier.is_range}
                        onCheckedChange={v => updateTier(ti, 'is_range', v)}
                        className="scale-75"
                      />
                      <span className="text-[10px] text-muted-foreground">Price range</span>
                    </div>
                  </div>

                  {/* Deliverables */}
                  <div>
                    <Label className="text-[10px]">What's Included</Label>
                    {tier.deliverables.map((d, di) => (
                      <div key={di} className="flex gap-1 mt-1">
                        <Input
                          value={d}
                          onChange={e => updateDeliverable(ti, di, e.target.value)}
                          placeholder="e.g. 2 revisions"
                          className="h-7 text-xs"
                        />
                        {tier.deliverables.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeDeliverable(ti, di)} className="h-7 w-7 p-0 shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => addDeliverable(ti)} className="h-6 text-[10px] mt-1 gap-1">
                      <Plus className="h-2.5 w-2.5" /> Add item
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? "Update" : "Create"} Service
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
