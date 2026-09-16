import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_CURRENCIES } from "@/hooks/useCurrencyConversion";
import { Globe } from "lucide-react";

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  compact?: boolean;
}

export function CurrencySelector({ value, onChange, compact = false }: CurrencySelectorProps) {
  const curr = SUPPORTED_CURRENCIES.find(c => c.code === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={compact ? "w-20 h-8 text-xs" : "w-36 h-8 text-xs"}>
        <Globe className="h-3 w-3 mr-1 shrink-0" />
        <SelectValue>{compact ? value : `${curr?.symbol} ${value}`}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {SUPPORTED_CURRENCIES.map(c => (
          <SelectItem key={c.code} value={c.code} className="text-xs">
            <span className="font-medium">{c.symbol}</span>{" "}
            <span>{c.code}</span>{" "}
            <span className="text-muted-foreground">— {c.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
