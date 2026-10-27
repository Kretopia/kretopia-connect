import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SettingsNav, type SettingsDomain } from "./SettingsNav";

/**
 * Every settings card sits on the same hairline surface (the one Discover's cards wear), inset in the panel, with a
 * title one step quieter than the shadcn default so six sections read as one page and not as a stack of boxes.
 */
const CARDS =
  "min-w-0 flex-1 space-y-4 [&>*]:rounded-2xl [&>*]:border-border [&>*]:bg-background/40 [&>*]:shadow-none [&_h3]:text-lg max-sm:[&_.p-6]:px-4";

interface SettingsShellProps {
  domains: SettingsDomain[];
  active: string;
  onSelect: (id: string) => void;
  /** Mounted in a drawer: one column, every section, no sidebar. */
  embedded?: boolean;
  children: ReactNode;
}

/**
 * CDO audit canonical Settings layout (L4: SettingsShell). Sidebar
 * navigation + selected content pane on desktop; the same nav collapses to
 * a horizontal row above the content on mobile (SettingsNav itself handles
 * the responsive switch, so this shell never needs its own breakpoint
 * logic). Replaces Settings.tsx's prior single scrolling column of 11
 * unrelated Cards -- each domain's panel now shows only its own 2-4 cards.
 *
 * Embedded (the navbar drawer, ~400px wide): the sidebar breakpoint is the
 * viewport's, not the drawer's, so it used to cut the content in two. There
 * every section is already shown, so the nav has nothing to select: one
 * column, full width.
 */
export function SettingsShell({ domains, active, onSelect, embedded = false, children }: SettingsShellProps) {
  if (embedded) return <div className={cn("min-w-0", CARDS)}>{children}</div>;
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <SettingsNav domains={domains} active={active} onSelect={onSelect} />
      <div className={CARDS}>{children}</div>
    </div>
  );
}

export default SettingsShell;
