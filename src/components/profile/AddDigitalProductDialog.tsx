import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, FileIcon, ImageIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddDigitalProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddDigitalProductDialog = ({ open, onOpenChange, onSuccess }: AddDigitalProductDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    product_type: "template",
    category: "design",
    demo_url: "",
    tags: "",
    file_urls: [] as string[],
    preview_urls: [] as string[]
  });
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'preview') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const setUploading = type === 'product' ? setUploadingFile : setUploadingPreview;
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = type === 'product' 
          ? `products/${fileName}` 
          : `product-previews/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('portfolio')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('portfolio')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      if (type === 'product') {
        setFormData(prev => ({
          ...prev,
          file_urls: [...prev.file_urls, ...uploadedUrls]
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          preview_urls: [...prev.preview_urls, ...uploadedUrls]
        }));
      }

      toast({
        title: "Files uploaded",
        description: `${uploadedUrls.length} file(s) uploaded successfully`,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number, type: 'product' | 'preview') => {
    if (type === 'product') {
      setFormData(prev => ({
        ...prev,
        file_urls: prev.file_urls.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        preview_urls: prev.preview_urls.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.file_urls.length === 0) {
      toast({
        title: "Product files required",
        description: "Please upload at least one product file for customers to download",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('digital_products')
        .insert({
          user_id: user.id,
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          product_type: formData.product_type,
          category: formData.category,
          demo_url: formData.demo_url || null,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          file_urls: formData.file_urls,
          preview_urls: formData.preview_urls,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your digital product is now available for sale!"
      });

      setFormData({
        title: "",
        description: "",
        price: "",
        product_type: "template",
        category: "design",
        demo_url: "",
        tags: "",
        file_urls: [],
        preview_urls: []
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add product",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Digital Product</DialogTitle>
          <DialogDescription>
            Upload your digital product for sale. Customers will receive download access after purchase.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Product Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Professional Website Template"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your product, what's included, features, etc."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price (USD) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="29.99"
                required
              />
            </div>

            <div>
              <Label htmlFor="product_type">Product Type *</Label>
              <Select
                value={formData.product_type}
                onValueChange={(value) => setFormData({ ...formData, product_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="asset">Asset Pack</SelectItem>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="ebook">eBook</SelectItem>
                  <SelectItem value="music">Music/Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="preset">Preset/Filter</SelectItem>
                  <SelectItem value="font">Font</SelectItem>
                  <SelectItem value="plugin">Plugin/Extension</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="music">Music & Audio</SelectItem>
                <SelectItem value="design">Design & Graphics</SelectItem>
                <SelectItem value="video">Video & Film</SelectItem>
                <SelectItem value="photo">Photography</SelectItem>
                <SelectItem value="writing">✍Writing & Copy</SelectItem>
                <SelectItem value="development">Web & App Dev</SelectItem>
                <SelectItem value="marketing">Marketing & Social</SelectItem>
                <SelectItem value="3d">🧊 3D & Animation</SelectItem>
                <SelectItem value="fashion">👗 Fashion & Beauty</SelectItem>
                <SelectItem value="education">Courses & Tutorials</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Files Upload */}
          <div className="space-y-2">
            <Label>Product Files * (customers will download these)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, 'product')}
                className="hidden"
                id="product-files"
                accept=".zip,.rar,.pdf,.psd,.ai,.eps,.fig,.sketch,.xd,.mp3,.wav,.mp4,.mov,.ttf,.otf,.woff,.woff2"
              />
              <label htmlFor="product-files" className="cursor-pointer">
                {uploadingFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload product files
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ZIP, PDF, PSD, AI, MP3, MP4, Fonts, etc.
                    </p>
                  </div>
                )}
              </label>
            </div>
            
            {formData.file_urls.length > 0 && (
              <div className="space-y-2">
                {formData.file_urls.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <FileIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate flex-1">
                      {url.split('/').pop()?.substring(0, 30)}...
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(idx, 'product')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {formData.file_urls.length === 0 && (
              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Upload at least one file that customers will receive after purchase
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Preview Images Upload */}
          <div className="space-y-2">
            <Label>Preview Images (shown in listing)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, 'preview')}
                className="hidden"
                id="preview-images"
                accept="image/*"
              />
              <label htmlFor="preview-images" className="cursor-pointer">
                {uploadingPreview ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload preview images
                    </p>
                  </div>
                )}
              </label>
            </div>
            
            {formData.preview_urls.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {formData.preview_urls.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(idx, 'preview')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="demo_url">Demo/Preview URL (optional)</Label>
            <Input
              id="demo_url"
              value={formData.demo_url}
              onChange={(e) => setFormData({ ...formData, demo_url: e.target.value })}
              placeholder="https://example.com/demo"
              type="url"
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="react, template, responsive, modern"
            />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Make sure you have your payment account connected to receive payments. 
              Platform fee: 15% (Free tier) or 7% (Creator Pro).
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || formData.file_urls.length === 0} 
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Product
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};