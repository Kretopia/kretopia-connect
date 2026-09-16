import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, Search } from "lucide-react";
import { ROLE_OPTIONS } from "./ProfileEditDialog";

interface SubRolesPickerProps {
  mainRole: string;
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}

/**
 * Sub-roles picker — adds secondary specialties on top of a main role.
 * E.g. Main: Producer, Sub: [Photographer, Singer].
 * Replaces the generic "Multi-Creative" tag with explicit, searchable specialties.
 */
export function SubRolesPicker({ mainRole, value, onChange, max = 5 }: SubRolesPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const available = useMemo(() => {
    const taken = new Set([mainRole, ...value]);
    return ROLE_OPTIONS.filter(
      (o) =>
        !taken.has(o.value) &&
        o.value !== "Other" &&
        (query === "" || o.label.toLowerCase().includes(query.toLowerCase()))
    );
  }, [mainRole, value, query]);

  const add = (role: string) => {
    if (value.length >= max) return;
    onChange([...value, role]);
    setQuery("");
  };

  const remove = (role: string) => onChange(value.filter((r) => r !== role));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((role) => {
          const opt = ROLE_OPTIONS.find((o) => o.value === role);
          return (
            <Badge key={role} variant="secondary" className="gap-1 pr-1">
              {opt?.label || role}
              <button
                type="button"
                onClick={() => remove(role)}
                className="ml-0.5 rounded-full hover:bg-background/50 p-0.5"
                aria-label={`Remove ${role}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        {value.length < max && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Add specialty
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-2"
              align="start"
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search roles..."
                  className="h-8 pl-7 text-xs"
                  autoFocus
                />
              </div>
              <div
                className="max-h-72 overflow-y-auto overscroll-contain space-y-0.5 touch-pan-y"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {available.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    No matches
                  </p>
                ) : (
                  available.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => add(o.value)}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors"
                    >
                      {o.label}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Add up to {max} specialties so brands and collaborators know your full range.
        {value.length > 0 && ` (${value.length}/${max})`}
      </p>
    </div>
  );
}
