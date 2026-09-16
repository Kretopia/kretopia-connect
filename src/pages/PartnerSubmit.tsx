import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, CheckCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PartnerSubmit() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    website_url: "",
    discount_type: "percentage",
    discount_value: "",
    description: "",
    terms: "",
    category: "software",
    tier_required: "free",
    redemption_url: "",
    redemption_code: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Logo must be under 5MB",
          variant: "destructive"
        });
        return;
      }
      setLogoFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoFile) {
      toast({
        title: "Logo required",
        description: "Please upload your company logo",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Upload logo
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('partner-logos')
        .upload(fileName, logoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('partner-logos')
        .getPublicUrl(fileName);

      // Process submission with AI categorization and auto-approval
      const { data, error } = await supabase.functions.invoke('process-partner-submission', {
        body: {
          ...formData,
          logo_url: publicUrl
        }
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Submission received!",
        description: "Our team will review your partner discount before it goes live."
      });
    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: "Submission failed",
        description: error.message || "Please check your connection and try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-12 pb-12">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Your partnership discount is now live! Thrive members can now access your exclusive offer on the platform.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8" />
            Become a Thrive Partner
          </h1>
          <p className="text-muted-foreground">
            Offer exclusive discounts to our creative community
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Partner Application</CardTitle>
            <CardDescription>
              Fill out this form to offer your services to Thrive members. Your discount will go live immediately upon submission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Company Information</h3>
                
                <div>
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Acme Corp"
                  />
                </div>

                <div>
                  <Label htmlFor="logo">Company Logo * (Max 5MB)</Label>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    required
                    onChange={handleLogoChange}
                    className="cursor-pointer"
                  />
                  {logoFile && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Selected: {logoFile.name}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    placeholder="https://acme.com"
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Contact Information</h3>
                
                <div>
                  <Label htmlFor="contact_name">Contact Name *</Label>
                  <Input
                    id="contact_name"
                    required
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_email">Contact Email *</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    required
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="john@acme.com"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              {/* Discount Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Discount Offer</h3>
                
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coworking">Coworking</SelectItem>
                      <SelectItem value="software">Software</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="wellness">Wellness</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discount_type">Discount Type *</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage Off</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount Off</SelectItem>
                        <SelectItem value="special_offer">Special Offer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="discount_value">Discount Value *</Label>
                    <Input
                      id="discount_value"
                      required
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      placeholder="20% or $50 or 2 months free"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of your offer..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    placeholder="Any limitations or requirements..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="tier_required">Available To *</Label>
                  <Select
                    value={formData.tier_required}
                    onValueChange={(value) => setFormData({ ...formData, tier_required: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">All Members (Spark)</SelectItem>
                      <SelectItem value="pro">Pro Members & Above</SelectItem>
                      <SelectItem value="enterprise">Creator+ Members Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="redemption_code">Promo Code (if applicable)</Label>
                  <Input
                    id="redemption_code"
                    value={formData.redemption_code}
                    onChange={(e) => setFormData({ ...formData, redemption_code: e.target.value })}
                    placeholder="THRIVE20"
                  />
                </div>

                <div>
                  <Label htmlFor="redemption_url">Redemption URL (if applicable)</Label>
                  <Input
                    id="redemption_url"
                    type="url"
                    value={formData.redemption_url}
                    onChange={(e) => setFormData({ ...formData, redemption_url: e.target.value })}
                    placeholder="https://acme.com/partner/thrive"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit Partnership Application
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
