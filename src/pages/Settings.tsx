import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Bell, Trash2, Download, Eye, EyeOff, Loader2, Settings as SettingsIcon, Smartphone, ExternalLink, Info, ArrowLeft, X, RotateCcw, Share, Plus, CheckCircle2, ArrowRightLeft, CreditCard, Globe, Brain, ChevronRight } from "lucide-react";
import { CreatorSiteSettings } from "@/components/settings/CreatorSiteSettings";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { ManualMergeAccountPanel } from "@/components/account/ManualMergeAccountPanel";
import { Link } from "react-router-dom";
import { NotificationSettings } from "@/components/profile/NotificationSettings";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { BlockedUsersCard } from "@/components/settings/BlockedUsersCard";
import { TelegramConnectCard } from "@/components/settings/TelegramConnectCard";
// TelegramStatusCard intentionally not imported — admin/debug only
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTrinidadVoice } from "@/hooks/useTrinidadVoice";
import { VibePicker } from "@/components/onboarding/VibePicker";
import { Palette } from "lucide-react";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";

interface NotificationPreferences {
  email_matches: boolean;
  email_messages: boolean;
  email_projects: boolean;
  email_opportunities: boolean;
  push_matches: boolean;
  push_messages: boolean;
  push_projects: boolean;
  push_opportunities: boolean;
  in_app_all: boolean;
}

// Restart Tour Button Component
const RestartTourButton = () => {
  const { restartOnboarding, loading } = useOnboarding();
  const { toast } = useToast();

  const handleRestart = async () => {
    await restartOnboarding();
    toast({
      title: "Tour restarted!",
      description: "The onboarding tour will start now.",
    });
    window.location.reload();
  };

  return (
    <Button 
      variant="outline" 
      className="w-full" 
      onClick={handleRestart}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Restarting...
        </>
      ) : (
        <>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restart Platform Tour
        </>
      )}
    </Button>
  );
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface SettingsProps {
  /** Render just the settings sections, without the full-page header/back
   *  button/container — used when mounted inside SettingsDrawer's Sheet,
   *  which already supplies its own title and close affordance. All state
   *  and logic below is identical either way; only the outer chrome differs. */
  embedded?: boolean;
}

