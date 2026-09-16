import { useState, useEffect } from "react";
import { Verified, Database, MapPin, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface RealCreator {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
  verification_tier: string | null;
}

/**
 * Shows REAL creator profiles from the database as social proof
 * on the landing page hero. Replaces the old mock "Alex Rivera" card.
 */
export const VisualProofCard = () => {
  const [creators, setCreators] = useState<RealCreator[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role, location, verification_tier")
        .eq("onboarding_completed", true)
        .not("avatar_url", "is", null)
        .not("full_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(12);
      if (data && data.length > 0) {
        const shuffled = data.sort(() => Math.random() - 0.5);
        setCreators(shuffled.slice(0, 6));
      }
    };
    fetch();
  }, []);

  if (creators.length < 2) {
    // Fallback skeleton while loading
    return (
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-center gap-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 w-11 rounded-full bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const featured = creators[0];
  const rest = creators.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="max-w-sm mx-auto"
    >
      {/* Featured creator card */}
      <button
        onClick={() => navigate(`/profile/${featured.user_id}`)}
        className="w-full text-left group"
      >
        <div className="rounded-2xl border border-primary/20 bg-card/90 shadow-xl overflow-hidden hover:border-primary/40 transition-all">
          <div className="h-10 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/10 relative">
            <div className="absolute -bottom-5 left-4">
              <Avatar className="h-10 w-10 border-2 border-card shadow-lg">
                <AvatarImage src={featured.avatar_url || ""} alt={featured.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {featured.full_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div className="pt-7 px-4 pb-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-sm font-bold text-foreground">{featured.full_name}</p>
              {featured.verification_tier && featured.verification_tier !== "none" && (
                <Verified className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mb-0.5">{featured.role || "Creative Professional"}</p>
            {featured.location && (
              <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mb-2">
                <MapPin className="h-2.5 w-2.5" /> {featured.location}
              </p>
            )}

            {/* Other creators row */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center -space-x-2">
                {rest.map((c) => (
                  <Avatar key={c.user_id} className="h-7 w-7 ring-2 ring-card">
                    <AvatarImage src={c.avatar_url || ""} alt={c.full_name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                      {c.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-[10px] text-primary font-medium flex items-center gap-0.5 group-hover:underline">
                View profiles <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </div>
      </button>

      <p className="text-center text-[10px] text-muted-foreground/60 mt-2">
        Real creators building their verified profiles right now
      </p>
    </motion.div>
  );
};
