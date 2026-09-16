import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, Film, Music, Youtube, Instagram, Globe, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PLATFORMS = [
  { id: 'imdb', label: 'IMDb', icon: Film, placeholder: 'https://imdb.com/name/nm...', color: 'text-yellow-600' },
  { id: 'spotify', label: 'Spotify', icon: Music, placeholder: 'https://open.spotify.com/artist/...', color: 'text-green-500' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@...', color: 'text-red-500' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/...', color: 'text-primary' },
  { id: 'other', label: 'Other URL', icon: Globe, placeholder: 'https://...', color: 'text-muted-foreground' },
];

interface CrossPlatformImportProps {
  currentUserId: string;
  onImported?: () => void;
}

export const CrossPlatformImport = ({ currentUserId, onImported }: CrossPlatformImportProps) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState<string[]>([]);

  const handleImport = async () => {
    if (!url.trim() || !selectedPlatform) return;

    setLoading(true);
    try {
      // Save to connected_platforms
      await supabase.from('connected_platforms').upsert({
        user_id: currentUserId,
        platform: selectedPlatform,
        platform_username: url.trim(),
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' });

      // Update profile with platform URL
      const urlField = {
        imdb: 'imdb_url',
        spotify: 'spotify_url',
        youtube: 'youtube_url',
        instagram: 'instagram_url',
      }[selectedPlatform];

      if (urlField) {
        await supabase.from('profiles')
          .update({ [urlField]: url.trim() })
          .eq('user_id', currentUserId);
      }

      setImported(prev => [...prev, selectedPlatform]);
      toast.success(`${PLATFORMS.find(p => p.id === selectedPlatform)?.label} linked! Credits will be auto-imported.`);
      setUrl("");
      setSelectedPlatform(null);
      onImported?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to link platform");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Cross-Platform Import
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Link your profiles to auto-import verified credits from other platforms
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map(platform => {
            const Icon = platform.icon;
            const isImported = imported.includes(platform.id);
            return (
              <Button
                key={platform.id}
                variant={selectedPlatform === platform.id ? "default" : "outline"}
                size="sm"
                className="h-10 gap-2 text-xs justify-start relative"
                onClick={() => setSelectedPlatform(platform.id)}
                disabled={isImported}
              >
                <Icon className={`h-4 w-4 ${isImported ? 'text-green-500' : platform.color}`} />
                {platform.label}
                {isImported && (
                  <CheckCircle2 className="h-3 w-3 text-green-500 absolute right-2" />
                )}
              </Button>
            );
          })}
        </div>

        {selectedPlatform && (
          <div className="flex gap-2 mt-2">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={PLATFORMS.find(p => p.id === selectedPlatform)?.placeholder}
              className="h-9 text-xs flex-1"
            />
            <Button size="sm" className="h-9 gap-1 text-xs" onClick={handleImport} disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
              Link
            </Button>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Credits from linked platforms receive higher verification scores and appear with platform badges on your EPK.
        </p>
      </CardContent>
    </Card>
  );
};
