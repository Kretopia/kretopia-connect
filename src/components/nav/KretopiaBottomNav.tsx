import { Link, useLocation } from "react-router-dom";
import { Home, BadgeCheck, Briefcase, LayoutGrid, UserSearch, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { memo, useEffect, useState } from "react";
import { useAccountTone } from "@/hooks/useAccountTone";
import { BRAND_EDGE, BRAND_GRADIENT, FAB_SLOT_PX } from "./bottomNavMetrics";

/**
 * Kretopia V1 bottom nav — Home · Passport · [+] · Scout · Studio. Scout leads to /scout, the same page as the desktop nav.
 *
 * Kreto is a persistent bar/FAB layer, NOT a nav tab. The "+" (QuickActionFab) floats over the middle of this bar, so the bar
 * reserves that slot (two entries, the slot, two entries): nothing and no label is ever under the button, on any width.
 * Company/business accounts keep their existing B2B nav unchanged.
 */
const CREATIVE_ITEMS = [
  { path: "/", icon: Home, label: "Home", hint: "Today, insights, and Kreto's brief" },
  { path: "/profile", icon: BadgeCheck, label: "Passport", hint: "Your verified creative identity" },
  { path: "/scout", icon: Briefcase, label: "Scout", hint: "Scouted gigs matched to you" },
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
    // Scout is one destination on desktop and mobile (/scout); the opportunities pages stay part of it.
    if (path === "/scout" || path === "/opportunities") {
      return (
        location.pathname.startsWith("/opportunities") ||
        location.pathname.startsWith("/opportunity") ||
        location.pathname.startsWith("/scout")
      );
    }
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
        aria-label={`${item.label} — ${item.hint}`}
        aria-current={active ? "page" : undefined}
        data-active={active ? "true" : undefined}
        className={cn(
          "relative flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1 pt-2 transition-colors duration-200",
          "touch-manipulation select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {active && (
          <span
            aria-hidden
            data-testid="nav-active-mark"
            className="absolute left-1/2 top-0 h-[3px] w-7 -translate-x-1/2 rounded-full"
            style={{ background: BRAND_GRADIENT }}
          />
        )}
        <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
        <span className={cn("max-w-full truncate text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>
          {item.label}
        </span>
      </Link>
    );
  };

  const half = Math.ceil(items.length / 2);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
      role="navigation"
      aria-label="Mobile navigation"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      {/* Brand edge: a hairline that fades in from both sides, in place of a flat border. */}
      <span
        aria-hidden
        data-testid="nav-edge"
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: BRAND_EDGE }}
      />
      <div
        data-testid="nav-grid"
        className="grid items-stretch px-2 pt-1"
        style={{ gridTemplateColumns: `repeat(${half}, minmax(0, 1fr)) ${FAB_SLOT_PX}px repeat(${items.length - half}, minmax(0, 1fr))` }}
      >
        {items.slice(0, half).map(renderItem)}
        <span aria-hidden data-testid="nav-fab-slot" />
        {items.slice(half).map(renderItem)}
      </div>
    </nav>
  );
});

KretopiaBottomNav.displayName = "KretopiaBottomNav";
export default KretopiaBottomNav;
