import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { validatePassword } from "@/lib/validation";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";

interface PasswordResetFormProps {
  loading: boolean;
  onSubmit: (newPassword: string) => void;
}

export const PasswordResetForm = ({ loading, onSubmit }: PasswordResetFormProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmNewPasswordError, setConfirmNewPasswordError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pv = validatePassword(newPassword);
    if (!pv.valid) { setNewPasswordError(pv.error || ""); return; }
    if (newPassword !== confirmNewPassword) { setConfirmNewPasswordError("Passwords don't match"); return; }
    setNewPasswordError("");
    setConfirmNewPasswordError("");
    onSubmit(newPassword);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password" type="password" placeholder="••••••••"
          value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setNewPasswordError(""); }}
          required minLength={8}
          className={`h-11 sm:h-10 text-base ${newPasswordError ? "border-destructive" : ""}`}
          autoComplete="new-password"
        />
        {newPasswordError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{newPasswordError}</p>}
        <PasswordStrengthIndicator password={newPassword} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirm New Password</Label>
        <Input
          id="confirm-new-password" type="password" placeholder="••••••••"
          value={confirmNewPassword} onChange={(e) => { setConfirmNewPassword(e.target.value); setConfirmNewPasswordError(""); }}
          required className={`h-11 sm:h-10 text-base ${confirmNewPasswordError ? "border-destructive" : ""}`}
          autoComplete="new-password"
        />
        {confirmNewPasswordError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{confirmNewPasswordError}</p>}
      </div>
      <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting Password...</> : "Reset Password"}
      </Button>
    </form>
  );
};
