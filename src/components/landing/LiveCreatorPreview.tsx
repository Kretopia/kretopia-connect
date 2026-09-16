import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, MapPin } from "lucide-react";

interface CreatorCard {
  full_name: string;
  avatar_url: string | null;
  role: string;
  location: string | null;
  badge: string | null;
}

export const LiveCreatorPreview = () => {
  const [creators, setCreators] = useState<CreatorCard[]>([]);

  useEffect(() => {
    const fetchCreators = async () => {
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("full_name, avatar_url, role, location, badge")
        .not("avatar_url", "is", null)
        .not("full_name", "is", null)
        .limit(8);

      if (data && data.length > 0) {
        const shuffled = data.sort(() => Math.random() - 0.5);
        setCreators(shuffled.slice(0, 6));
      }
    };
    fetchCreators();
  }, []);

  if (creators.length < 3) return null;

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="container mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary/90 mb-6">
          <Users className="h-3.5 w-3.5" />
          Real creators, real profiles
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-8">
          They're already <span className="text-primary">building</span> on Kretopia
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
          {creators.map((creator, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-border/60 bg-card/80 p-4 text-center transition-all hover:border-primary/40 hover:shadow-card"
            >
              <Avatar className="mx-auto h-14 w-14 sm:h-16 sm:w-16 ring-2 ring-primary/20 mb-3">
                <AvatarImage src={creator.avatar_url || ""} alt={creator.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {creator.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold text-sm truncate">{creator.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{creator.role}</p>
              {creator.location && (
                <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5" />
                  {creator.location}
                </p>
              )}
              {creator.badge && creator.badge !== "none" && (
                <Badge variant="outline" className="mt-2 text-[10px] border-primary/30 text-primary">
                  {creator.badge === "og" ? "OG" : creator.badge === "founder" ? "Founder" : "Beta"}
                </Badge>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Your next collaborator is already here — sign up in 60 seconds
        </p>
      </div>
    </section>
  );
};
