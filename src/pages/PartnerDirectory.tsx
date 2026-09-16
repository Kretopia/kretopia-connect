import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { PartnerCard } from "@/components/membership/PartnerCard";
import { DigitalMembershipCard } from "@/components/membership/DigitalMembershipCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { SEO } from "@/components/SEO";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";

export default function PartnerDirectory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", user.id)
        .single();

      setProfile(profileData);

      // Fetch partner locations
      const { data: locations } = await supabase
        .from("partner_locations")
        .select("*")
        .eq("is_active", true);

      // Fetch partner discounts
      const { data: discounts } = await supabase
        .from("partner_discounts")
        .select("*")
        .eq("is_active", true);

      // Combine both into a unified list
      const combined = [
        ...(locations || []).map((loc) => ({
          id: loc.id,
          name: loc.name,
          type: loc.type,
          description: loc.description,
          address: loc.address,
          city: loc.city,
          imageUrl: loc.image_url,
          logoUrl: loc.logo_url,
          pointsPerVisit: loc.points_per_visit,
          tierRequired: loc.tier_required,
          source: "location",
        })),
        ...(discounts || []).map((disc) => ({
          id: disc.id,
          name: disc.partner_name,
          type: disc.category,
          description: disc.description,
          discountValue: disc.discount_value,
          discountType: disc.discount_type,
          redemptionCode: disc.redemption_code,
          redemptionUrl: disc.redemption_url,
          logoUrl: disc.partner_logo_url,
          tierRequired: disc.tier_required,
          source: "discount",
        })),
      ];

      setPartners(combined);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ["all", "cafes", "coworking", "studios", "equipment", "wellness", "other"];

  const filteredPartners = activeCategory === "all" 
    ? partners 
    : partners.filter((p) => 
        p.type?.toLowerCase().includes(activeCategory.toLowerCase())
      );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-6 pb-24 max-w-4xl">
          <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-9 w-20 rounded-full bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
                <div className="h-12 w-12 rounded-lg bg-muted" />
                <div className="h-5 w-3/4 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Partner Directory - Exclusive Member Benefits"
        description="Access exclusive discounts and benefits at our partner locations. Earn points with every visit."
      />
      <div className="min-h-screen bg-background pb-24">
        <main className="container mx-auto px-4 pt-6">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => navigate("/membership")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {/* Membership Card */}
            {profile && profile.membership_number && (
              <DigitalMembershipCard
                membershipNumber={profile.membership_number}
                fullName={profile.full_name}
                tier={profile.subscription_tier}
                avatarUrl={profile.avatar_url}
                points={profile.xp || 0}
              />
            )}

            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold">Partner Directory</h1>
              <p className="text-muted-foreground text-lg">
                Exclusive discounts and benefits for Kretopia members
              </p>
            </div>

            {/* Category Tabs */}
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="w-full justify-start overflow-x-auto">
                {categories.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="capitalize">
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeCategory} className="mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPartners.map((partner) => (
                    <PartnerCard
                      key={partner.id}
                      {...partner}
                      userTier={profile?.subscription_tier || "free"}
                      onCheckIn={fetchData}
                    />
                  ))}
                </div>

                {filteredPartners.length === 0 && (
                  <div className="text-center py-12 px-4">
                    <div className="rounded-full bg-muted/50 p-5 mb-4 inline-flex">
                      <Loader2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-2">No partners yet</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Partners and perks will appear here as new deals become available.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </>
  );
}
