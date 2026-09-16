import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter, X, Lock, Sparkles, Crown, Zap, CheckCircle, Star, Users, MapPin, Briefcase, Target, Wrench, Clock, Navigation } from "lucide-react";
import { ROLE_OPTIONS } from "@/components/profile/ProfileEditDialog";
import { LOCATION_HIERARCHY } from "@/lib/locationGroups";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface SwipeFiltersState {
  roles: string[];
  locationCountry: string;
  locationCity: string;
  nearMe: boolean;
  userLat?: number | null;
  userLon?: number | null;
  collabIntent: string;
  // Pro filters
  verifiedOnly: boolean;
  minFollowers: string;
  experienceLevel: string;
  aiMatchOnly: boolean;
  skills: string[];
  availability: string;
  // Legacy compat
  role: string;
  location: string;
}

interface SwipeFiltersProps {
  filters: SwipeFiltersState;
  onFiltersChange: (filters: SwipeFiltersState) => void;
  isPro?: boolean;
  profilesCount?: number;
}

const COLLAB_INTENT_OPTIONS = [
  { value: 'all', label: 'Any Intent', icon: Target },
  { value: 'looking_to_hire', label: 'Hiring', emoji: '' },
  { value: 'available_for_hire', label: 'Available', emoji: '✋' },
  { value: 'open_to_trade', label: 'Open to Trade', emoji: '' },
  { value: 'seeking_collaborators', label: 'Seeking Collaborators', emoji: '' },
  { value: 'just_networking', label: 'Networking', emoji: '' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'all', label: 'Any Level' },
  { value: 'beginner', label: 'Beginner (0-2 yrs)', emoji: '🌱' },
  { value: 'intermediate', label: 'Intermediate (3-5 yrs)', emoji: '' },
  { value: 'experienced', label: 'Experienced (5-10 yrs)', emoji: '' },
  { value: 'expert', label: 'Expert (10+ yrs)', emoji: '' },
];

const FOLLOWER_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: '1000', label: '1K+' },
  { value: '5000', label: '5K+' },
  { value: '10000', label: '10K+' },
  { value: '50000', label: '50K+' },
  { value: '100000', label: '100K+' },
];

const SKILL_OPTIONS = [
  // Music & Audio
  'Music Production', 'Songwriting', 'Audio Engineering', 'Sound Design', 'DJing',
  'Singing', 'Rapping', 'Instrument Performance', 'Mixing & Mastering', 'Composing',
  'Beat Making', 'Soca Production',
  // Film & Video
  'Videography', 'Video Editing', 'Directing', 'Cinematography', 'Screenwriting',
  'VFX', 'Color Grading', 'Animation', 'Motion Graphics', 'Acting', 'Voice Over',
  'Film Production', 'Drone Cinematography',
  // Design & Visual
  'Graphic Design', 'Illustration', 'Photography', 'UI/UX', 'Branding',
  '3D Modeling', 'Web Design', 'Art Direction', 'Set Design', 'Typography',
  'Concept Art', 'Product Photography',
  // Fashion & Beauty
  'Styling', 'Makeup Artistry', 'Fashion Design', 'Costume Design',
  'Hair Styling', 'Wardrobe Styling', 'Pattern Making', 'Textile Design',
  'Nail Art', 'Fashion Photography', 'Carnival/Mas Design', 'Modeling',
  'Fashion Illustration', 'Accessory Design', 'Wig Making',
  // Content & Digital
  'Content Creation', 'Social Media', 'Copywriting', 'Blogging',
  'Influencer Marketing', 'Livestreaming', 'Podcasting', 'UGC Creation',
  'Short-Form Video', 'Community Management',
  // Business & Production
  'Marketing', 'PR & Communications', 'Web Development', 'App Development',
  'Event Production', 'Project Management', 'Creative Direction',
  // Performing Arts
  'Dance', 'Choreography', 'Stand-up Comedy', 'Hosting/MCing',
];

const AVAILABILITY_OPTIONS = [
  { value: 'all', label: 'Any Availability' },
  { value: 'available_now', label: '🟢 Available Now' },
  { value: 'available_soon', label: '🟡 Available Soon' },
  { value: 'open_to_offers', label: 'Open to Offers' },
  { value: 'booked', label: '🔴 Currently Booked' },
];

