import type { ReactNode } from "react";
import { SettingsNav, type SettingsDomain } from "./SettingsNav";

interface SettingsShellProps {
  domains: SettingsDomain[];
  active: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}

/**
 * CDO audit canonical Settings layout (L4: SettingsShell). Sidebar
 * navigation + selected content pane on desktop; the same nav collapses to
 * a horizontal row above the content on mobile (SettingsNav itself handles
 * the responsive switch, so this shell never needs its own breakpoint
 * logic). Replaces Settings.tsx's prior single scrolling column of 11
 * unrelated Cards -- each domain's panel now shows only its own 2-4 cards.
 */
export function SettingsShell({ domains, active, onSelect, children }: SettingsShellProps) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <SettingsNav domains={domains} active={active} onSelect={onSelect} />
      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}

export default SettingsShell;
