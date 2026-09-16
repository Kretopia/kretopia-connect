import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";

export const useAvatarUpload = () => {
  const { toast } = useToast();
  const { profile, setProfile } = useProfileContext();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const uploadAvatar = async (file: File, editForm: any, setEditForm: any, fetchData: () => Promise<void>) => {
    if (!user) return;

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('[Profile] Updating avatar_url in database:', publicUrl);
      
      // Update the correct field based on account type
      const isCompany = profile?.account_type === 'company';
      const updateData = isCompany 
        ? { company_logo_url: publicUrl, avatar_url: publicUrl }
        : { avatar_url: publicUrl };
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[Profile] Error updating avatar in database:', updateError);
        throw updateError;
      }

      console.log('[Profile] Avatar updated successfully, refreshing profile');
      setProfile({ ...profile!, avatar_url: publicUrl });
      setEditForm({ ...editForm, avatar_url: publicUrl });
      
      // Refresh profile data from database to ensure it persisted
      await fetchData();
      
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    } catch (error) {
      console.error('[Profile] Avatar upload error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadAvatar, isUploading };
};
