import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface ValidationRule {
  label: string;
  isValid: (password: string) => boolean;
}

const validationRules: ValidationRule[] = [
  { label: "At least 8 characters", isValid: (pw) => pw.length >= 8 },
  { label: "Contains uppercase letter", isValid: (pw) => /[A-Z]/.test(pw) },
  { label: "Contains lowercase letter", isValid: (pw) => /[a-z]/.test(pw) },
  { label: "Contains number", isValid: (pw) => /\d/.test(pw) },
];

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  if (!password) return null;

  const validCount = validationRules.filter(rule => rule.isValid(password)).length;
  const strength = validCount === 4 ? "strong" : validCount >= 2 ? "medium" : "weak";
  
  const strengthColors = {
    weak: "bg-destructive",
    medium: "bg-yellow-500",
    strong: "bg-green-500",
  };

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
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
