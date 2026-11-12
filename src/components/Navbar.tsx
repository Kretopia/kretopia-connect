import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";
import { HamburgerIcon } from "@/components/nav/HamburgerIcon";
import { NAV_ICON, NAV_ICON_BUTTON, SEARCH_ICON } from "@/components/nav/navIcon";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GlassCta } from "@/components/ui/glass-cta";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus, Settings, Users, User, Briefcase, MessageCircle, Shield, Crown, Sparkles, DollarSign, FolderKanban, LayoutDashboard, Radar, Search, BarChart3, ShoppingBag, Share2, Rocket, Wallet, MapPin, Trophy, CheckCircle, Target, Zap, CalendarDays, UserPlus, UserCircle2, Building2, Inbox, Sun, LayoutGrid, Compass, BadgeCheck, BookOpen, Star, RefreshCw, Theater, Database, Heart, Video } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAutoHideNavbar } from "@/hooks/useAutoHideNavbar";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import { MenuIdentityCard } from "@/components/nav/MenuIdentityCard";
import { getMenuSections } from "@/components/nav/menuSections";
import { SCOUT_PATH, OPPORTUNITIES_PATH, isOpportunitySpace } from "@/lib/opportunityRoutes";
import { supabase } from "@/integrations/supabase/client";
import { releasePushForSignOut } from "@/lib/pushSubscription";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getTierDisplayName } from "@/lib/subscriptionConfig";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { useCrewUnread } from "@/hooks/useCrewUnread";
import { MessagesDrawer } from "@/components/messages/MessagesDrawer";
import { useAccountTone } from "@/hooks/useAccountTone";
import { CompanyModeBadge } from "@/components/company/CompanyModeBadge";

// useNavMode removed — single unified nav
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, memo, type ReactNode, type ComponentType } from "react";

interface NavbarProps {
  user?: SupabaseUser | null;
}

