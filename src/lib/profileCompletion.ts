import { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface ProfileCompletionStatus {
  percentage: number;
  missingFields: string[];
  completedFields: string[];
  isComplete: boolean;
  completionPercentage: number;
}

export const checkProfileCompletion = (profile: Profile, portfolioCount: number = 0): ProfileCompletionStatus => {
  const fields = [
    { key: 'full_name', label: 'Full Name', value: profile.full_name && profile.full_name !== 'New User' },
    { key: 'role', label: 'Role/Title', value: profile.role && profile.role !== 'Creator' },
    { key: 'bio', label: 'Bio (20+ chars)', value: profile.bio && profile.bio.length > 20 },
    { key: 'avatar_url', label: 'Profile Picture', value: profile.avatar_url },
    { key: 'location', label: 'Location', value: profile.location },
    { key: 'skills', label: 'Skills (3+)', value: (() => {
      const professionalSkills = profile.professional_skills ? 
        (Array.isArray(profile.professional_skills) ? profile.professional_skills.length : Object.keys(profile.professional_skills).length) : 0;
      const passionSkills = profile.passion_skills ? 
        (Array.isArray(profile.passion_skills) ? profile.passion_skills.length : Object.keys(profile.passion_skills).length) : 0;
      return (professionalSkills + passionSkills) >= 3;
    })() },
    { key: 'portfolio', label: 'Work Item (Portfolio or Credit)', value: portfolioCount >= 1 },
  ];

  const completedFields = fields.filter(f => f.value).map(f => f.label);
  const missingFields = fields.filter(f => !f.value).map(f => f.label);
  
  const percentage = Math.round((completedFields.length / fields.length) * 100);
  const isComplete = missingFields.length === 0;

  return {
    percentage,
    missingFields,
    completedFields,
    isComplete,
    completionPercentage: percentage,
  };
};

// Helper to check if a profile meets minimum discovery requirements
// This is used to filter profiles in Discover - QUALITY OVER QUANTITY
// Only profiles meeting these requirements appear in Circle/matching
export const meetsDiscoveryRequirements = (profile: Profile, portfolioCount: number = 0): boolean => {
  // Must have profile picture
  const hasAvatar = !!profile.avatar_url;
  
  // Must have meaningful bio (20+ characters)
  const hasBio = profile.bio && profile.bio.length >= 20;
  
  // Must have at least 1 portfolio item
  const hasPortfolio = portfolioCount >= 1;
  
  return hasAvatar && hasBio && hasPortfolio;
};

// Get the specific missing requirements for discovery
export const getDiscoveryMissingFields = (profile: Profile, portfolioCount: number = 0): string[] => {
  const missing: string[] = [];
  
  if (!profile.avatar_url) {
    missing.push('Profile Picture');
  }
  
  if (!profile.bio || profile.bio.length < 20) {
    missing.push('Bio (20+ characters)');
  }
  
  if (portfolioCount < 1) {
    missing.push('At least 1 Work Item (Portfolio or Credit)');
  }
  
  return missing;
};

export const PROFILE_COMPLETION_BONUS = 50;
