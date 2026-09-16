import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Upload, Palette, ImagePlus, X, FileImage, Crown } from "lucide-react";
import { toast } from "sonner";
import { hasProAccess, hasCreatorProAccess } from "@/lib/subscriptionConfig";

export interface InvoiceBranding {
  brand_name: string;
  brand_logo_url: string;
  brand_address: string;
  brand_email: string;
  brand_website: string;
  brand_color: string;
  letterhead_url?: string;
}

interface InvoiceBrandingFormProps {
  branding: InvoiceBranding;
  onChange: (branding: InvoiceBranding) => void;
}

const DEFAULT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", 
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#1e293b", "#dc2626", "#059669"
];

export function InvoiceBrandingForm({ branding, onChange }: InvoiceBrandingFormProps) {
  const { user, subscriptionInfo } = useAuth();
  const tier = (subscriptionInfo?.tier || 'free') as any;
  const isCreator = hasProAccess(tier);
  const isCreatorPlus = hasCreatorProAccess(tier);
  const [uploading, setUploading] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [letterheadDragActive, setLetterheadDragActive] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id && !branding.brand_name) {
      loadProfileBranding();
    }
  }, [user?.id]);

  const loadProfileBranding = async () => {
    if (!user?.id) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, company_name, company_logo_url, company_address, avatar_url")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      const { data: authData } = await supabase.auth.getUser();
      onChange({
        ...branding,
        brand_name: profile.company_name || profile.full_name || "",
        brand_logo_url: profile.company_logo_url || profile.avatar_url || "",
        brand_address: profile.company_address || "",
        brand_email: authData?.user?.email || "",
      });
    }
  };

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    if (!user?.id) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    return publicUrl;
  };

  const handleLogoUpload = async (file: File) => {
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, "invoice-logo");
      if (url) onChange({ ...branding, brand_logo_url: url });
      toast.success("Logo uploaded");
    } catch (err) {
      console.error("Logo upload error:", err);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleLetterheadUpload = async (file: File) => {
    if (!file || !user?.id) return;
    setUploadingLetterhead(true);
    try {
      const url = await uploadFile(file, "letterhead");
      if (url) onChange({ ...branding, letterhead_url: url });
      toast.success("Letterhead uploaded");
    } catch (err) {
      console.error("Letterhead upload error:", err);
      toast.error("Failed to upload letterhead");
    } finally {
      setUploadingLetterhead(false);
    }
  };

  const handleDrop = (e: React.DragEvent, type: "logo" | "letterhead") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "logo") setLogoDragActive(false);
    else setLetterheadDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      type === "logo" ? handleLogoUpload(file) : handleLetterheadUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent, type: "logo" | "letterhead") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "logo") setLogoDragActive(true);
    else setLetterheadDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: "logo" | "letterhead") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "logo") setLogoDragActive(false);
    else setLetterheadDragActive(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Your Branding</h3>
      </div>

      {/* Logo Upload - Creator+ only */}
      <div className={!isCreatorPlus ? "relative" : ""}>
        <Label className="text-xs font-medium mb-1.5 flex items-center gap-1">
          Business Logo
          {!isCreatorPlus && <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-semibold ml-1"><Crown className="h-3 w-3" /> Creator+</span>}
        </Label>
        <div
          onClick={() => isCreatorPlus ? logoInputRef.current?.click() : toast.error("Upgrade to Creator+ for custom logo branding")}
          onDrop={(e) => isCreatorPlus ? handleDrop(e, "logo") : e.preventDefault()}
          onDragOver={(e) => isCreatorPlus ? handleDragOver(e, "logo") : e.preventDefault()}
          onDragLeave={(e) => isCreatorPlus ? handleDragLeave(e, "logo") : e.preventDefault()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 p-4 flex items-center gap-4 ${
            logoDragActive 
              ? "border-primary bg-primary/5 scale-[1.01]" 
              : branding.brand_logo_url 
                ? "border-muted-foreground/20 bg-muted/30 hover:border-primary/50" 
                : "border-muted-foreground/30 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
          }`}
        >
          {branding.brand_logo_url ? (
            <>
              <div className="h-14 w-14 rounded-lg bg-background border flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={branding.brand_logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">Logo uploaded</p>
                <p className="text-[10px] text-muted-foreground">Tap to replace • Drag & drop supported</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange({ ...branding, brand_logo_url: "" }); }}
                className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-full py-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <ImagePlus className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-medium">{uploading ? "Uploading..." : "Upload your logo"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Tap to browse or drag & drop • PNG, JPG, SVG
              </p>
            </div>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
            disabled={uploading}
          />
        </div>
      </div>

      {/* Business Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Business Name *</Label>
          <Input
            value={branding.brand_name}
            onChange={(e) => onChange({ ...branding, brand_name: e.target.value })}
            placeholder="Your Studio / Name"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input
            value={branding.brand_email}
            onChange={(e) => onChange({ ...branding, brand_email: e.target.value })}
            placeholder="billing@yourstudio.com"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Address</Label>
          <Input
            value={branding.brand_address}
            onChange={(e) => onChange({ ...branding, brand_address: e.target.value })}
            placeholder="123 Creative St, City"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Website</Label>
          <Input
            value={branding.brand_website}
            onChange={(e) => onChange({ ...branding, brand_website: e.target.value })}
            placeholder="https://yourstudio.com"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Brand Color - Creator+ only */}
      <div className={!isCreatorPlus ? "opacity-60 pointer-events-none" : ""}>
        <Label className="text-xs flex items-center gap-1">
          <Palette className="h-3 w-3" /> Accent Color
          {!isCreatorPlus && <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-semibold ml-1"><Crown className="h-3 w-3" /> Creator+</span>}
        </Label>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {DEFAULT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...branding, brand_color: color })}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                branding.brand_color === color ? "border-foreground scale-125" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <Input
            type="color"
            value={branding.brand_color}
            onChange={(e) => onChange({ ...branding, brand_color: e.target.value })}
            className="h-6 w-6 p-0 border-0 cursor-pointer"
          />
        </div>
      </div>

      {/* Letterhead Upload - Creator+ only */}
      <div className={!isCreatorPlus ? "opacity-60 pointer-events-none" : ""}>
        <Label className="text-xs font-medium mb-1.5 flex items-center gap-1">
          <FileImage className="h-3 w-3" /> Custom Letterhead
          {!isCreatorPlus && <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-semibold ml-1"><Crown className="h-3 w-3" /> Creator+</span>}
          {isCreatorPlus && <span className="text-muted-foreground font-normal">(optional)</span>}
        </Label>
        <p className="text-[10px] text-muted-foreground mb-2">
          Upload a designed header image that appears at the top of your invoice instead of the default layout.
        </p>
        <div
          onClick={() => letterheadInputRef.current?.click()}
          onDrop={(e) => handleDrop(e, "letterhead")}
          onDragOver={(e) => handleDragOver(e, "letterhead")}
          onDragLeave={(e) => handleDragLeave(e, "letterhead")}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 ${
            letterheadDragActive
              ? "border-primary bg-primary/5"
              : branding.letterhead_url
                ? "border-muted-foreground/20 bg-muted/30 hover:border-primary/50"
                : "border-muted-foreground/30 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
          }`}
        >
          {branding.letterhead_url ? (
            <div className="relative">
              <img src={branding.letterhead_url} alt="Letterhead" className="w-full h-24 object-cover rounded-lg" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange({ ...branding, letterhead_url: "" }); }}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <p className="text-[10px] text-center text-muted-foreground py-1.5">Tap to replace letterhead</p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4 gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {uploadingLetterhead ? "Uploading..." : "Drop or tap to add letterhead"}
              </p>
            </div>
          )}
          <input
            ref={letterheadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleLetterheadUpload(e.target.files[0])}
            disabled={uploadingLetterhead}
          />
        </div>
      </div>
    </div>
  );
}
