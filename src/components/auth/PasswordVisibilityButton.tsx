import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PasswordVisibilityButtonProps {
  visible: boolean;
  onToggle: () => void;
  label: string;
}

export function PasswordVisibilityButton({ visible, onToggle, label }: PasswordVisibilityButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="auth-eye-toggle"
      onClick={onToggle}
      aria-label={`${visible ? "Hide" : "Show"} ${label}`}
      aria-pressed={visible}
      title={`${visible ? "Hide" : "Show"} ${label}`}
    >
      <Eye className="auth-eye-icon h-4 w-4" aria-hidden="true" />
    </Button>
  );
}