import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Mic,
  Plus,
  FolderKanban,
  Wallet,
  MessageSquare,
  UserSearch,
  Briefcase,
  Calendar,
  Sparkles,
  DollarSign,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DeskCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoiceCreate?: () => void;
  onVoiceCommand?: () => void;
}

interface ProjectLite {
  id: string;
  title: string;
  status?: string | null;
}

/**
 * Global ⌘K palette — fastest path to any project, action, or money screen.
 * Always available across Desk via keyboard shortcut. Mobile users can open
 * it from the TodayStrip "Quick jump" chip.
 */
export const DeskCommandPalette = ({
  open,
  onOpenChange,
  onVoiceCreate,
  onVoiceCommand,
}: DeskCommandPaletteProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectLite[]>([]);

  // Load top recent projects when palette opens (cheap, just titles)
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (supabase as any)
      .from("projects")
      .select("id, title, status")
      .order("updated_at", { ascending: false })
      .limit(15)
      .then(({ data }: any) => {
        if (!cancelled) setProjects(data || []);
      }, () => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (path: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(path), 50);
  };

  const run = (fn?: () => void) => {
    onOpenChange(false);
    if (fn) setTimeout(fn, 80);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to project, run an action, or speak..." />
      <CommandList>
        <CommandEmpty>No matches. Try a project name or "voice".</CommandEmpty>

        <CommandGroup heading="Quick capture">
          <CommandItem onSelect={() => run(onVoiceCreate)}>
            <Mic className="h-4 w-4 mr-2" />
            New room — speak it
          </CommandItem>
          <CommandItem onSelect={() => run(onVoiceCommand)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Voice command (mark paid, add task, start call…)
          </CommandItem>
          <CommandItem onSelect={() => run(onVoiceCreate)}>
            <Plus className="h-4 w-4 mr-2" />
            New project workspace
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Jump to">
          <CommandItem onSelect={() => go("/desk")}>
            <FolderKanban className="h-4 w-4 mr-2" />
            All studio rooms
          </CommandItem>
          <CommandItem onSelect={() => go("/thrivepay")}>
            <Wallet className="h-4 w-4 mr-2" />
            KrePay — money home
          </CommandItem>
          <CommandItem onSelect={() => go("/thrivepay?tab=invoices")}>
            <DollarSign className="h-4 w-4 mr-2" />
            Invoices to collect
          </CommandItem>
          <CommandItem onSelect={() => go("/messages")}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </CommandItem>
          <CommandItem onSelect={() => go("/match")}>
            <Users className="h-4 w-4 mr-2" />
            Match — find collaborators
          </CommandItem>
          <CommandItem onSelect={() => go("/talent-finder")}>
            <UserSearch className="h-4 w-4 mr-2" />
            Find talent
          </CommandItem>
          <CommandItem onSelect={() => go("/post-opportunity")}>
            <Briefcase className="h-4 w-4 mr-2" />
            Post a gig
          </CommandItem>
          <CommandItem onSelect={() => go("/calendar")}>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </CommandItem>
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Your studio rooms">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.title}`}
                  onSelect={() => go(`/desk/${p.id}`)}
                >
                  <FolderKanban className="h-4 w-4 mr-2 opacity-60" />
                  <span className="truncate">{p.title}</span>
                  {p.status && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                      {p.status}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