const Settings = ({ embedded = false }: SettingsProps = {}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [showPassword, setShowPassword] = useState(false);
  
  // PWA Install
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Email change
  const [newEmail, setNewEmail] = useState("");
  
  // Privacy switches removed — were never persisted. Re-add when wired to backend.

  // Notification preferences
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_matches: true,
    email_messages: true,
    email_projects: true,
    email_opportunities: true,
    push_matches: true,
    push_messages: true,
    push_projects: true,
    push_opportunities: true,
    in_app_all: true,
  });
  const [saving, setSaving] = useState(false);

  // Track settings page view
  useEffect(() => {
    const trackView = async () => {
      const { analytics } = await import("@/lib/analytics");
      analytics.pageView("settings");
    };
    trackView();
  }, []);

  // Fetch account type
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.account_type) setAccountType(data.account_type);
      });
  }, [user?.id]);

  // PWA install detection
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotificationPreferences();
      
      // Track page view
      const trackPage = async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.pageView("settings");
      };
      trackPage();
    }
  }, [user]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      toast({
        title: "App Installed!",
        description: "Kretopia has been added to your home screen",
      });
    }
    setDeferredPrompt(null);
  };

  const fetchNotificationPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences({
          email_matches: data.email_matches,
          email_messages: data.email_messages,
          email_projects: data.email_projects,
          email_opportunities: data.email_opportunities,
          push_matches: data.push_matches,
          push_messages: data.push_messages,
          push_projects: data.push_projects,
          push_opportunities: data.push_opportunities,
          in_app_all: data.in_app_all,
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const saveNotificationPreferences = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Saved! ✓",
        description: "Notification preferences updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Password updated!",
        description: "Your password has been changed successfully",
      });

      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Failed to update password",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (error) throw error;

      toast({
        title: "Verification email sent!",
        description: "Check your new email to confirm the change",
      });

      setNewEmail("");
    } catch (error: any) {
      toast({
        title: "Failed to update email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!user) throw new Error("Not authenticated");
    
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('user_id', user.id)
        .single();

      const { data: portfolio } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', user.id);

      const { data: reviews } = await supabase
        .from('reviews')
        .select('id, profile_id, reviewer_id, reviewer_name, reviewer_role, reviewer_company, reviewer_avatar_url, rating, review_text, project_name, collaboration_type, is_endorsed, is_verified, status, created_at, updated_at')
        .eq('profile_id', user.id);

      const userData = {
        profile,
        portfolio,
        reviews,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kretopia-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Data exported!",
        description: "Your data has been downloaded",
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) throw new Error("Not authenticated");
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;

      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted",
      });

      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Failed to delete account",
        description: "Please contact support if this issue persists",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sections = (
        <div className="space-y-6">
          {/* Account Type Switcher */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Account Type
              </CardTitle>
              <CardDescription>
                Switch between personal creator and company/brand profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccountSwitcher currentAccountType={accountType} variant="settings" />
            </CardContent>
          </Card>

          {/* Appearance — Vibe picker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Pick your vibe — Daylight or Midnight. Switches the whole app instantly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VibePicker />
            </CardContent>
          </Card>

          {/* Kreto Memory */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Copilot Memory
              </CardTitle>
              <CardDescription>
                See and manage what Kreto has learned about you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => navigate("/settings/copilot-memory")}
              >
                <span>Manage memories</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Billing & Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing & Subscription
              </CardTitle>
              <CardDescription>
                Manage your plan, payment method, and invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="default" className="w-full" onClick={() => navigate("/subscription")}>
                Manage Subscription
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/wallet")}>
                KrePay Wallet & Payouts
              </Button>
            </CardContent>
          </Card>

          {/* Language & Region */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Language & Region
              </CardTitle>
              <CardDescription>
                Choose your preferred display language
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Display language</p>
                <LanguageSwitcher variant="full" />
              </div>
              <CaribbeanVoiceToggle />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password & Security
              </CardTitle>
              <CardDescription>
                Manage your password and account security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              <Button 
                onClick={handlePasswordChange} 
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Settings
              </CardTitle>
              <CardDescription>
                Update your email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">New Email Address</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="your.new@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  You'll receive a verification link at your new email
                </p>
              </div>

              <Button 
                onClick={handleEmailChange} 
                disabled={loading || !newEmail}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Update Email
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Manage how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* In-App */}
              <div className="flex items-center justify-between">
                <Label htmlFor="in_app_all" className="flex flex-col gap-1">
                  <span>In-App Notifications</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    Show notifications in the app
                  </span>
                </Label>
                <Switch
                  id="in_app_all"
                  checked={preferences.in_app_all}
                  onCheckedChange={(checked) => updatePreference('in_app_all', checked)}
                />
              </div>

              <Separator />

              {/* Push Notifications */}
              <div className="space-y-4">
                <NotificationSettings />
              </div>

              <Separator />

              {/* Email Notifications */}
              <div className="space-y-4">
                <h4 className="font-medium">Email Notifications</h4>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="email_matches" className="flex flex-col gap-1">
                    <span>New Matches</span>
                    <span className="font-normal text-sm text-muted-foreground">
                      When you match with someone
                    </span>
                  </Label>
                  <Switch
                    id="email_matches"
                    checked={preferences.email_matches}
                    onCheckedChange={(checked) => updatePreference('email_matches', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="email_messages" className="flex flex-col gap-1">
                    <span>New Messages</span>
                    <span className="font-normal text-sm text-muted-foreground">
                      When you receive a message
                    </span>
                  </Label>
                  <Switch
                    id="email_messages"
                    checked={preferences.email_messages}
                    onCheckedChange={(checked) => updatePreference('email_messages', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="email_projects" className="flex flex-col gap-1">
                    <span>Project Updates</span>
                    <span className="font-normal text-sm text-muted-foreground">
                      Updates on your active projects
                    </span>
                  </Label>
                  <Switch
                    id="email_projects"
                    checked={preferences.email_projects}
                    onCheckedChange={(checked) => updatePreference('email_projects', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="email_opportunities" className="flex flex-col gap-1">
                    <span>New Opportunities</span>
                    <span className="font-normal text-sm text-muted-foreground">
                      Opportunities matching your profile
                    </span>
                  </Label>
                  <Switch
                    id="email_opportunities"
                    checked={preferences.email_opportunities}
                    onCheckedChange={(checked) => updatePreference('email_opportunities', checked)}
                  />
                </div>
              </div>

              <Button onClick={saveNotificationPreferences} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Notification Preferences"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Creator Site (My Website) — included in Creator+ subscription */}
          <CreatorSiteSettings />

          {/* Privacy toggles hidden for MVP — were never persisted (local state only). Re-add when wired to backend. */}

          {/* Telegram bot */}
          <TelegramConnectCard />
          {/* Status card hidden from users — admin/debug only */}

          {/* Blocked Users */}
          <BlockedUsersCard />

          {/* Install App */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Install App
              </CardTitle>
              <CardDescription>
                Add Kretopia to your home screen for the best experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isInstalled ? (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">App Installed</p>
                    <p className="text-sm text-muted-foreground">Kretopia is on your home screen</p>
                  </div>
                </div>
              ) : (
                <>
                  {deferredPrompt && (
                    <Button onClick={handleInstallApp} className="w-full" size="lg">
                      <Download className="mr-2 h-5 w-5" />
                      Install App Now
                    </Button>
                  )}

                  {isIOS && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">To install on iPhone/iPad:</p>
                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                          <Share className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">1. Tap Share</p>
                          <p className="text-xs text-muted-foreground">
                            Tap the share button at the bottom of Safari
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                          <Plus className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">2. Add to Home Screen</p>
                          <p className="text-xs text-muted-foreground">
                            Scroll down and tap "Add to Home Screen"
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isIOS && !deferredPrompt && (
                    <div className="text-center py-2">
                      <p className="text-sm text-muted-foreground">
                        On Android Chrome, look for "Install app" or "Add to Home screen" in the browser menu (⋮)
                      </p>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Why install?</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        Faster access • Works offline • Full-screen experience
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>
                Export or delete your account data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleExportData}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                  </>
                )}
              </Button>

              <div className="rounded-lg border p-4">
                <ManualMergeAccountPanel />
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your
                      account and remove all your data including profile, portfolio, reviews, and projects.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Yes, delete my account"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* About & Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                About & Links
              </CardTitle>
              <CardDescription>
                Important links and information about Kretopia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Link 
                  to="/subscription" 
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Pricing</span>
                </Link>
                
                <Link 
                  to="/partner-directory" 
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Partners</span>
                </Link>
                
                <Link 
                  to="/partner-submit" 
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Become a Partner</span>
                </Link>
                
                <a 
                  href="mailto:info@kretopia.com" 
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  <span>Contact Us</span>
                </a>
                
                <a 
                  href="mailto:support@kretopia.com" 
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  <span>Support</span>
                </a>
                
                <Link 
                  to="/terms" 
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Terms of Service</span>
                </Link>
                
                <Link 
                  to="/privacy" 
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Privacy Policy</span>
                </Link>
                
                <Link 
                  to="/community-guidelines" 
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Community Guidelines</span>
                </Link>
              </div>

              <Separator />

              {/* Restart Tour */}
              <RestartTourButton />

              <Separator />
              
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Follow us:</p>
                <a 
                  href="https://instagram.com/kretopia" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Instagram
                </a>
              </div>

              <Separator />
              
              <p className="text-xs text-muted-foreground text-center">
                © {new Date().getFullYear()} Kretopia. All rights reserved.
              </p>
            </CardContent>
          </Card>
        </div>
  );

  if (embedded) return sections;

  return (
    <div className="min-h-screen">
      <StudioFeatureShell>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 -ml-2 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/circle")}
            className="shrink-0"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase flex items-center gap-1.5">
            <SettingsIcon className="h-3 w-3" />
            Account
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05]">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account preferences and security</p>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {sections}
      </StudioFeatureShell>
    </div>
  );
};

export default Settings;
function CaribbeanVoiceToggle() {
  const { optIn, setOptIn, isTTGeo } = useTrinidadVoice();
  return (
    <div className="flex items-start justify-between gap-4 pt-4 border-t border-border">
      <div className="flex-1">
        <p className="text-sm font-medium">Caribbean voice</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isTTGeo
            ? "On automatically — yuh in T&T. Toggle off for neutral copy."
            : "Show Trini-flavoured copy across the platform (great for diaspora)."}
        </p>
      </div>
      <Switch checked={optIn || isTTGeo} onCheckedChange={setOptIn} disabled={isTTGeo && !optIn} />
    </div>
  );
}
