import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollabLite {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface AssigneePickerProps {
  projectId: string;
  /** Currently assigned user_id or null for unassigned. */
  value: string | null;
  /** Called with the new user_id (or null to unassign). */
  onChange: (userId: string | null, person: CollabLite | null) => void;
  /** Compact = only avatar (for cards). Full = avatar + name pill (for dialog). */
  size?: "compact" | "full";
  disabled?: boolean;
}

const initials = (n: string | null | undefined) =>
  (n ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

/**
 * Per-deliverable assignee picker.
 * Pulls accepted collaborators + project owner so creators can route work.
 */
export const AssigneePicker = ({
  projectId,
  value,
  onChange,
  size = "compact",
  disabled,
}: AssigneePickerProps) => {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<CollabLite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || people.length) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Collaborators
      const { data: collabs } = await supabase
        .from("project_collaborators")
        .select(
          "user_id, role, agent_role, profiles:user_id(display_name, avatar_url)",
        )
        .eq("project_id", projectId)
        .eq("status", "accepted");

      // Owner
      const { data: project } = await (supabase as any)
        .from("projects")
        .select("created_by, profiles:created_by(display_name, avatar_url)")
        .eq("id", projectId)
        .maybeSingle();

      const list: CollabLite[] = (collabs ?? [])
        .filter((r: any) => r.user_id)
        .map((r: any) => ({
          user_id: r.user_id,
          display_name: r.profiles?.display_name ?? null,
          avatar_url: r.profiles?.avatar_url ?? null,
          role: r.role ?? r.agent_role ?? null,
        }));

      if (
        project?.created_by &&
        !list.find((c) => c.user_id === project.created_by)
      ) {
        list.unshift({
          user_id: project.created_by,
          display_name: (project as any).profiles?.display_name ?? "Owner",
          avatar_url: (project as any).profiles?.avatar_url ?? null,
          role: "owner",
        });
      }
      if (!cancelled) {
        setPeople(list);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, people.length]);

  const current = people.find((p) => p.user_id === value) ?? null;

  // Render the trigger
  const trigger =
    size === "compact" ? (
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "shrink-0 rounded-full transition",
          "ring-2 ring-background hover:ring-primary/40",
          disabled && "opacity-60 cursor-default",
        )}
        aria-label={current ? `Assigned to ${current.display_name ?? ""}` : "Assign someone"}
        title={current?.display_name ?? "Unassigned"}
      >
        {current ? (
          <Avatar className="h-6 w-6">
            {current.avatar_url && <AvatarImage src={current.avatar_url} />}
            <AvatarFallback className="text-[10px]">
              {initials(current.display_name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-primary/10 hover:text-primary">
            <UserPlus className="h-3 w-3" />
          </span>
        )}
      </button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="h-8 gap-2 px-2"
      >
        {current ? (
          <>
            <Avatar className="h-5 w-5">
              {current.avatar_url && <AvatarImage src={current.avatar_url} />}
              <AvatarFallback className="text-[9px]">
                {initials(current.display_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs truncate max-w-[120px]">
              {current.display_name ?? "Unknown"}
            </span>
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" />
            <span className="text-xs">Assign</span>
          </>
        )}
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            {loading ? (
              <div className="text-xs text-muted-foreground p-3 text-center">
                Loading…
              </div>
            ) : (
              <>
                <CommandEmpty>No collaborators yet.</CommandEmpty>
                {value && (
                  <CommandGroup>
                    <CommandItem
                      value="__unassign"
                      onSelect={() => {
                        onChange(null, null);
                        setOpen(false);
                      }}
                      className="gap-2"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">Unassign</span>
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Project team">
                  {people.map((p) => (
                    <CommandItem
                      key={p.user_id}
                      value={`${p.display_name ?? ""} ${p.role ?? ""}`}
                      onSelect={() => {
                        onChange(p.user_id, p);
                        setOpen(false);
                      }}
                      className="gap-2"
                    >
                      <Avatar className="h-5 w-5">
                        {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                        <AvatarFallback className="text-[9px]">
                          {initials(p.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">
                          {p.display_name ?? "Unnamed"}
                        </p>
                        {p.role && (
                          <p className="text-[10px] text-muted-foreground capitalize truncate">
                            {p.role}
                          </p>
                        )}
                      </div>
                      {value === p.user_id && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