// Role categories for grouped display
const ROLE_CATEGORIES: { label: string; roles: string[] }[] = [
  {
    label: 'Music & Audio',
    roles: ['Musician', 'DJ', 'Soca Artist', 'Rapper', 'Singer', 'Songwriter', 'Music Producer', 'Audio Engineer', 'Sound Designer', 'Composer', 'Mixing Engineer', 'Mastering Engineer', 'Music Manager', 'A&R'],
  },
  {
    label: 'Film & Video',
    roles: ['Filmmaker', 'Videographer', 'Director', 'Cinematographer', 'Screenwriter', 'Video Editor', 'VFX Artist', 'Colorist', 'Camera Operator', 'Gaffer', 'Grip', 'Production Assistant', 'Casting Director', 'Stunt Coordinator'],
  },
  {
    label: 'Design & Visual Arts',
    roles: ['Graphic Designer', 'Illustrator', 'Photographer', 'Animator', 'Motion Designer', '3D Artist', 'UI/UX Designer', 'Art Director', 'Creative Director', 'Set Designer', 'Muralist', 'Fine Artist', 'Concept Artist', 'Tattoo Artist'],
  },
  {
    label: 'Digital & Content',
    roles: ['Content Creator', 'Influencer', 'Streamer', 'Podcaster', 'Blogger', 'YouTuber', 'TikToker', 'Social Media Manager', 'Community Manager', 'Copywriter', 'Technical Writer', 'Journalist', 'UGC Creator', 'Brand Ambassador', 'Newsletter Creator'],
  },
  {
    label: '👗 Fashion & Beauty',
    roles: ['Fashion Designer', 'Stylist', 'Makeup Artist', 'Hair Stylist', 'Costume Designer', 'Wardrobe Stylist', 'Carnival/Mas Designer', 'Model', 'Fashion Photographer', 'Nail Technician', 'Jewelry Designer', 'Textile Designer', 'Fashion Illustrator', 'Wig Maker', 'Personal Shopper'],
  },
  {
    label: 'Business & Tech',
    roles: ['Brand Strategist', 'Marketing Manager', 'PR Specialist', 'Talent Manager', 'Promoter', 'Booking Agent', 'Event Producer', 'Project Manager', 'Web Developer', 'App Developer', 'Product Designer', 'Data Analyst'],
  },
  {
    label: 'Performing Arts',
    roles: ['Actor', 'Voice Actor', 'Dancer', 'Choreographer', 'Stand-up Comedian', 'MC/Host', 'Stage Manager'],
  },
];

export const DEFAULT_SWIPE_FILTERS: SwipeFiltersState = {
  roles: [],
  locationCountry: 'all',
  locationCity: 'all',
  nearMe: false,
  userLat: null,
  userLon: null,
  collabIntent: 'all',
  verifiedOnly: false,
  minFollowers: 'all',
  experienceLevel: 'all',
  aiMatchOnly: false,
  skills: [],
  availability: 'all',
  // Legacy compat
  role: 'all',
  location: 'all',
};

