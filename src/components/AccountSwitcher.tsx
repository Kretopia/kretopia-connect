import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, User, ArrowRightLeft, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AccountSwitcherProps {
  currentAccountType: "individual" | "company";
  onSwitch?: () => void;
  onManagerModeChange?: (enabled: boolean) => void;
  variant?: "menu" | "settings";
}

export const AccountSwitcher = ({ currentAccountType, onSwitch, onManagerModeChange, variant = "menu" }: AccountSwitcherProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [isManagerMode, setIsManagerMode] = useState(false);
  const [managerToggling, setManagerToggling] = useState(false);

  const isCompany = currentAccountType === "company";
  const targetType = isCompany ? "individual" : "company";
  const targetLabel = isCompany ? "Personal Creator" : "Company / Brand";
  const TargetIcon = isCompany ? User : Building2;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("is_manager_mode")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.is_manager_mode) setIsManagerMode(true);
      }, () => {});
  }, [user?.id]);

  const toggleManagerMode = async (enabled: boolean) => {
    if (!user) return;
    setManagerToggling(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_manager_mode: enabled })
        .eq("user_id", user.id);
      if (error) throw error;
      setIsManagerMode(enabled);
      onManagerModeChange?.(enabled);
      toast({
        title: enabled ? "Manager Mode Activated" : "Manager Mode Deactivated",
        description: enabled
          ? "You now have access to the Talent Manager dashboard."
          : "Manager dashboard hidden. You can re-enable anytime.",
      });
      if (enabled) navigate("/talent-manager");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setManagerToggling(false);
    }
  };

  const handleSwitch = async () => {
    if (!user) return;
    setSwitching(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ account_type: targetType })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: `Switched to ${targetLabel}`,
        description: `Your profile is now displaying as a ${targetLabel.toLowerCase()} account.`,
      });

      onSwitch?.();
      // Navigate to profile page after switch, then reload to refresh UI
      navigate("/profile");
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Switch failed",
        description: error.message || "Could not switch account type",
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
      setShowConfirm(false);
    }
  };

  if (variant === "settings") {
    return (
      <>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3">
            {isCompany ? (
              <Building2 className="h-5 w-5 text-primary" />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
            <div>
              <p className="font-medium text-sm">
                Currently: {isCompany ? "Company / Brand" : "Personal Creator"}
              </p>
              <p className="text-xs text-muted-foreground">
                Switch to {targetLabel} to change your profile layout
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirm(true)}
            disabled={switching}
            className="gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Switch
          </Button>
        </div>

        {/* Talent Manager Mode Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">
                {isManagerMode ? "Manager Mode Active" : "Activate Manager Mode"}
              </p>
              <p className="text-xs text-muted-foreground">
                Manage talent, earn commissions on referred jobs
              </p>
            </div>
          </div>
          <Switch
            checked={isManagerMode}
            onCheckedChange={toggleManagerMode}
            disabled={managerToggling}
          />
        </div>

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <TargetIcon className="h-5 w-5" />
                Switch to {targetLabel}?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Your profile will switch to a <strong>{targetLabel.toLowerCase()}</strong> layout. Here's what happens:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Your {isCompany ? "company" : "personal"} data is <strong>preserved</strong> — you can switch back anytime</li>
                  <li>Connections, subscription, and portfolio are <strong>shared</strong> across both views</li>
                  <li>Your profile layout and public appearance will change</li>
                  {!isCompany && (
                    <li>You'll need to fill in your company name and details if you haven't already</li>
                  )}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={switching}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSwitch} disabled={switching}>
                {switching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Switching...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Switch to {targetLabel}
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Menu variant (compact)
  return (
    <>
      <Button
        variant="ghost"
        className="justify-start gap-3 h-12 w-full"
        onClick={() => setShowConfirm(true)}
        disabled={switching}
      >
        <ArrowRightLeft className="h-5 w-5" />
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">Switch to {targetLabel}</span>
          <span className="text-[10px] text-muted-foreground">
            Currently: {isCompany ? "Company" : "Personal"}
          </span>
        </div>
      </Button>

      {/* Manager Mode Toggle */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Manager Mode</p>
            <p className="text-[10px] text-muted-foreground">Earn commissions on referred jobs</p>
          </div>
        </div>
        <Switch
          checked={isManagerMode}
          onCheckedChange={toggleManagerMode}
          disabled={managerToggling}
        />
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TargetIcon className="h-5 w-5" />
              Switch to {targetLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Your profile will display as a <strong>{targetLabel.toLowerCase()}</strong>. All your data is preserved — you can switch back anytime.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={switching}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSwitch} disabled={switching}>
              {switching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Switching...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Switch
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
