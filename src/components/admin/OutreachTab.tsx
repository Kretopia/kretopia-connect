import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Download, 
  ExternalLink, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Globe, 
  Copy, 
  Search,
  Users,
  CheckCircle,
  Clock,
  MessageSquare
} from "lucide-react";

interface UnclaimedProfile {
  user_id: string;
  full_name: string;
  role: string | null;
  location: string | null;
  website: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  spotify_url: string | null;
  youtube_url: string | null;
  profile_source: string | null;
  created_at: string;
}

export function OutreachTab() {
  const [profiles, setProfiles] = useState<UnclaimedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchUnclaimedProfiles();
  }, []);

  const fetchUnclaimedProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          user_id,
          full_name,
          role,
          location,
          website,
          instagram_url,
          twitter_url,
          linkedin_url,
          spotify_url,
          youtube_url,
          profile_source,
          created_at
        `)
        .eq("is_claimed", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error("Error fetching profiles:", error);
      toast.error("Failed to fetch unclaimed profiles");
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const profilesWithSocial = filteredProfiles.filter(p => 
    p.instagram_url || p.twitter_url || p.linkedin_url || p.website
  );

  const copyProfileLink = (userId: string) => {
    const url = `https://www.kretopia.com/profile/${userId}`;
    navigator.clipboard.writeText(url);
    toast.success("Profile link copied!");
  };

  const copyOutreachMessage = (profile: UnclaimedProfile) => {
    const message = `Hey ${profile.full_name?.split(' ')[0] || 'there'}! 
I found your profile while building Kretopia - a new platform for creatives to connect and collaborate.

We've already started building out your professional profile: https://www.kretopia.com/profile/${profile.user_id}

Would love for you to claim it and join our community of ${profiles.length}+ creatives!

Let me know if you have any questions 🙌`;
    
    navigator.clipboard.writeText(message);
    toast.success("Outreach message copied!");
  };

  const exportToCSV = () => {
    const headers = ["Name", "Role", "Location", "Website", "Instagram", "Twitter", "LinkedIn", "Profile Link", "Source"];
    const rows = filteredProfiles.map(p => [
      p.full_name || "",
      p.role || "",
      p.location || "",
      p.website || "",
      p.instagram_url || "",
      p.twitter_url || "",
      p.linkedin_url || "",
      `https://www.kretopia.com/profile/${p.user_id}`,
      p.profile_source || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kretopia-unclaimed-profiles-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    
    toast.success(`Exported ${filteredProfiles.length} profiles to CSV`);
  };

  const getSocialIcon = (url: string | null, type: string) => {
    if (!url) return null;
    
    const icons: Record<string, JSX.Element> = {
      instagram: <Instagram className="h-4 w-4" />,
      twitter: <Twitter className="h-4 w-4" />,
      linkedin: <Linkedin className="h-4 w-4" />,
      website: <Globe className="h-4 w-4" />,
    };

    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="p-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {icons[type]}
      </a>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{profiles.length}</p>
                <p className="text-xs text-muted-foreground">Total Unclaimed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{profilesWithSocial.length}</p>
                <p className="text-xs text-muted-foreground">With Social Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Contacted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Claimed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export & Outreach Tools
          </CardTitle>
          <CardDescription>
            Export profiles for manual outreach or use the built-in tools below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export All to CSV ({filteredProfiles.length})
            </Button>
            <Button 
              onClick={() => {
                const withSocial = profiles.filter(p => p.instagram_url || p.twitter_url || p.linkedin_url);
                const csvContent = [
                  ["Name", "Role", "Instagram", "Twitter", "LinkedIn", "Profile Link"].join(","),
                  ...withSocial.map(p => [
                    `"${p.full_name || ""}"`,
                    `"${p.role || ""}"`,
                    `"${p.instagram_url || ""}"`,
                    `"${p.twitter_url || ""}"`,
                    `"${p.linkedin_url || ""}"`,
                    `"https://www.kretopia.com/profile/${p.user_id}"`
                  ].join(","))
                ].join("\n");

                const blob = new Blob([csvContent], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `kretopia-outreach-targets-${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                toast.success(`Exported ${withSocial.length} profiles with social links`);
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Export Outreach Targets ({profilesWithSocial.length})
            </Button>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg text-sm">
            <p className="font-medium mb-2">Outreach Tips:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• DM on Instagram/Twitter with their profile link</li>
              <li>• Use LinkedIn InMail for professional creatives</li>
              <li>• Personalize message with their role/credits</li>
              <li>• Follow up after 3-5 days if no response</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Profile List */}
      <Card>
        <CardHeader>
          <CardTitle>Unclaimed Profiles</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or role..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading profiles...</div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredProfiles.map((profile) => (
                  <div 
                    key={profile.user_id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{profile.full_name}</span>
                        {profile.profile_source && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {profile.profile_source}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {profile.role || "No role specified"}
                        {profile.location && ` • ${profile.location}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {/* Social Links */}
                      {getSocialIcon(profile.instagram_url, 'instagram')}
                      {getSocialIcon(profile.twitter_url, 'twitter')}
                      {getSocialIcon(profile.linkedin_url, 'linkedin')}
                      {getSocialIcon(profile.website, 'website')}

                      {/* Actions */}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyProfileLink(profile.user_id)}
                        title="Copy profile link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyOutreachMessage(profile)}
                        title="Copy outreach message"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <a 
                        href={`https://www.kretopia.com/profile/${profile.user_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm" title="View profile">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}

                {filteredProfiles.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No profiles found matching your search
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
