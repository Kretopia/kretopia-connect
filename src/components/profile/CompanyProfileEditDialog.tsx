import { useRef, useState, memo, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Building2, Camera, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

interface CompanyProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: {
    full_name: string;
    role: string;
    bio: string;
    location: string;
    avatar_url: string;
    company_size: string;
    company_tagline?: string;
    cover_image_url?: string;
  };
  onFormChange: (form: any) => void;
  onSave: (data?: Record<string, any>) => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingAvatar: boolean;
  galleryPreviews: string[];
  onGalleryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveGalleryImage: (index: number) => void;
}

const FieldWrapper = ({ label, isIncomplete, children }: { label: string; isIncomplete: boolean; children: React.ReactNode }) => (
  <div className={`space-y-2 relative ${isIncomplete ? 'ring-2 ring-primary/20 rounded-lg p-3 bg-primary/5' : ''}`}>
    <div className="flex items-center justify-between">
      <Label className="flex items-center gap-2">
        {label}
        {isIncomplete ? (
          <Badge variant="secondary" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Missing
          </Badge>
        ) : (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        )}
      </Label>
    </div>
    {children}
  </div>
);

// Inner form with local state to prevent parent re-renders from blocking typing
const CompanyEditForm = memo(({
  initialData,
  avatarUrl,
  onSave,
  onAvatarUpload,
  isUploadingAvatar,
  galleryPreviews,
  onGalleryChange,
  onRemoveGalleryImage,
}: {
  initialData: { full_name: string; role: string; bio: string; location: string; company_size: string; company_tagline?: string; cover_image_url?: string };
  avatarUrl: string;
  onSave: (data: typeof initialData) => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingAvatar: boolean;
  galleryPreviews: string[];
  onGalleryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveGalleryImage: (index: number) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(initialData.full_name);
  const [role, setRole] = useState(initialData.role);
  const [bio, setBio] = useState(initialData.bio);
  const [location, setLocation] = useState(initialData.location);
  const [companySize, setCompanySize] = useState(initialData.company_size);
  const [companyTagline, setCompanyTagline] = useState(initialData.company_tagline || '');
  const [coverImageUrl, setCoverImageUrl] = useState(initialData.cover_image_url || '');

  const completion = useMemo(() => {
    const fields = [
      { label: 'Company Name', value: fullName && fullName !== 'New User' },
      { label: 'Industry', value: role && role !== 'Creator' },
      { label: 'Company Logo', value: avatarUrl },
      { label: 'Address', value: location },
      { label: 'Company Size', value: companySize },
      { label: 'About', value: bio && bio.length > 20 },
    ];
    const completed = fields.filter(f => f.value).length;
    const total = fields.length;
    const percentage = Math.round((completed / total) * 100);
    const missing = fields.filter(f => !f.value).map(f => f.label);
    return { percentage, missing, completed, total };
  }, [fullName, role, avatarUrl, location, companySize, bio]);

  const isMissing = (fieldLabel: string) => completion.missing.includes(fieldLabel);

  const handleSave = () => {
    onSave({ full_name: fullName, role, bio, location, company_size: companySize, company_tagline: companyTagline, cover_image_url: coverImageUrl });
  };

  return (
    <>
      {/* Completion Progress Bar */}
      <div className="space-y-3 pb-4 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Profile Completion</span>
          <span className="text-2xl font-bold text-primary">{completion.percentage}%</span>
        </div>
        <Progress value={completion.percentage} className="h-3" />
        <p className="text-xs text-muted-foreground">
          {completion.missing.length === 0 ? (
            <span className="text-primary font-medium">Your company profile is complete!</span>
          ) : (
            <>Complete {completion.missing.length} more {completion.missing.length === 1 ? 'field' : 'fields'} to reach 100%</>
          )}
        </p>
      </div>

      <div className="space-y-4">
        <FieldWrapper label="Company Logo" isIncomplete={isMissing('Company Logo')}>
          <div className="flex items-center gap-4 mt-2">
            <Avatar className="h-20 w-20 rounded-lg">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback><Building2 className="h-10 w-10" /></AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar} size="sm">
                {isUploadingAvatar ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>) : (<><Camera className="mr-2 h-4 w-4" />Change Logo</>)}
              </Button>
            </div>
          </div>
          {isMissing("Company Logo") && <p className="text-xs text-muted-foreground mt-1">A company logo builds trust and recognition</p>}
        </FieldWrapper>

        <FieldWrapper label="Company Name" isIncomplete={isMissing('Company Name')}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your company name" />
        </FieldWrapper>

        <FieldWrapper label="Industry" isIncomplete={isMissing('Industry')}>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g., Technology, Marketing, Entertainment" />
        </FieldWrapper>

        <FieldWrapper label="Company Size" isIncomplete={isMissing('Company Size')}>
          <Input value={companySize} onChange={(e) => setCompanySize(e.target.value)} placeholder="e.g., 1-10 employees" />
          {isMissing("Company Size") && <p className="text-xs text-muted-foreground mt-1">Company size helps creators understand your scale</p>}
        </FieldWrapper>

        <FieldWrapper label="Address" isIncomplete={isMissing('Address')}>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Company address" />
        </FieldWrapper>

        <FieldWrapper label="About" isIncomplete={isMissing('About')}>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell creators about your company, mission, and what makes you unique... (minimum 20 characters)" rows={5} />
          <p className="text-xs text-muted-foreground mt-1">{bio.length}/20 characters minimum</p>
        </FieldWrapper>

        <div className="space-y-2">
          <Label>Company Tagline (Optional)</Label>
          <Input value={companyTagline} onChange={(e) => setCompanyTagline(e.target.value)} placeholder="e.g., Empowering creators worldwide" maxLength={120} />
          <p className="text-xs text-muted-foreground">{companyTagline.length}/120 characters</p>
        </div>

        <div className="space-y-2">
          <Label>Cover Image URL (Pro)</Label>
          <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://example.com/cover.jpg" />
          <p className="text-xs text-muted-foreground">Paste a URL for your cover banner image</p>
        </div>

        <div>
          <Label>Gallery Images (Optional)</Label>
          <Input type="file" accept="image/*" multiple onChange={onGalleryChange} className="mt-2" />
          {galleryPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {galleryPreviews.map((preview, index) => (
                <div key={preview} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                  <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => onRemoveGalleryImage(index)}>×</Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {completion.missing.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              Still Missing
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {completion.missing.map((field) => (
                <li key={field} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {field}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <Button onClick={handleSave}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Save Changes {completion.percentage === 100 ? '' : ''}
        </Button>
      </div>
    </>
  );
});
CompanyEditForm.displayName = 'CompanyEditForm';

export const CompanyProfileEditDialog = ({
  open,
  onOpenChange,
  editForm,
  onFormChange,
  onSave,
  onAvatarUpload,
  isUploadingAvatar,
  galleryPreviews,
  onGalleryChange,
  onRemoveGalleryImage,
}: CompanyProfileEditDialogProps) => {
  const handleSave = (data: Record<string, any>) => {
    const updated = { ...editForm, ...data };
    onFormChange(updated);
    onSave(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Complete Company Profile
          </DialogTitle>
          <DialogDescription>
            Fill in your company information to attract talent and opportunities
          </DialogDescription>
        </DialogHeader>

        {open && (
          <CompanyEditForm
            initialData={{
              full_name: editForm.full_name,
              role: editForm.role,
              bio: editForm.bio,
              location: editForm.location,
              company_size: editForm.company_size,
              company_tagline: editForm.company_tagline,
              cover_image_url: editForm.cover_image_url,
            }}
            avatarUrl={editForm.avatar_url}
            onSave={handleSave}
            onAvatarUpload={onAvatarUpload}
            isUploadingAvatar={isUploadingAvatar}
            galleryPreviews={galleryPreviews}
            onGalleryChange={onGalleryChange}
            onRemoveGalleryImage={onRemoveGalleryImage}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
