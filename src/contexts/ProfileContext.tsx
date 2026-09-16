import { createContext, useContext, useState, ReactNode } from "react";
import type { Profile } from "@/lib/profile/profileService";

interface ProfileContextType {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  portfolioItems: any[];
  setPortfolioItems: (items: any[]) => void;
  reviews: any[];
  setReviews: (reviews: any[]) => void;
  companyReviews: any[];
  setCompanyReviews: (reviews: any[]) => void;
  partnerDiscounts: any[];
  setPartnerDiscounts: (discounts: any[]) => void;
  industryStats: any[];
  setIndustryStats: (stats: any[]) => void;
  credits: any[];
  setCredits: (credits: any[]) => void;
  awards: any[];
  setAwards: (awards: any[]) => void;
  pressLinks: any[];
  setPressLinks: (links: any[]) => void;
  userBadge: 'og' | 'beta' | 'official' | 'founder' | 'odos' | 'founding_member' | null;
  setUserBadge: (badge: 'og' | 'beta' | 'official' | 'founder' | 'odos' | 'founding_member' | null) => void;
  stats: {
    circle: number;
    projects: number;
    responseRate: number;
  };
  setStats: (stats: any) => void;
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [companyReviews, setCompanyReviews] = useState([]);
  const [partnerDiscounts, setPartnerDiscounts] = useState([]);
  const [industryStats, setIndustryStats] = useState([]);
  const [credits, setCredits] = useState([]);
  const [awards, setAwards] = useState([]);
  const [pressLinks, setPressLinks] = useState([]);
  const [userBadge, setUserBadge] = useState<'og' | 'beta' | 'official' | 'founder' | 'odos' | 'founding_member' | null>(null);
  const [stats, setStats] = useState({
    circle: 0,
    projects: 0,
    responseRate: 98
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        setProfile,
        portfolioItems,
        setPortfolioItems,
        reviews,
        setReviews,
        companyReviews,
        setCompanyReviews,
        partnerDiscounts,
        setPartnerDiscounts,
        industryStats,
        setIndustryStats,
        credits,
        setCredits,
        awards,
        setAwards,
        pressLinks,
        setPressLinks,
        userBadge,
        setUserBadge,
        stats,
        setStats,
        currentUserId,
        setCurrentUserId,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfileContext = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfileContext must be used within ProfileProvider");
  }
  return context;
};
