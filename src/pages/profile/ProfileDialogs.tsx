import { DirectMessageDialog } from "@/components/DirectMessageDialog";
import { ImportFromWebsiteDialog } from "@/components/profile/ImportFromWebsiteDialog";
import { ProfileEditDialog } from "@/components/profile/ProfileEditDialog";
import { PassportShareSheet } from "@/components/passport/PassportShareSheet";
import { ProfileQRDialog } from "@/components/profile/ProfileQRDialog";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { ShareableCreatorCard } from "@/components/profile/ShareableCreatorCard";

interface ProfileDialogsProps {
  profile: any;
  portfolioItems: any[];
  // Dialog states
  isMessageDialogOpen: boolean;
  setIsMessageDialogOpen: (open: boolean) => void;
  isImportDialogOpen: boolean;
  setIsImportDialogOpen: (open: boolean) => void;
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  isShareDialogOpen: boolean;
  setIsShareDialogOpen: (open: boolean) => void;
  isQRDialogOpen: boolean;
  setIsQRDialogOpen: (open: boolean) => void;
  isCreatorCardOpen: boolean;
  setIsCreatorCardOpen: (open: boolean) => void;
  showCropDialog: boolean;
  setShowCropDialog: (open: boolean) => void;
  tempImageUrl: string;
  setTempImageUrl: (url: string) => void;
  // Handlers
  onImportData: (data: any) => void;
  onCropComplete: (blob: Blob) => void;
  isUploadingAvatar: boolean;
}

export const ProfileDialogs = ({
  profile,
  portfolioItems,
  isMessageDialogOpen,
  setIsMessageDialogOpen,
  isImportDialogOpen,
  setIsImportDialogOpen,
  isEditOpen,
  setIsEditOpen,
  isShareDialogOpen,
  setIsShareDialogOpen,
  isQRDialogOpen,
  setIsQRDialogOpen,
  isCreatorCardOpen,
  setIsCreatorCardOpen,
  showCropDialog,
  setShowCropDialog,
  tempImageUrl,
  setTempImageUrl,
  onImportData,
  onCropComplete,
  isUploadingAvatar,
}: ProfileDialogsProps) => {
  return (
    <>
      <DirectMessageDialog
        open={isMessageDialogOpen}
        onOpenChange={setIsMessageDialogOpen}
        recipientId={profile.user_id}
        recipientName={profile.full_name || ''}
      />

      <ImportFromWebsiteDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={onImportData}
      />

      <ProfileEditDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        profile={profile}
        onProfileUpdate={() => { window.location.reload(); }}
      />

      <PassportShareSheet
        userId={profile.user_id}
        profile={{
          full_name: profile.full_name,
          role: profile.role,
          sub_roles: Array.isArray((profile as any).sub_roles) ? (profile as any).sub_roles : [],
          passport_profession: (profile as any).passport_profession ?? null,
        }}
        canPublishSite={['creator', 'creator_plus', 'founder'].includes((profile as any).subscription_tier)}
        defaultOpen={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
      />


      <ProfileQRDialog
        open={isQRDialogOpen}
        onOpenChange={setIsQRDialogOpen}
        userId={profile.user_id}
        userName={profile.full_name || ''}
        userAvatar={profile.avatar_url || undefined}
      />

      <ImageCropDialog
        imageUrl={tempImageUrl}
        open={showCropDialog}
        onClose={() => {
          setShowCropDialog(false);
          setTempImageUrl("");
        }}
        onCropComplete={onCropComplete}
        loading={isUploadingAvatar}
      />

      <ShareableCreatorCard
        open={isCreatorCardOpen}
        onOpenChange={setIsCreatorCardOpen}
        profile={{
          full_name: profile.full_name || "",
          role: profile.role || "",
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          badge: profile.badge,
          level: profile.level,
          xp: profile.xp,
          location: profile.location,
          professional_skills: profile.professional_skills as Array<{ skill: string }> | null,
        }}
      />
    </>
  );
};
