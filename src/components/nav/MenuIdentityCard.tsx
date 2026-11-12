import { ArrowUpRight, Building2, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface MenuIdentityCardProps {
  isCompany: boolean;
  name: string;
  avatarUrl: string | null;
  username: string | null;
  summary: string | null | undefined;
  location: string | null;
  industry?: string | null;
  onOpen: () => void;
}

function mrz(isCompany: boolean, name: string, username: string | null) {
  const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]+/g, "<");
  const line = `P<KRT${isCompany ? "CO" : "CR"}<${clean(name || "KRETOPIA")}<<${clean(username || "MEMBER")}`;
  return line.padEnd(44, "<").slice(0, 44);
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

/** Mini Kretopia passport heading the right-side menu, for both account modes.
 *  The sheet itself already wears the branded Kretopia header (see Navbar), so
 *  this card carries no banner of its own: identity, fields and the
 *  machine-readable line only, at the same width as every other menu card. */
export function MenuIdentityCard({ isCompany, name, avatarUrl, username, summary, location, industry, onOpen }: MenuIdentityCardProps) {
  const displayName = name || (isCompany ? "Company / Brand" : "Personal Creator");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={isCompany ? "Open Company Page" : "Open Passport"}
      className="group relative mt-1 w-full text-left transition-transform duration-300 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[20px]"
    >
      <div className="relative overflow-hidden rounded-[20px] border border-primary/30 bg-card shadow-md transition-shadow duration-300 group-hover:shadow-[0_12px_32px_-12px_hsl(var(--primary)/0.55)]">
        {/* Guilloché + holo wash */}
        <div className="pointer-events-none absolute inset-0 opacity-60 bg-[repeating-radial-gradient(circle_at_100%_0%,hsl(var(--primary)/0.10)_0_1px,transparent_1px_7px)]" aria-hidden />
        <div className="pointer-events-none absolute -inset-x-10 -top-10 h-24 rotate-6 bg-gradient-to-r from-transparent via-primary/25 to-transparent opacity-0 blur-md transition-all duration-700 group-hover:translate-y-24 group-hover:opacity-100" aria-hidden />

        {/* Identity */}
        <div className="relative flex items-start gap-3 border-b border-dashed border-primary/25 px-4 pb-3 pt-3.5">
          <div className="shrink-0 rounded-full bg-gradient-to-br from-primary via-accent to-primary p-[2px] shadow-md">
            <Avatar className="h-16 w-16 rounded-full border-2 border-card">
              <AvatarImage src={avatarUrl ?? undefined} alt="" className="rounded-full object-cover" />
              <AvatarFallback className="rounded-full bg-muted text-lg font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="min-w-0 truncate font-serif text-lg leading-tight">{displayName}</p>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {isCompany ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {isCompany ? "Company" : "Creator"}
              </span>
            </div>
            {username && <p className="truncate text-xs text-primary">@{username}</p>}
            {summary && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-foreground/75">{summary}</p>}
          </div>
        </div>

        {/* Fields */}
        <div className="relative grid grid-cols-2 gap-x-3 gap-y-2 px-4 pb-3 pt-3">
          <Field label={isCompany ? "Industry" : "Craft"} value={isCompany ? industry : summary} />
          <Field label="Based in" value={location} />
          <Field label="Handle" value={username ? `@${username}` : null} />
          <div className="flex items-end justify-end">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-transform duration-300 group-hover:translate-x-0.5">
              {isCompany ? "Open page" : "Open Passport"} <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Machine-readable zone */}
        <div className="relative border-t border-dashed border-primary/30 bg-muted/40 px-4 py-1.5">
          <p className="truncate font-mono text-[9px] tracking-[0.12em] text-muted-foreground" aria-hidden>{mrz(isCompany, name, username)}</p>
        </div>

        {/* Passport side notches, centred on the avatar */}
        <span className="absolute -left-2 top-[46px] h-4 w-4 rounded-full border border-primary/30 bg-background" aria-hidden />
        <span className="absolute -right-2 top-[46px] h-4 w-4 rounded-full border border-primary/30 bg-background" aria-hidden />
      </div>
    </button>
  );
}
