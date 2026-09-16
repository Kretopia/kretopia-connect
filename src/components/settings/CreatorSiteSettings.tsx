import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, ExternalLink, Copy, CheckCircle2, Loader2, PenLine, AtSign } from "lucide-react";
import { APP_URL } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const RESERVED = new Set([
  "admin", "settings", "website-builder", "api", "auth", "login", "signup",
  "site", "profile", "notifications", "messages", "discover", "circle",
  "wallet", "subscription", "spotlight", "magazine", "podcast", "fund",
  "ambassadors", "claim", "verify", "share", "support", "terms", "privacy",
  "thrive", "thrivein", "kretopia", "www", "app", "root", "system",
]);

const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

const normalize = (v: string) => v.trim().toLowerCase().replace(/^@/, "");

const validate = (v: string): string | null => {
  if (!v) return "Username is required";
  if (!USERNAME_RE.test(v)) return "3–30 chars, lowercase letters, numbers, _ or -";
  if (RESERVED.has(v)) return "That username is reserved";
  return null;
};

/**
 * Slim Creator Site card for /settings.
 * Inline username editing; full editor lives in /website-builder.
 */
export const CreatorSiteSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [siteEnabled, setSiteEnabled] = useState(false);
  const [savedUsername, setSavedUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewHandle = normalize(usernameInput);
  const liveSiteUrl = savedUsername
    ? `${APP_URL}/${savedUsername}`
    : user
    ? `${APP_URL}/site/${user.id}`
    : "";
  const previewUrl = previewHandle ? `${APP_URL}/${previewHandle}` : liveSiteUrl;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("site_enabled, username")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSiteEnabled((data as any).site_enabled || false);
          const u = (data as any).username || "";
          setSavedUsername(u);
          setUsernameInput(u);
        }
        setLoading(false);
      });
  }, [user?.id]);

  const handleToggle = async (enabled: boolean) => {
    if (!user) return;
    setSavingToggle(true);
    const { error } = await supabase
      .from("profiles")
      .update({ site_enabled: enabled })
      .eq("user_id", user.id);
    setSavingToggle(false);
    if (error) {
      toast({ title: "Couldn't update site", description: error.message, variant: "destructive" });
      return;
    }
    setSiteEnabled(enabled);
    toast({ title: enabled ? "Creator site enabled" : "Creator site disabled" });
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    const next = normalize(usernameInput);
    const err = validate(next);
    if (err) {
      setUsernameError(err);
      return;
    }
    if (next === savedUsername) {
      setUsernameError(null);
      return;
    }
    setSavingUsername(true);
    setUsernameError(null);

    // Uniqueness check
    const { data: taken, error: checkErr } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", next)
      .neq("user_id", user.id)
      .maybeSingle();

    if (checkErr) {
      setSavingUsername(false);
      setUsernameError(checkErr.message);
      return;
    }
    if (taken) {
      setSavingUsername(false);
      setUsernameError("That username is already taken");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: next })
      .eq("user_id", user.id);

    setSavingUsername(false);
    if (error) {
      setUsernameError(error.message);
      return;
    }
    setSavedUsername(next);
    setUsernameInput(next);
    toast({ title: "Username saved", description: `Your site is live at ${APP_URL}/${next}` });
  };

  const handleCopy = async () => {
    if (!liveSiteUrl) return;
    await navigator.clipboard.writeText(liveSiteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const dirty = normalize(usernameInput) !== savedUsername && usernameInput.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Creator Site
        </CardTitle>
        <CardDescription>
          Your public creator website. Build and customize it in the Website Builder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="site-enabled" className="flex flex-col gap-1">
            <span>Enable Creator Site</span>
            <span className="text-sm font-normal text-muted-foreground">
              Make your site reachable at a public URL
            </span>
          </Label>
          <Switch
            id="site-enabled"
            checked={siteEnabled}
            disabled={loading || savingToggle}
            onCheckedChange={handleToggle}
          />
        </div>

        {/* Username editor */}
        <div className="space-y-2">
          <Label htmlFor="creator-username" className="flex items-center gap-2">
            <AtSign className="h-4 w-4" />
            Username
          </Label>
          <div className="flex gap-2">
            <Input
              id="creator-username"
              value={usernameInput}
              onChange={(e) => {
                setUsernameInput(e.target.value);
                if (usernameError) setUsernameError(null);
              }}
              placeholder="your-handle"
              disabled={loading || savingUsername}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
            />
            <Button
              onClick={handleSaveUsername}
              disabled={loading || savingUsername || !dirty}
              className="shrink-0"
            >
              {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          {usernameError ? (
            <p className="text-xs text-destructive">{usernameError}</p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">
              Preview: <span className="font-mono">{previewUrl}</span>
            </p>
          )}
        </div>

        {/* Live URL block */}
        {siteEnabled && (
          <div className="rounded-lg border p-3 flex items-center gap-2 bg-muted/40">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <code className="text-xs flex-1 truncate">{liveSiteUrl}</code>
            <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2">
              {copied ? <CheckCircle2 className="h-4 w-4 text-energy" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(liveSiteUrl, "_blank")}
              className="h-7 px-2"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button
          variant="default"
          onClick={() => navigate("/website-builder")}
          className="w-full"
        >
          <PenLine className="h-4 w-4 mr-2" />
          Open Website Builder
        </Button>
      </CardContent>
    </Card>
  );
};
