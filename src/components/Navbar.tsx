import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GlassCta } from "@/components/ui/glass-cta";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  Plus,
  Menu,
  Settings,
  Users,
  User,
  Briefcase,
  MessageCircle,
  Shield,
  Crown,
  Sparkles,
  DollarSign,
  FolderKanban,
  LayoutDashboard,
  Radar,
  Search,
  BarChart3,
  ShoppingBag,
  Share2,
  Rocket,
  Wallet,
  MapPin,
  Trophy,
  CheckCircle,
  Target,
  Zap,
  CalendarDays,
  UserPlus,
  UserCircle2,
  Building2,
  Inbox,
  Sun,
  LayoutGrid,
  Compass,
  BadgeCheck,
  BookOpen,
  Gift,
  Star,
  RefreshCw,
  Theater,
  Database,
  Heart,
  Video,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAutoHideNavbar } from "@/hooks/useAutoHideNavbar";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
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
import { SettingsDrawer } from "@/components/SettingsDrawer";
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
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);
  const { isBusiness: isCompany } = useAccountTone();
  const accountType = isCompany ? "company" : "individual";
  const [isManagerMode, setIsManagerMode] = useState(false);
  // Only for the /landing connected-avatar trigger below -- everywhere
  // else the account menu opens off a plain Menu icon, not a photo.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState<string>("");
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
  const navKeepVisible = navHovered || navFocused || forceVisible || isOpen || guestMenuOpen || mobileSearchOpen;
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
        .select("is_manager_mode, avatar_url, full_name")
        .eq("user_id", user.id)
        .maybeSingle(),
    )
      .then(({ data }) => {
        
        if (data?.is_manager_mode) setIsManagerMode(true);
        setAvatarUrl(data?.avatar_url ?? null);
        setAvatarName(data?.full_name ?? "");
      })
      .catch((err) => console.warn("[Navbar] Error loading profile:", err));
  }, [user?.id]);

  const handleSignOut = async () => {
    try {
      setIsOpen(false);
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
        { path: "/thrivepay", icon: Wallet, label: "Pay" },
      ]
    : [
        // Prioritized set — Today/Studio/Scout/Passport stay in the primary
        // row; Stages, Kreto (the dedicated page — the floating Kreto
        // mascot already gives one-tap chat access everywhere) and
        // Perks moved into the Menu's Explore section so nothing becomes
        // unreachable, just less crowded up top.
        { path: "/", icon: Sun, label: "Today" },
        { path: "/desk", icon: LayoutGrid, label: "Studio" },
        { path: "/scout", icon: Compass, label: "Scout" },
        { path: "/profile", icon: BadgeCheck, label: "Passport" },
      ];

  // search moved to Thrive bar — keep state stub removed

  // Guest navigation items: words only, as in the designer's KretopiaHero header.
  const guestNavItems = [
    { path: "/credits", label: "Credits" },
    { path: "/spotlight", label: "Spotlight" },
    { path: "/about", label: "About Us" },
  ];
  // The signed-out bar is the designer's: always visible and never dimmed, unlike the signed-in bar below.
  const guestBar = !user;

  return (
    <nav
      data-nav-chrome

      className={cn(
        "sticky top-0 z-50 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
        isDarkChromeRoute
          ? "dark-surface border-b border-white/10 bg-[#05070D] text-white"
          : user
            ? "border-b border-border/60 glass-surface-elevated rounded-none border-x-0 border-t-0"
            : "k-guest-nav",
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
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-1",
          guestBar
            ? "min-h-20 w-full max-w-[1440px] px-4 py-2 sm:px-[clamp(20px,4vw,64px)] lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-[clamp(30px,4vw,64px)]"
            : "container px-2 sm:px-4 py-2.5",
        )}
      >
        <div className="shrink-0">
          {guestBar ? (
            // The designer's lockup is wider than the signed-in bar's: 166 px from `sm`, the smaller mark on a phone.
            <>
              <span className="sm:hidden"><BrandLogo size="md" showBeta linkToHome="/landing" /></span>
              <span className="hidden sm:block"><BrandLogo size="lg" showBeta linkToHome="/landing" /></span>
            </>
          ) : (
            <BrandLogo size="md" showBeta linkToHome="/landing" onDark={isDarkChromeRoute} />
          )}
        </div>

        {/* ═══ GUEST INLINE NAV (desktop) ═══
            lg:, matching the authenticated desktop nav's own breakpoint below —
            at md: (768px) this plus the search icon, Hire Talent and Get
            Started together overflow the viewport and clip the CTA button
            off-screen. Tablets get the hamburger menu instead, same as the
            authenticated experience already does. */}
        {!user && (
          <div className="k-site-nav hidden lg:flex">
            {guestNavItems.map(({ path, label }) => (
              <Link key={path} to={path} aria-current={location.pathname === path ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* Desktop Navigation - Authenticated users: visible on every route, including /landing */}
        {user && (
          <div className="hidden lg:flex items-center gap-2 mx-6 pl-6 border-l border-border/50">
            {/* Mode toggle removed — single unified nav */}

            {desktopNavItems.map(({ path, icon: Icon, label }) => {
              const isActive =
                location.pathname === path ||
                (path === "/desk" && location.pathname.startsWith("/desk")) ||
                (path === "/messages" &&
                  (location.pathname.startsWith("/messages") || location.pathname.startsWith("/inbox"))) ||
                (path === "/circle" &&
                  location.pathname.startsWith("/circle") &&
                  !location.pathname.startsWith("/circles")) ||
                (path === "/scout" &&
                  (location.pathname.startsWith("/scout") ||
                    location.pathname === "/opportunities" ||
                    location.pathname === "/opportunity-dashboard")) ||
                (path === "/profile" &&
                  (location.pathname.startsWith("/profile") ||
                    location.pathname.startsWith("/thrivepay") ||
                    location.pathname.startsWith("/accounting") ||
                    location.pathname.startsWith("/credits")));
              return (
                <Link
                  key={path}
                  to={path}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={label}
                  className={cn(
                    "relative flex items-center gap-2 h-10 px-3.5 rounded-lg transition-smooth text-sm font-medium whitespace-nowrap border",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "text-foreground border-white/15 bg-white/[0.04]"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:border-white/10 hover:bg-white/[0.02]",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        <div className={cn("flex items-center gap-0.5 ml-auto shrink-0", guestBar ? "sm:gap-2.5" : "sm:gap-2")}>
          {/* Top nav: Logo · · · ✉ 🔔 ☰ */}
          <Sheet open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "relative h-8 w-8 sm:h-10 sm:w-10",
                  isDarkChromeRoute && "text-white hover:text-white hover:bg-white/10",
                )}
                aria-label="Search"
              >
                <Search className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </Button>
            </SheetTrigger>
            {/* A light glass panel under the navbar, not a slab over it, on a strongly blurred page. */}
            <SheetContent
              side="top"
              overlayClassName="bg-background/20 backdrop-blur-2xl"
              className={cn("k-nav-search-sheet mx-auto w-[min(44rem,calc(100vw-1.5rem))] rounded-2xl border p-4 sm:p-5", guestBar ? "top-[calc(5.25rem+env(safe-area-inset-top,0px))]" : "top-[calc(4.25rem+env(safe-area-inset-top,0px))]")}
            >
              <SheetHeader className="mx-auto w-full max-w-2xl">
                <SheetTitle className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Search <span className="k-gradient-text">Kretopia</span>
                </SheetTitle>
              </SheetHeader>
              <div className="k-nav-search mx-auto mt-3 w-full max-w-2xl">
                <UnifiedSearchDropdown
                  variant="hero"
                  placeholder="People, projects, opportunities…"
                  autoFocus
                  onSelect={!user ? (result) => navigate(
                    result.type === "creator" ? `/profile/${result.id}`
                      : result.type === "gig" ? `/opportunity/${result.id}`
                      : `/production?name=${encodeURIComponent(result.title)}`,
                  ) : undefined}
                />
              </div>
            </SheetContent>
          </Sheet>
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
          {!isLandingPage && user && (
            <SettingsDrawer
              triggerClassName={isDarkChromeRoute ? "text-white hover:text-white hover:bg-white/10" : undefined}
            />
          )}
          <ThemeToggle />

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
                    className={cn(
                      "h-8 w-8 sm:h-10 sm:w-10",
                      isDarkChromeRoute && "text-white hover:text-white hover:bg-white/10",
                    )}
                  >
                    <Menu className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                  </Button>
                )}
              </SheetTrigger>
              <SheetContent
                side="right"
                className="k-menu-sheet flex h-[100dvh] max-h-[100dvh] w-[85vw] max-w-[400px] sm:w-[400px] flex-col overflow-hidden text-foreground"
              >
                <SheetHeader className="shrink-0 pr-8 text-left">
                  <BrandLogo size="sm" showBeta />
                  <SheetTitle className="font-serif text-2xl font-normal mt-1">Menu</SheetTitle>
                  {isCompany && <CompanyModeBadge className="w-fit" />}
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
                  {isCompany ? (
                    /* Company workspace and the same shared feature access as Creator. */
                    <>
                      {/* ACCOUNT — pinned to the top in Company mode too,
                          exactly mirroring the Personal Creator menu order. */}
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
                      <MenuButton icon={Settings} label="Settings" onClick={() => handleNavigation("/settings")} />
                      <Separator className="my-3" />
                      <MenuGrid>
                        <MenuGridTile
                          icon={Inbox}
                          label="Inbox"
                          onClick={() => handleNavigation("/inbox")}
                          path="/inbox"
                          badge={inboxBadge}
                        />
                        {[
                          { icon: LayoutGrid, label: "Studios", path: "/desk" },
                          { icon: Briefcase, label: "Gigs", path: "/opportunities" },
                          { icon: Search, label: "Talent", path: "/talent-finder" },
                          { icon: Wallet, label: "Pay", path: "/thrivepay" },
                          { icon: Users, label: "Applicants", path: "/opportunity-dashboard" },
                          { icon: Plus, label: "Post a Gig", path: "/post-opportunity" },
                          { icon: Building2, label: "Clients", path: "/clients" },
                        ].map(item => <MenuGridTile key={item.path} {...item} onClick={() => handleNavigation(item.path)} />)}
                        <MenuGridTile
                          icon={User}
                          label="Company Page"
                          onClick={() => handleNavigation(`/profile/${user?.id}`)}
                          path={`/profile/${user?.id}`}
                        />
                        {isManagerMode && (
                          <MenuGridTile
                            icon={Users}
                            label="Talent Manager"
                            onClick={() => handleNavigation("/talent-manager")}
                            path="/talent-manager"
                          />
                        )}
                      </MenuGrid>
                      <Separator className="my-3" />
                       <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Explore</p>
                       <MenuGrid>
                         {[
                           { icon: Sun, label: "Today", path: "/" },
                           { icon: Compass, label: "Scout", path: "/scout" },
                           { icon: Theater, label: "Stages", path: "/circle" },
                           { icon: Sparkles, label: "Kreto", path: "/kreto" },
                           { icon: Heart, label: "Match", path: "/match" },
                           { icon: Gift, label: "Perks", path: "/perks" },
                           { icon: CalendarDays, label: "Events", path: "/meetup" },
                           { icon: Video, label: "Recordings", path: "/recordings" },
                           { icon: Sparkles, label: "Spotlight", path: "/spotlight" },
                           { icon: Database, label: "Credits", path: "/credits" },
                           { icon: Crown, label: "Founding Circle", path: "/founding-member" },
                           { icon: UserPlus, label: "Creative Circle", path: "/creative-circle" },
                           { icon: FolderKanban, label: "Brand Vault", path: "/brand-vault" },
                         ].map(item => <MenuGridTile key={item.path} {...item} onClick={() => handleNavigation(item.path)} />)}
                       </MenuGrid>
                    </>
                  ) : (
                    /* ====== DAILY DRIVER MENU — System + Account only ====== */
                    <>
                      {/* ACCOUNT */}
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

                      <Separator className="my-3" />

                      {/* WORKSPACE — daily shortcuts only. Today/Desk live in bottom nav; Pay in Passport. */}
                      <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Workspace
                      </p>
                      <MenuGrid>
                        <MenuGridTile
                          icon={DollarSign}
                          label="KrePay"
                          onClick={() => handleNavigation("/thrivepay")}
                          path="/thrivepay"
                        />
                        <MenuGridTile
                          icon={Building2}
                          label="Clients"
                          onClick={() => handleNavigation("/clients")}
                          path="/clients"
                        />
                        {/* Crews hidden from UI — data preserved, deep links still work via /crews. Group chat lives in Messages. */}
                        {isManagerMode && (
                          <MenuGridTile
                            icon={Users}
                            label="Manager Mode"
                            onClick={() => handleNavigation("/talent-manager")}
                            path="/talent-manager"
                          />
                        )}
                      </MenuGrid>

                      <Separator className="my-3" />

                      {/* PILLARS — live surfaces not in bottom nav */}
                      <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Explore
                      </p>
                      <MenuGrid>
                        {/* "Stages" -> /circle is the one entry point here. /soundstages
                            renders the same live-stages feed with no other chrome (confirmed
                            duplicate content, not just a duplicate label) -- it stays reachable
                            from inside /circle and from every in-app "Join"/"Start Stage" button,
                            it just doesn't need its own top-level menu entry too. */}
                        <MenuGridTile
                          icon={Theater}
                          label="Stages"
                          onClick={() => handleNavigation("/circle")}
                          path="/circle"
                        />
                        <MenuGridTile
                          icon={Sparkles}
                          label="Kreto"
                          onClick={() => handleNavigation("/kreto")}
                          path="/kreto"
                        />
                        <MenuGridTile
                          icon={Heart}
                          label="Match"
                          onClick={() => handleNavigation("/match")}
                          path="/match"
                        />
                        <MenuGridTile
                          icon={Gift}
                          label="Perks"
                          onClick={() => handleNavigation("/perks")}
                          path="/perks"
                        />
                        <MenuGridTile
                          icon={CalendarDays}
                          label="Events"
                          onClick={() => handleNavigation("/meetup")}
                          path="/meetup"
                        />
                        <MenuGridTile
                          icon={Video}
                          label="Recordings"
                          onClick={() => handleNavigation("/recordings")}
                          path="/recordings"
                        />
                      </MenuGrid>

                      <Separator className="my-3" />

                      {/* MORE — keep lean. Brand Vault/Referrals reachable by direct URL.
                          Spotlight restored here — it's the only path to the Magazine
                          "Write" (edit/upload article) button for editors/admins, and
                          direct-URL-only made that undiscoverable. */}
                      <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        More
                      </p>
                      <MenuGrid>
                        <MenuGridTile
                          icon={Sparkles}
                          label="Spotlight"
                          onClick={() => handleNavigation("/spotlight")}
                          path="/spotlight"
                        />
                        <MenuGridTile
                          icon={Database}
                          label="Credits"
                          onClick={() => handleNavigation("/credits")}
                          path="/credits"
                        />
                        <MenuGridTile
                          icon={Crown}
                          label="Founding Circle"
                          onClick={() => handleNavigation("/founding-member")}
                          path="/founding-member"
                        />
                        <MenuGridTile
                          icon={UserPlus}
                          label="Creative Circle"
                          onClick={() => handleNavigation("/creative-circle")}
                          path="/creative-circle"
                        />
                      </MenuGrid>

                      {/* Settings and Support sections removed from this menu by request --
                          Settings (incl. Notifications/Memory & Agent/Language/Privacy/Appearance)
                          is unchanged and still one tap away via the gear icon in the top nav
                          (SettingsDrawer renders the exact same Settings page, embedded). Feedback
                          still fires via the "open-feedback" event from wherever else it's wired;
                          Help Centre (/help) and About (/about) remain live routes, just not
                          listed here. */}

                      {/* ADMIN */}
                      {user?.id === "ef429714-ea32-4f08-a4f9-ef0226f1804b" && (
                        <>
                          <Separator className="my-3" />

                       <Separator className="my-3" />
                          <MenuButton icon={Shield} label="Admin Panel" onClick={() => handleNavigation("/admin")} />
                        </>
                      )}
                    </>
                  )}

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
          ) : !user ? (
            <>
              {/* Hamburger for guests below lg: — matches the inline nav's
                  own breakpoint above so tablets always have one working
                  way to reach these links, never neither. */}
              <Sheet open={guestMenuOpen} onOpenChange={setGuestMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open menu"
                    className={cn(
                      "h-9 w-9 lg:hidden",
                      isDarkChromeRoute && "text-white hover:text-white hover:bg-white/10",
                    )}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[80vw] sm:w-[320px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 mt-6">
                    <Button
                      variant="ghost"
                      className={cn(
                        "justify-start h-12 gap-2 text-sm font-medium",
                        location.pathname === "/" && "bg-accent/30",
                      )}
                      onClick={() => {
                        setGuestMenuOpen(false);
                        navigate("/");
                      }}
                    >
                      Home
                    </Button>
                    {guestNavItems.map(({ path, label }) => (
                      <Button
                        key={path}
                        variant="ghost"
                        className={cn(
                          "justify-start h-12 gap-2 text-sm font-medium",
                          location.pathname === path && "bg-accent/30",
                        )}
                        onClick={() => {
                          setGuestMenuOpen(false);
                          navigate(path);
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                    <Separator className="my-3" />
                    <Button
                      variant="ghost"
                      className="justify-start h-12 gap-2 text-sm font-medium"
                      onClick={() => {
                        setGuestMenuOpen(false);
                        navigate("/auth?tab=signin");
                      }}
                    >
                      Sign in
                    </Button>
                    <Button
                      variant="default"
                      className="nav-btn-plain bg-primary text-primary-foreground hover:bg-primary/90 justify-start h-12 gap-2 text-sm font-semibold"
                      onClick={() => {
                        setGuestMenuOpen(false);
                        navigate("/auth?tab=signup");
                      }}
                    >
                      Join Kretopia
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              <Link to="/auth?tab=signin" className="k-nav-signin hidden items-center justify-center sm:inline-flex">
                Sign in
              </Link>
              <Link to="/auth?tab=signup" className="k-nav-join inline-flex items-center justify-center">
                Join Kretopia
              </Link>
            </>
          ) : null}
        </div>
      </div>
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
    <button
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
    </button>
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
