import { Link, useLocation } from "react-router-dom";
import { Home, BadgeCheck, Briefcase, Heart, LayoutGrid, UserSearch, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { memo, useEffect, useState } from "react";
import { useAccountTone } from "@/hooks/useAccountTone";
import { OPPORTUNITIES_PATH, isOpportunitySpace } from "@/lib/opportunityRoutes";

/**
 * Kretopia V1 bottom nav — Home · Match · Passport · Opportunities · Studio. The Opportunities entry leads to /opportunities, the same place
 * as the desktop nav (Scout, the personalised search and shortlist, is inside it), and Match sits right after Home (Today) here as it does
 * in the top bar. It reads "Gigs" on the bar because "Opportunities" does not fit a fifth of a phone's width; its accessible name is the
 * full word (see `name`).
 *
 * Equal entries on a frosted-glass bar: the active entry gets the same soft translucent pill the top bar uses on hover.
 * Company/business accounts keep their existing B2B nav unchanged (four entries; it has no Today to put Match after).
 */
const CREATIVE_ITEMS = [
  { path: "/", icon: Home, label: "Home", hint: "Today, insights, and Kreto's brief" },
  { path: "/match", icon: Heart, label: "Match", hint: "People to work with, matched to you" },
  { path: "/profile", icon: BadgeCheck, label: "Passport", hint: "Your verified creative identity" },
  { path: OPPORTUNITIES_PATH, icon: Briefcase, label: "Gigs", name: "Opportunities", hint: "Gigs and Scout, your personalised search and shortlist" },
  { path: "/desk", icon: LayoutGrid, label: "Studio", hint: "Projects, files, and collaborators" },
];

const COMPANY_ITEMS = [
  { path: "/desk", icon: LayoutGrid, label: "Studios", hint: "Your briefs & active projects" },
  { path: "/opportunities", icon: Briefcase, label: "Gigs", hint: "Roles you've posted & talent pool" },
  { path: "/talent-finder", icon: UserSearch, label: "Talent", hint: "Find creators to hire" },
  { path: "/thrivepay", icon: Wallet, label: "Pay", hint: "Pay creators & manage invoices" },
];

type NavItem = (typeof CREATIVE_ITEMS)[number];

const KretopiaBottomNav = memo(() => {
  const location = useLocation();
  const { isBusiness } = useAccountTone();

  const items = isBusiness ? COMPANY_ITEMS : CREATIVE_ITEMS;

  // Hide when a Radix dialog/sheet/drawer is open (keeps parity with legacy BottomNav).
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const check = () => {
      const locked =
        document.body.hasAttribute("data-scroll-locked") ||
        !!document.querySelector(
          '[role="dialog"][data-state="open"], [data-radix-dialog-content][data-state="open"]'
        );
      setOverlayOpen(locked);
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
      childList: true,
      subtree: true,
    });
    return () => obs.disconnect();
  }, []);

  if (location.pathname === "/auth") return null;
  if (overlayOpen) return null;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    // One destination on desktop and mobile: the feed, Scout inside it, one opportunity and the poster's dashboard are all "Opportunities".
    if (path === OPPORTUNITIES_PATH) return isOpportunitySpace(location.pathname);
    if (path === "/profile") {
      return (
        location.pathname.startsWith("/profile") ||
        location.pathname.startsWith("/passport") ||
        location.pathname.startsWith("/thrivepay") ||
        location.pathname.startsWith("/accounting") ||
        location.pathname.startsWith("/credits")
      );
    }
    if (path === "/desk") return location.pathname.startsWith("/desk");
    return location.pathname === path;
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path);
    return (
      <Link
        key={item.path + item.label}
        to={item.path}
        title={item.hint}
        aria-label={`${"name" in item ? item.name : item.label} — ${item.hint}`}
        aria-current={active ? "page" : undefined}
        data-active={active ? "true" : undefined}
        className={cn(
          "relative flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 pb-1.5 pt-2 transition-[background-color,color,box-shadow,transform] duration-200",
          "touch-manipulation select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-foreground/10 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18),0_1px_6px_hsl(0_0%_0%/0.12)] ring-1 ring-foreground/10 backdrop-blur-md"
            : "text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        )}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
        <span className={cn("max-w-full truncate text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-foreground/10 bg-background/55 shadow-[0_-8px_32px_hsl(0_0%_0%/0.10)] backdrop-blur-2xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-background/95 lg:hidden"
      role="navigation"
      aria-label="Mobile navigation"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      <div data-testid="nav-grid" className={cn("grid items-stretch gap-1 px-3 pt-1.5", items.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
        {items.map(renderItem)}
      </div>
    </nav>
  );
});

KretopiaBottomNav.displayName = "KretopiaBottomNav";
export default KretopiaBottomNav;
