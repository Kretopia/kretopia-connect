import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Crown, Shield, MessageSquare, User, Sparkles, Star, Gem, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Member {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  bio?: string;
  joined_at?: string;
}

interface CircleMemberDirectoryProps {
  members: Member[];
  onMessage?: (userId: string) => void;
}

const ROLE_ORDER: Record<string, number> = { admin: 0, moderator: 1, mentor: 2, featured: 3, vip: 4, og: 5, member: 6 };

const roleDisplay = (role: string) => {
  switch (role) {
    case "admin": return { icon: Crown, label: "Admin", className: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    case "moderator": return { icon: Shield, label: "Mod", className: "text-primary bg-primary/10 border-primary/20" };
    case "mentor": return { icon: Sparkles, label: "Mentor", className: "text-primary bg-primary/10 border-primary/20" };
    case "featured": return { icon: Star, label: "Featured", className: "text-amber-600 bg-amber-500/10 border-amber-500/20" };
    case "vip": return { icon: Gem, label: "VIP", className: "text-primary bg-primary/10 border-primary/20" };
    case "og": return { icon: Trophy, label: "OG", className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
    default: return null;
  }
};

export const CircleMemberDirectory = ({ members, onMessage }: CircleMemberDirectoryProps) => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filteredMembers = useMemo(() => {
    const sorted = [...members].sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));
    if (!search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(m => m.full_name?.toLowerCase().includes(q));
  }, [members, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Member[]> = {};
    filteredMembers.forEach(m => {
      let group: string;
      if (m.role === "admin") group = "Admins";
      else if (m.role === "moderator") group = "Moderators";
      else group = "Members";
      if (!groups[group]) groups[group] = [];
      groups[group].push(m);
    });
    // Sort groups: Admins first, then Moderators, then Members
    const ordered: Record<string, Member[]> = {};
    for (const key of ["Admins", "Moderators", "Members"]) {
      if (groups[key]) ordered[key] = groups[key];
    }
    return ordered;
  }, [filteredMembers]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-8 text-xs bg-muted/50"
        />
      </div>

      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold px-1">
        {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
      </p>

      {Object.entries(grouped).map(([groupName, groupMembers]) => (
        <div key={groupName}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold px-1 mb-1.5">
            {groupName} — {groupMembers.length}
          </p>
          <div className="space-y-0.5">
            {groupMembers.map(m => {
              const rd = roleDisplay(m.role);
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/profile/${m.user_id}`)}
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar_url || ""} />
                      <AvatarFallback className="text-[10px] bg-muted">{m.full_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{m.full_name}</span>
                      {rd && (
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 border", rd.className)}>
                          {rd.icon && <rd.icon className="h-2 w-2 mr-0.5" />}
                          {rd.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {onMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => { e.stopPropagation(); onMessage(m.user_id); }}
                      aria-label={`Message ${m.full_name}`}
                    >
                      <MessageSquare className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
