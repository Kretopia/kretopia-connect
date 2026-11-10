import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
  /**
   * The rules to list. Sign-up passes its own policy (lib/passwordPolicy), so the ticks are exactly what the submit will check; without
   * it the list is the general one below, which the password-reset form still uses.
   */
  rules?: readonly ValidationRule[];
}

interface ValidationRule {
  label: string;
  isValid: (password: string) => boolean;
}

const defaultRules: ValidationRule[] = [
  { label: "At least 8 characters", isValid: (pw) => pw.length >= 8 },
  { label: "Contains uppercase letter", isValid: (pw) => /[A-Z]/.test(pw) },
  { label: "Contains lowercase letter", isValid: (pw) => /[a-z]/.test(pw) },
  { label: "Contains number", isValid: (pw) => /\d/.test(pw) },
];

export const PasswordStrengthIndicator = ({ password, rules = defaultRules }: PasswordStrengthIndicatorProps) => {
  if (!password) return null;

  const validationRules = rules;
  const validCount = validationRules.filter(rule => rule.isValid(password)).length;
  const strength = validCount === validationRules.length ? "strong" : validCount >= Math.ceil(validationRules.length / 2) ? "medium" : "weak";
  
  const strengthColors = {
    weak: "bg-destructive",
    medium: "bg-yellow-500",
    strong: "bg-green-500",
  };

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {validationRules.map((_, index) => index + 1).map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-all ${
              level <= validCount ? strengthColors[strength] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="space-y-1">
        {validationRules.map((rule, index) => {
          const isValid = rule.isValid(password);
          return (
            <div
              key={index}
              className={`flex items-center gap-2 text-xs transition-colors ${
                isValid ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              }`}
            >
              {isValid ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3 opacity-50" />
              )}
              <span>{rule.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