const Navbar = memo(({ user }: NavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { subscriptionInfo } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { isBusiness: isCompany } = useAccountTone();
  const accountType = isCompany ? "company" : "individual";
  const [isManagerMode, setIsManagerMode] = useState(false);
  // Only for the /landing connected-avatar trigger below -- everywhere
  // else the account menu opens off a plain Menu icon, not a photo.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState<string>("");
  const [menuProfile, setMenuProfile] = useState<{
    username: string | null; passport_profession: string | null; job_title: string | null;
    location: string | null; company_name: string | null; company_logo_url: string | null;
    company_tagline: string | null; company_industry: string | null; company_about: string | null;
  } | null>(null);
  const identityName = isCompany ? menuProfile?.company_name || avatarName : avatarName;
  const identityAvatar = isCompany ? menuProfile?.company_logo_url || avatarUrl : avatarUrl;
  const identitySummary = isCompany
    ? menuProfile?.company_tagline || menuProfile?.company_industry || menuProfile?.company_about
    : menuProfile?.passport_profession || menuProfile?.job_title;
  // Route-only, not gated by !user: a signed-in user reaching /landing
  // (via the Navbar's own logo, see below) should get this same marketing
  // chrome -- normal app nav/icons hidden, connected-avatar trigger instead
  // of the Sign Up/Log In CTAs -- not the full authenticated nav that
  // renders literally everywhere else, "/" included (which is their Today
  // dashboard, a different page from this one despite the shared name).
  const isLandingPage = location.pathname === "/landing";
  // Landing chrome follows the active theme, just like the feature pages.
  const isDarkChromeRoute = false;
  const isPro = subscriptionInfo.subscribed;
  const tierName = getTierDisplayName(subscriptionInfo.tier as any);
  const { unreadCount } = useNotifications();
  const inboxBadge = unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : undefined;
  const { badge: crewBadge } = useCrewUnread();

  // Sticky, subtly auto-hiding TopNavbar: hides on scroll-down, reveals on
  // scroll-up, dims slightly when idle. Never hides while the pointer is over
  // it, keyboard focus is inside it, a drawer is open, at the top of the
  // page, or reduced-motion is on — useAutoHideNavbar already forces
  // visibility for the last four; pointer/focus are tracked locally here
  // since they're per-element.
  const { hiddenByScroll, idle, idleOpacity, forceVisible } = useAutoHideNavbar();
  const [navHovered, setNavHovered] = useState(false);
  const [navFocused, setNavFocused] = useState(false);
  const navKeepVisible = navHovered || navFocused || forceVisible || isOpen || mobileSearchOpen;
  const navHidden = hiddenByScroll && !navKeepVisible && !!user;
  const navOpacity = !navKeepVisible && idle && !!user ? idleOpacity : 1;

  // UnifiedSearchDropdown's onSelect/onQuerySubmit fully replace its default
  // navigate() calls when provided, so hooking them to close the sheet would
  // break the actual navigation. Closing on route change instead covers
  // every way a search result can be opened (click, submit, "deep search").
  useEffect(() => {
    if (mobileSearchOpen) setMobileSearchOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    Promise.resolve(
      supabase
        .from("profiles")
        .select("is_manager_mode, avatar_url, full_name, username, passport_profession, job_title, location, company_name, company_logo_url, company_tagline, company_industry, company_about")
        .eq("user_id", user.id)
        .maybeSingle(),
    )
      .then(({ data }) => {

        setIsManagerMode(!!data?.is_manager_mode);
        setMenuProfile(data ?? null);
        setAvatarUrl(data?.avatar_url ?? null);
        setAvatarName(data?.full_name ?? "");
      })
      .catch((err) => console.warn("[Navbar] Error loading profile:", err));
  }, [user?.id]);

  const handleSignOut = async () => {
    try {
      setIsOpen(false);
      // Stop this device receiving the member's notifications while the session can still remove its subscription (bounded, never throws).
      await releasePushForSignOut();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[Navbar] Sign out error:", error);
        localStorage.removeItem("sb-kwmcocsitwssrtzkdojh-auth-token");
        sessionStorage.clear();
      }
      import("@/lib/analytics").then(({ analytics }) => analytics.signOut()).catch(() => {});
      toast({ title: "Signed out", description: "You've been successfully signed out" });
      navigate("/", { replace: true });
    } catch (error) {
      console.error("[Navbar] Sign out exception:", error);
      try {
        localStorage.removeItem("sb-kwmcocsitwssrtzkdojh-auth-token");
        sessionStorage.clear();
      } catch (e) {
        console.error("[Navbar] Error clearing storage:", e);
      }
      toast({ title: "Signed out", description: "You've been signed out locally" });
      navigate("/", { replace: true });
    }
  };

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };


  // Kretopia 2.0 Daily Driver — desktop nav mirrors mobile bottom nav
  const desktopNavItems = isCompany
    ? [
        { path: "/desk", icon: LayoutDashboard, label: "Studios" },
        { path: "/opportunities", icon: Briefcase, label: "Gigs" },
        { path: "/talent-finder", icon: Search, label: "Talent" },
        { path: "/thrivepay", icon: Wallet, label: "KrePay" },
      ]
    : [
        // Prioritized set — Today/Studio/Opportunities/Passport stay in the primary
        // row; Stages and Kreto (the dedicated page — the floating Kreto
        // mascot already gives one-tap chat access everywhere) moved into the
        // Menu's Explore section so nothing becomes unreachable, just less
        // crowded up top. Opportunities is the one entry for work: Scout (the
        // personalised search and shortlist) is inside it, and Perks and the
        // Founding status are inside Creative Circle.
        { path: "/", icon: Sun, label: "Today" },
        // Match sits right after Today, here and in the mobile bottom nav (and so is not repeated in the Menu below).
        { path: "/match", icon: Heart, label: "Match" },
        { path: "/desk", icon: LayoutGrid, label: "Studio" },
        { path: SCOUT_PATH, icon: Compass, label: "Scout" },
        { path: "/profile", icon: BadgeCheck, label: "Passport" },
      ];

  // search moved to Thrive bar — keep state stub removed

  // Guest navigation items: words only, as in the designer's KretopiaHero header.
  // KRETOPIA_PUBLIC_NAV_DROPDOWNS_V3
  // Public navigation only. Header chrome and authenticated nav unchanged.
  // KRETOPIA_PUBLIC_NAV_FOUR_LINKS_V5
  // Four direct links. No dropdowns.
  const guestNavItems = [
    { path: "/landing", label: "Platform" },
    { path: "/passport", label: "For Creatives" },
    { path: "/post-opportunity", label: "For Companies" },
    { path: "/discover", label: "Discover" },
  ];
  // The signed-out bar is the designer's: always visible and never dimmed, unlike the signed-in bar below.
  const guestBar = !user;

  // The search: the hero's field in a quick floating panel, shared by both bars.
  const searchSheet = (
    <SearchOverlay
      open={mobileSearchOpen}
      onOpenChange={setMobileSearchOpen}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className={cn(NAV_ICON_BUTTON, isDarkChromeRoute && "text-white hover:text-white hover:bg-white/10")}
          aria-label="Search"
        >
          <KretopiaIcon name="search" className={NAV_ICON} {...SEARCH_ICON} />
        </Button>
      }
    >
      <UnifiedSearchDropdown
        variant="hero"
        placeholder="People, projects, gigs…"
        autoFocus
        resultsMaxHeight="var(--k-search-room)"
        onSelect={!user ? (result) => navigate(
          result.type === "creator" ? `/profile/${result.id}`
            : result.type === "gig" ? `/opportunity/${result.id}`
            : `/production?name=${encodeURIComponent(result.title)}`,
        ) : undefined}
      />
    </SearchOverlay>
  );

  return (
    <nav
      data-nav-chrome

      className={cn(
        "sticky top-0 z-50 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
        isDarkChromeRoute
          ? "dark-surface border-b border-white/10 bg-[#05070D] text-white"
          : "k-top-bar",
      )}
      style={{
        transform: navHidden ? "translateY(-100%)" : "translateY(0)",
        opacity: navOpacity,
        paddingTop: "env(safe-area-inset-top)",
      }}
      role="navigation"
      aria-label="Main navigation"
      onMouseEnter={() => setNavHovered(true)}
      onMouseLeave={() => setNavHovered(false)}
      onFocus={() => setNavFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setNavFocused(false);
      }}
    >
      {guestBar ? (
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_5.5rem] px-4 py-2 sm:px-[clamp(20px,4vw,64px)] lg:min-h-20 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-[clamp(30px,4vw,64px)] lg:gap-y-0">
        {/* Row 1 on a phone: the lockup. The designer's is 166 px wide from the sm breakpoint, the smaller mark below it. */}
        <div className="col-start-1 row-start-1 shrink-0">
          <span className="sm:hidden"><BrandLogo size="md" showBeta linkToHome="/landing" /></span>
          <span className="hidden sm:block"><BrandLogo size="lg" showBeta linkToHome="/landing" /></span>
        </div>

        {/* The rubrics: row 2 on a phone and tablet (a row that scrolls sideways if it ever outgrows the screen, as the
            designer's does), the middle of the bar from lg, centred on the screen. */}
        <div className="k-site-nav col-start-1 row-start-2 flex lg:col-start-2 lg:row-start-1">
          {guestNavItems.map(({ path, label }) => (
            <Link
              key={label}
              to={path}
              aria-current={
                location.pathname === path
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Below lg this wrapper is display: contents, so search and the theme sit at the end of the rubrics' row (row 2) and
            Sign in and Join at the end of the lockup's row (row 1), spanning both columns (the second is a fixed 4.5 or 5.5rem, just
            wide enough for the two icons, so the actions cannot squeeze the rubrics);
            from lg they are one group on the right. */}
        <div className="contents lg:col-start-3 lg:row-start-1 lg:flex lg:items-center lg:justify-end lg:gap-2.5">
          <div className="col-start-2 row-start-2 flex items-center justify-self-end gap-0.5 sm:gap-1 lg:col-auto lg:row-auto lg:justify-self-auto">
            {searchSheet}
            <ThemeToggle />
          </div>
          <div className="col-span-2 col-start-1 row-start-1 flex items-center gap-2 justify-self-end lg:col-auto lg:row-auto lg:justify-self-auto">
            <Link to="/auth?tab=signin" className="k-nav-signin inline-flex items-center justify-center">
              Sign in
            </Link>
            <Link to="/auth?tab=signup" className="k-nav-join inline-flex items-center justify-center">
              Join Kretopia
            </Link>
          </div>
        </div>
      </div>
      ) : (
      <div className="container mx-auto flex items-center justify-between gap-1 px-2 py-2.5 sm:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-[clamp(24px,3vw,48px)]">
        <div className="shrink-0">
          <BrandLogo size="md" showBeta linkToHome="/landing" onDark={isDarkChromeRoute} />
        </div>

        {/* Desktop Navigation - Authenticated users: visible on every route, including /landing */}
        {user && (
          <div className="k-site-nav hidden lg:flex">
            {/* Mode toggle removed — single unified nav */}

            {desktopNavItems.map(({ path, label }) => {
              const isActive =
                location.pathname === path ||
                (path === "/desk" && location.pathname.startsWith("/desk")) ||
                (path === "/messages" &&
                  (location.pathname.startsWith("/messages") || location.pathname.startsWith("/inbox"))) ||
                (path === "/circle" &&
                  location.pathname.startsWith("/circle") &&
                  !location.pathname.startsWith("/circles")) ||
                ((path === SCOUT_PATH || path === OPPORTUNITIES_PATH) && isOpportunitySpace(location.pathname)) ||
                (path === "/profile" &&
                  (location.pathname.startsWith("/profile") ||
                    location.pathname.startsWith("/thrivepay") ||
                    location.pathname.startsWith("/accounting") ||
                    location.pathname.startsWith("/credits")));
              return (
                <Link key={path} to={path} aria-current={isActive ? "page" : undefined}>
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2 lg:justify-self-end">
          {/* Top nav: Logo · · · ✉ 🔔 ☰ */}
          {searchSheet}
          {!isLandingPage && user && (
            <MessagesDrawer
              triggerClassName={isDarkChromeRoute ? "text-white hover:text-white hover:bg-white/10" : undefined}
            />
          )}

          {!isLandingPage && user && (
            <NotificationCenter
              triggerClassName={isDarkChromeRoute ? "text-white hover:text-white hover:bg-white/10" : undefined}
            />
          )}
          {/* Signed-in app bar keeps four icons: search, messages, notifications, menu. Settings and the theme switch live in the menu. */}
          {!(user && !isLandingPage) && <ThemeToggle />}

          {user ? (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                {isLandingPage ? (
                  // Connected state on the marketing page itself: a small
                  // avatar instead of the Sign Up/Log In CTAs a guest sees
                  // here, and instead of the plain Menu icon this same
                  // Sheet opens off everywhere else in the app -- the one
                  // visible sign, right on the landing page, that this is
                  // your account and not a fresh visit.
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="rounded-full shrink-0 ring-2 ring-white/25 hover:ring-white/50 transition-all"
                  >
                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                      <AvatarImage src={avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="text-xs font-semibold">
                        {avatarName ? avatarName.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open menu"
                    className={cn(NAV_ICON_BUTTON, isDarkChromeRoute && "text-white hover:text-white hover:bg-white/10")}
                  >
                    {/* Three equal bars; an X while the menu is open (isOpen) and, for a mouse, under the pointer. The trigger itself carries
                        aria-expanded and aria-controls (Radix). */}
                    <HamburgerIcon open={isOpen} />
                  </Button>
                )}
              </SheetTrigger>
              <SheetContent
                side="right"
                className="k-menu-sheet flex h-[100dvh] max-h-[100dvh] w-[85vw] max-w-[400px] sm:w-[400px] flex-col overflow-hidden text-foreground"
              >
                <SheetHeader className="shrink-0 text-left">
                  <BrandLogo size="sm" showBeta />
                  <SheetTitle className="font-serif text-2xl font-normal mt-1">Menu</SheetTitle>
                  <MenuIdentityCard
                    isCompany={isCompany}
                    name={identityName}
                    avatarUrl={identityAvatar ?? null}
                    username={menuProfile?.username ?? null}
                    summary={identitySummary}
                    location={menuProfile?.location ?? null}
                    industry={menuProfile?.company_industry}
                    onOpen={() => handleNavigation(isCompany ? `/profile/${user.id}` : "/profile")}
                  />
                </SheetHeader>

                {/* [&>*]:shrink-0 is load-bearing, not decorative: every row
                    here (Subscription, StorageMeter, AccountSwitcher's two
                    rows, the grids, Sign Out) has overflow:hidden via the
                    shared .btn-glass button styling, which per the flexbox
                    spec makes its automatic min-height resolve to 0 instead
                    of content-based. Without shrink-0, once this list's
                    natural content height exceeds max-h below, the flex
                    algorithm silently *shrinks* multi-line rows toward that
                    zero minimum (clipping "Upgrade →", "Currently: Personal",
                    etc.) instead of just scrolling — confirmed live: removing
                    shrink prevention collapsed Subscription to 26px and
                    Switch-to-Company to 18px, both with the second line
                    rendered but invisible underneath the first. */}
                <div className="flex flex-col gap-1 mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] -mx-1 px-1 [&>*]:shrink-0">
                  {getMenuSections(isCompany, isManagerMode).map((section, index) => (
                    <section key={section.title} aria-label={section.title}>
                      {index > 0 && <Separator className="my-3" />}
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</p>
                      <MenuGrid>
                        {section.items.map(item => <MenuGridTile key={item.path} {...item} onClick={() => handleNavigation(item.path)} />)}
                      </MenuGrid>
                    </section>
                  ))}
                  <Separator className="my-3" />
                  <section aria-label="Account" className="mt-auto">
                      <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Account
                      </p>
                      <Button
                        variant="ghost"
                        className="justify-start gap-3 h-auto w-full py-3"
                        onClick={() => handleNavigation("/subscription")}
                      >
                        {isPro ? (
                          <Crown className="h-5 w-5 text-accent" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-primary" />
                        )}
                        <div className="flex flex-col items-start gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Subscription</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] uppercase tracking-wider",
                                isPro ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {tierName}
                            </Badge>
                          </div>
                          {!isPro && <span className="text-xs text-primary font-medium">Upgrade →</span>}
                        </div>
                      </Button>
                      <div className="px-1 py-1">
                        <StorageMeter variant="compact" />
                      </div>
                      <AccountSwitcher
                        currentAccountType={accountType}
                        onSwitch={() => setIsOpen(false)}
                        onManagerModeChange={(enabled) => setIsManagerMode(enabled)}
                      />
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <MenuButton icon={Settings} label="Settings" onClick={() => handleNavigation("/settings")} />
                        </div>
                        <ThemeToggle className="h-10 w-10" />
                      </div>
                    {user.id === "ef429714-ea32-4f08-a4f9-ef0226f1804b" && (
                      <MenuButton icon={Shield} label="Admin Panel" onClick={() => handleNavigation("/admin")} />
                    )}
                  </section>
                  <Separator className="my-3" />

                  <Button
                    variant="outline"
                    className="justify-start gap-3 h-12 text-destructive hover:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : null}
        </div>
      </div>
      )}
    </nav>
  );
});

/* Responsive grid tile for the Menu sheet's feature/navigation items --
   auto-fill + minmax adapts to the sheet's own rendered width (85vw on
   mobile, 400px fixed above sm:) rather than the viewport breakpoints
   Tailwind's sm:/lg: prefixes key off, which don't track a fixed-width
   panel's actual size. */
function MenuGridTile({
  icon: Icon,
  label,
  onClick,
  badge,
  path,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  badge?: string;
  path?: string;
}) {
  const location = useLocation();
  const isActive = !!path && (path === location.pathname || (path !== "/" && location.pathname.startsWith(path + "/")));
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      className={cn(
        "k-menu-tile relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-3.5 min-h-[76px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy",
        isActive && "is-active text-energy",
      )}
    >
      <Icon className="k-menu-tile-icon h-5 w-5 shrink-0" />
      <span className="w-full break-words text-[11px] font-medium leading-tight line-clamp-2">{label}</span>
      {badge && (
        <Badge className="absolute top-1.5 right-1.5 bg-primary/15 text-primary text-[9px] px-1.5 h-4">{badge}</Badge>
      )}
    </Button>
  );
}

function MenuGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

/* Reusable menu button */
function MenuButton({
  icon: Icon,
  label,
  onClick,
  badge,
  path,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  badge?: string;
  path?: string;
}) {
  const location = useLocation();
  const isActive = !!path && (path === location.pathname || (path !== "/" && location.pathname.startsWith(path + "/")));
  return (
    <Button
      variant="ghost"
      className={cn("justify-start gap-3 h-12 w-full", isActive && "bg-energy/10 text-energy hover:bg-energy/15")}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5" />
      <span className="flex-1 text-left">{label}</span>
      {badge && <Badge className="bg-primary/10 text-primary text-[10px] px-1.5">{badge}</Badge>}
    </Button>
  );
}

Navbar.displayName = "Navbar";

export default Navbar;
