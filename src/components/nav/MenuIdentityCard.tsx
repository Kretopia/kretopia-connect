import { ArrowUpRight, Building2, MapPin, User, BadgeCheck } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

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

/** Branded Kretopia identity card heading the right-side menu, for both account modes. */
export function MenuIdentityCard({ isCompany, name, avatarUrl, username, summary, location, industry, onOpen }: MenuIdentityCardProps) {
  const label = isCompany ? "Company Page" : "Creative Passport";
  const fallbackName = isCompany ? "Company / Brand" : "Personal Creator";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={isCompany ? "Open Company Page" : "Open Passport"}
      className="group relative mt-3 w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Brand band */}
      <div className="relative h-14 overflow-hidden bg-gradient-to-r from-primary/30 via-accent/25 to-primary/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,hsl(var(--primary)/0.45),transparent_60%)]" aria-hidden />
        <div className="absolute left-3 top-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
          <BrandLogo iconOnly size="sm" className="[&_img]:h-4 [&_img]:w-4" />
          <span>{label}</span>
        </div>
        <span className={cn(
          "absolute right-3 top-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur",
          "border-border bg-background/70 text-foreground",
        )}>
          {isCompany ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
          {isCompany ? "Company" : "Creator"}
        </span>
      </div>

      <div className="relative px-4 pb-4">
        <div className="-mt-7 flex items-end justify-between">
          <div className="rounded-full bg-gradient-to-br from-primary to-accent p-[2px] shadow-md">
            <Avatar className={cn("h-14 w-14 border-2 border-card", isCompany && "rounded-xl")}>
              <AvatarImage src={avatarUrl ?? undefined} alt="" className={isCompany ? "rounded-xl object-cover" : undefined} />
              <AvatarFallback className={cn("bg-muted text-base font-semibold", isCompany && "rounded-xl")}>
                {name?.charAt(0).toUpperCase() || (isCompany ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />)}
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-primary transition-transform group-hover:translate-x-0.5">
            {isCompany ? "View page" : "View Passport"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="mt-2 space-y-1">
          <p className="flex items-center gap-1.5 break-words font-serif text-lg leading-tight">
            {name || fallbackName}
            {username && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
          </p>
          {username && <p className="break-all text-xs text-muted-foreground">@{username}</p>}
          {summary && <p className="line-clamp-2 break-words text-xs text-foreground/80">{summary}</p>}
        </div>

        {(location || (isCompany && industry && industry !== summary)) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {isCompany && industry && industry !== summary && (
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">{industry}</span>
            )}
            {location && (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{location}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