export function SwipeFilters({ filters, onFiltersChange, isPro = false, profilesCount = 0 }: SwipeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const navigate = useNavigate();

  const clearFilters = () => {
    onFiltersChange(DEFAULT_SWIPE_FILTERS);
  };

  const selectedCountry = LOCATION_HIERARCHY.find(c => c.value === filters.locationCountry);

  const handleNearMe = () => {
    if (filters.nearMe) {
      // Toggle off
      onFiltersChange({ ...filters, nearMe: false, userLat: null, userLon: null });
      return;
    }
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onFiltersChange({
          ...filters,
          nearMe: true,
          userLat: position.coords.latitude,
          userLon: position.coords.longitude,
          locationCountry: 'all',
          locationCity: 'all',
        });
        setDetectingLocation(false);
      },
      () => {
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.roles.length > 0) count++;
    if (filters.locationCountry !== 'all') count++;
    if (filters.locationCity !== 'all') count++;
    if (filters.nearMe) count++;
    if (filters.collabIntent !== 'all') count++;
    if (filters.verifiedOnly) count++;
    if (filters.minFollowers !== 'all') count++;
    if (filters.experienceLevel !== 'all') count++;
    if (filters.aiMatchOnly) count++;
    if (filters.skills.length > 0) count++;
    if (filters.availability !== 'all') count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  const FilterSection = ({ title, icon: Icon, children, isPremium = false }: { 
    title: string; 
    icon: React.ElementType; 
    children: React.ReactNode;
    isPremium?: boolean;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", isPremium ? "text-amber-500" : "text-muted-foreground")} />
        <span className={cn("text-sm font-medium", isPremium && "text-amber-500")}>{title}</span>
        {isPremium && !isPro && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-500">
            <Lock className="h-2.5 w-2.5 mr-0.5" />
            Pro
          </Badge>
        )}
      </div>
      {children}
    </div>
  );

  const ProLockedOverlay = ({ children }: { children: React.ReactNode }) => (
    <div className="relative">
      <div className="blur-[2px] pointer-events-none opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Button 
          size="sm" 
          className="gap-1.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg"
          onClick={() => navigate('/subscription')}
        >
          <Crown className="h-3 w-3" />
          Unlock Pro
        </Button>
      </div>
    </div>
  );

  const toggleRole = (roleValue: string) => {
    const currentRoles = filters.roles || [];
    const newRoles = currentRoles.includes(roleValue)
      ? currentRoles.filter(r => r !== roleValue)
      : [...currentRoles, roleValue];
    onFiltersChange({ ...filters, roles: newRoles, role: newRoles.length === 1 ? newRoles[0] : 'all' });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="text-left pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Match Filters
            </SheetTitle>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground">
                  <X className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {profilesCount} creators match your filters
          </p>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto flex-1 pb-24">
          {/* AI Match - Pro Feature */}
          <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">AI Smart Match</span>
                    {!isPro && (
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px]">
                        Pro
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Only show high-compatibility matches</p>
                </div>
              </div>
              {isPro ? (
                <Switch
                  checked={filters.aiMatchOnly}
                  onCheckedChange={(checked) => onFiltersChange({ ...filters, aiMatchOnly: checked })}
                />
              ) : (
                <Button 
                  size="sm" 
                  className="gap-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  onClick={() => navigate('/subscription')}
                >
                  <Crown className="h-3 w-3" />
                  Unlock
                </Button>
              )}
            </div>
          </div>

          {/* Basic Filters */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3 w-3" />
              Basic Filters
            </div>
            
            {/* Location — Two-tier: Near Me / Country / City */}
            <FilterSection title="Location" icon={MapPin}>
              <div className="space-y-3">
                {/* Near Me button */}
                <Button
                  variant={filters.nearMe ? "default" : "outline"}
                  size="sm"
                  className="gap-2 w-full justify-start"
                  onClick={handleNearMe}
                  disabled={detectingLocation}
                >
                  <Navigation className="h-4 w-4" />
                  {detectingLocation ? 'Detecting...' : filters.nearMe ? 'Showing Near Me' : 'Near Me — Use my location'}
                </Button>

                {!filters.nearMe && (
                  <div className="grid grid-cols-1 gap-2">
                    {/* Country */}
                    <Select 
                      value={filters.locationCountry} 
                      onValueChange={(value) => onFiltersChange({ ...filters, locationCountry: value, locationCity: 'all', nearMe: false })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Countries</SelectItem>
                        {LOCATION_HIERARCHY.map(country => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.flag} {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* City — only shows when a country is selected */}
                    {selectedCountry && selectedCountry.cities.length > 0 && (
                      <Select 
                        value={filters.locationCity} 
                        onValueChange={(value) => onFiltersChange({ ...filters, locationCity: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Cities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All {selectedCountry.label}</SelectItem>
                          {selectedCountry.cities.map(city => (
                            <SelectItem key={city.value} value={city.value}>
                              {city.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            </FilterSection>

            {/* Roles — Multi-select chips grouped by category */}
            <FilterSection title="Roles" icon={Briefcase}>
              <div className="space-y-3">
                {filters.roles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {filters.roles.map(r => (
                      <Badge
                        key={r}
                        variant="default"
                        className="text-xs cursor-pointer gap-1 pr-1"
                        onClick={() => toggleRole(r)}
                      >
                        {r}
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground px-2"
                      onClick={() => onFiltersChange({ ...filters, roles: [], role: 'all' })}
                    >
                      Clear
                    </Button>
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
                  {ROLE_CATEGORIES.map(category => (
                    <div key={category.label} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{category.label}</p>
                      <div className="flex flex-wrap gap-1">
                        {category.roles.map(role => (
                          <Button
                            key={role}
                            variant={(filters.roles || []).includes(role) ? "default" : "outline"}
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => toggleRole(role)}
                          >
                            {role}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {filters.roles.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {filters.roles.length} role{filters.roles.length !== 1 ? 's' : ''} selected — showing any match
                  </p>
                )}
              </div>
            </FilterSection>

            {/* Collaboration Intent */}
            <FilterSection title="Looking to" icon={Target}>
              <Select 
                value={filters.collabIntent} 
                onValueChange={(value) => onFiltersChange({ ...filters, collabIntent: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any Intent" />
                </SelectTrigger>
                <SelectContent>
                  {COLLAB_INTENT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {'emoji' in opt ? `${opt.emoji} ${opt.label}` : opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>
          </div>

          {/* Pro Filters Section */}
          <div className="pt-4 border-t space-y-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
              <Crown className="h-3 w-3 text-amber-500" />
              <span className="text-amber-500">Pro Filters</span>
            </div>

            {isPro ? (
              <>
                <FilterSection title="Verification" icon={CheckCircle} isPremium>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="text-sm font-medium">Verified Creators Only</p>
                      <p className="text-xs text-muted-foreground">Show only verified profiles</p>
                    </div>
                    <Switch
                      checked={filters.verifiedOnly}
                      onCheckedChange={(checked) => onFiltersChange({ ...filters, verifiedOnly: checked })}
                    />
                  </div>
                </FilterSection>

                <FilterSection title="Minimum Followers" icon={Users} isPremium>
                  <div className="flex flex-wrap gap-2">
                    {FOLLOWER_OPTIONS.map(opt => (
                      <Button
                        key={opt.value}
                        variant={filters.minFollowers === opt.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => onFiltersChange({ ...filters, minFollowers: opt.value })}
                        className="text-xs"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </FilterSection>

                <FilterSection title="Experience Level" icon={Star} isPremium>
                  <Select 
                    value={filters.experienceLevel}
                    onValueChange={(value) => onFiltersChange({ ...filters, experienceLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any Experience" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {'emoji' in opt ? `${opt.emoji} ${opt.label}` : opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterSection>

                <FilterSection title="Skills" icon={Wrench} isPremium>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {SKILL_OPTIONS.map(skill => (
                      <Button
                        key={skill}
                        variant={filters.skills.includes(skill) ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          const newSkills = filters.skills.includes(skill)
                            ? filters.skills.filter(s => s !== skill)
                            : [...filters.skills, skill];
                          onFiltersChange({ ...filters, skills: newSkills });
                        }}
                      >
                        {skill}
                      </Button>
                    ))}
                  </div>
                  {filters.skills.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {filters.skills.length} skill{filters.skills.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </FilterSection>

                <FilterSection title="Availability" icon={Clock} isPremium>
                  <Select
                    value={filters.availability}
                    onValueChange={(value) => onFiltersChange({ ...filters, availability: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any Availability" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterSection>
              </>
            ) : (
              <div className="space-y-4">
                {/* Compelling pro upsell */}
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 text-center space-y-3">
                  <Crown className="h-8 w-8 text-amber-500 mx-auto" />
                  <div>
                    <h4 className="font-semibold text-sm">Find Your Perfect Match Faster</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unlock 6 powerful filters: Verified Only, Follower Count, Experience Level, Skills, Availability, and AI Smart Match.
                    </p>
                  </div>
                  <Button 
                    className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg"
                    onClick={() => navigate('/subscription')}
                  >
                    <Crown className="h-4 w-4" />
                    Upgrade to Creator+
                  </Button>
                </div>

                {/* Blurred preview of what they're missing */}
                <div className="blur-[2px] pointer-events-none opacity-40 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="text-sm font-medium">Verified Creators Only</p>
                      <p className="text-xs text-muted-foreground">Show only verified profiles</p>
                    </div>
                    <Switch disabled />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled className="text-xs">1K+</Button>
                    <Button variant="outline" size="sm" disabled className="text-xs">10K+</Button>
                    <Button variant="outline" size="sm" disabled className="text-xs">100K+</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="outline" size="sm" disabled className="text-xs h-7 px-2">Photography</Button>
                    <Button variant="outline" size="sm" disabled className="text-xs h-7 px-2">Music Production</Button>
                    <Button variant="outline" size="sm" disabled className="text-xs h-7 px-2">Videography</Button>
                    <Button variant="outline" size="sm" disabled className="text-xs h-7 px-2">Design</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="border-t pt-4 pb-2">
          <Button
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
            onClick={() => setIsOpen(false)}
          >
            Show {profilesCount} Creator{profilesCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
