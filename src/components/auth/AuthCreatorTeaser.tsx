import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

interface TeaserCreator {
  full_name: string;
  avatar_url: string | null;
  role: string;
}

export const AuthCreatorTeaser = () => {
  const [creators, setCreators] = useState<TeaserCreator[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("full_name, avatar_url, role")
        .not("avatar_url", "is", null)
        .limit(12);
      if (data) setCreators(data.sort(() => Math.random() - 0.5).slice(0, 5));
    };
    fetch();
  }, []);

  if (creators.length < 3) return null;

  return (
    <div className="mt-8 rounded-xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm">
      <p className="text-xs font-medium text-muted-foreground mb-3">
        Creators you could match with today:
      </p>
      <div className="flex items-center -space-x-2 mb-2">
        {creators.map((c, i) => (
          <Avatar key={i} className="h-9 w-9 ring-2 ring-background">
            <AvatarImage src={c.avatar_url || ""} alt={c.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {c.full_name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ))}
        <div className="h-9 w-9 rounded-full bg-primary/10 ring-2 ring-background flex items-center justify-center text-xs font-bold text-primary">
          +
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {creators.slice(0, 3).map((c, i) => (
          <span key={i} className="text-[11px] text-muted-foreground">
            {c.full_name.split(" ")[0]} · <span className="text-foreground/70">{c.role}</span>
            {i < 2 && " ·"}
          </span>
        ))}
      </div>
    </div>
  );
};
