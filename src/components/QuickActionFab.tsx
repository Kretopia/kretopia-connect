import { useState, useEffect, useRef, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, X, CalendarPlus, Briefcase, FolderPlus, Compass, LayoutDashboard, UserSearch, Wallet, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// This FAB is mounted on every page (App.tsx renders it unconditionally
// whenever the bottom nav shows), so a plain static import of any dialog
// here put its whole dependency tree in the main bundle for every visitor,
// whether they ever open it or not. VoiceFirstCreateModal alone pulled in
// pdfjs-dist (~790KB minified) via its brief-document text extraction.
// Lazy-loading defers each dialog's code until the user actually opens it.
const CreateSessionDialog = lazyWithRetry(() =>
  import("@/components/sessions/CreateSessionDialog").then((m) => ({ default: m.CreateSessionDialog })),
);
const VoiceFirstCreateModal = lazyWithRetry(() =>
  import("@/components/project/studio/VoiceFirstCreateModal").then((m) => ({ default: m.VoiceFirstCreateModal })),
);
const PostOpportunityDialog = lazyWithRetry(() =>
  import("@/components/PostOpportunityDialog").then((m) => ({ default: m.PostOpportunityDialog })),
);
const ScoutEventDialog = lazyWithRetry(() =>
  import("@/components/sessions/ScoutEventDialog").then((m) => ({ default: m.ScoutEventDialog })),
);

interface QuickAction {
  id: string;
  label: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "lime" | "primary" | "muted";
  onSelect: () => void;
  hide?: boolean;
}

/**
 * Floating quick-action button anchored above the bottom nav.
 * Mobile-only (matches BottomNav). Tapping `+` opens a sheet of contextual
 * shortcuts that go straight to the right CTA dialog or page.
 */
const QuickActionFab = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [isCompany, setIsCompany] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Hide FAB when any Radix dialog/sheet is open (it locks body scroll).
  // Prevents the FAB from sitting on top of menu sheets and modal close buttons.
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
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("quickFab.dismissed") === "1";
  });

  // Keep state in sync if dismissed from another tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "quickFab.dismissed") {
        setDismissed(e.newValue === "1");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const dismissFab = () => {
    localStorage.setItem("quickFab.dismissed", "1");
    setDismissed(true);
    setOpen(false);
  };

  // Dialogs
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showPostGig, setShowPostGig] = useState(false);
  const [showScoutEvent, setShowScoutEvent] = useState(false);

  // Track "opened at least once" per dialog so each lazy chunk loads only
  // the first time it's actually needed, then stays mounted for the rest
  // of the session (so closing still gets its normal exit animation
  // instead of vanishing the instant showX flips back to false).
  const everOpened = useRef({ event: false, project: false, gig: false, scout: false });
  if (showCreateEvent) everOpened.current.event = true;
  if (showCreateProject) everOpened.current.project = true;
  if (showPostGig) everOpened.current.gig = true;
  if (showScoutEvent) everOpened.current.scout = true;

  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.resolve(
      supabase
        .from("profiles")
        .select("account_type")
        .eq("user_id", user.id)
        .maybeSingle()
    )
      .then(({ data }) => setIsCompany(data?.account_type === "company"))
      .catch((err) => console.warn("[QuickActionFab] profile load failed:", err));
  }, [user?.id]);

  // Close sheet on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Hide on auth and other full-screen routes
  if (location.pathname === "/auth") return null;
  // Routes that mount their own route-specific FAB — avoid stacking two FABs
  const ROUTES_WITH_OWN_FAB = ["/thrivepay", "/accounting"];
  if (ROUTES_WITH_OWN_FAB.some((p) => location.pathname.startsWith(p))) return null;
  if (!user) return null;
  // Note: previously hid when any dialog/sheet was open, but the ＋ is now a
  // primary nav element so we keep it visible. The sheet itself layers above.

  const close = () => setOpen(false);
  const go = (path: string) => {
    close();
    navigate(path);
  };

  const creatorActions: QuickAction[] = [
    {
      id: "host-event",
      label: "Host an event",
      sub: "Studio session, mixer, gathering",
      icon: CalendarPlus,
      tone: "lime",
      onSelect: () => {
        close();
        setShowCreateEvent(true);
      },
    },
    {
      id: "scout-event",
      label: "Scout an event",
      sub: "Saw a flyer or link? List it here",
      icon: Scan,
      tone: "primary",
      onSelect: () => {
        close();
        setShowScoutEvent(true);
      },
    },
    {
      id: "post-gig",
      label: "Post a gig",
      sub: "Hire, collab, or barter",
      icon: Briefcase,
      tone: "primary",
      onSelect: () => {
        close();
        setShowPostGig(true);
      },
    },
    {
      id: "new-project",
      label: "Start a project",
      sub: "Brief, contracts, files",
      icon: FolderPlus,
      tone: "primary",
      onSelect: () => {
        close();
        setShowCreateProject(true);
      },
    },
    {
      id: "find-project",
      label: "Find a gig",
      sub: "Browse opportunities",
      icon: Compass,
      tone: "muted",
      onSelect: () => go("/opportunities"),
    },
    {
      id: "manage-projects",
      label: "Manage projects",
      sub: "Open Studios",
      icon: LayoutDashboard,
      tone: "muted",
      onSelect: () => go("/desk"),
    },
  ];

  const companyActions: QuickAction[] = [
    {
      id: "post-gig",
      label: "Post a gig",
      sub: "Hire creators or send a brief",
      icon: Briefcase,
      tone: "lime",
      onSelect: () => {
        close();
        setShowPostGig(true);
      },
    },
    {
      id: "find-talent",
      label: "Find talent",
      sub: "Smart Talent Finder",
      icon: UserSearch,
      tone: "primary",
      onSelect: () => go("/talent-finder"),
    },
    {
      id: "host-event",
      label: "Host an event",
      sub: "Activation, launch, mixer",
      icon: CalendarPlus,
      tone: "primary",
      onSelect: () => {
        close();
        setShowCreateEvent(true);
      },
    },
    {
      id: "scout-event",
      label: "Scout an event",
      sub: "Spotted one? List it for the host",
      icon: Scan,
      tone: "muted",
      onSelect: () => {
        close();
        setShowScoutEvent(true);
      },
    },
    {
      id: "new-project",
      label: "Start a project",
      sub: "Onboard a creator",
      icon: FolderPlus,
      tone: "muted",
      onSelect: () => {
        close();
        setShowCreateProject(true);
      },
    },
    {
      id: "thrivepay",
      label: "Send / request payment",
      sub: "KrePay",
      icon: Wallet,
      tone: "muted",
      onSelect: () => go("/thrivepay"),
    },
  ];

  const actions = (isCompany ? companyActions : creatorActions).filter((a) => !a.hide);

  // Center ＋ — float ABOVE the bottom nav (nav ≈ 66px tall incl. safe area).
  // Sit just above the bottom nav (~66px tall), centered in the spacer slot,
  // so it doesn't overlap the Thrive composer bar that floats above the nav.
  const fabBottom = "calc(env(safe-area-inset-bottom, 0px) + 14px)";

  return (
    <>
      {/* Backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close quick actions"
          onClick={close}
          className="fixed inset-0 z-[55] lg:hidden bg-background/70 animate-in fade-in duration-150"
        />
      )}

      {/* Action sheet */}
      {open && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-label="Quick actions"
          className="fixed left-0 right-0 z-[56] lg:hidden px-4 animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + 150px)` }}
        >
          <div className="mx-auto max-w-md bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/50">
              <div>
                <p className="text-sm font-semibold leading-tight">Quick actions</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Jump straight to it
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="py-1.5">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.id}>
                    <button
                      onClick={a.onSelect}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 active:bg-muted transition-colors touch-manipulation"
                    >
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                          a.tone === "lime" && "bg-energy/15 text-energy",
                          a.tone === "primary" && "bg-primary/15 text-primary",
                          a.tone === "muted" && "bg-muted text-foreground/80"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{a.label}</p>
                        {a.sub && (
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                            {a.sub}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* The center ＋ — anchored to the middle of the bottom nav.
          Hidden while the Thrive composer/sheet is open so it doesn't
          cover the chat input. */}
      <div
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-[57] lg:hidden transition-opacity duration-150",
          overlayOpen && !open ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        style={{ bottom: fabBottom }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          aria-expanded={open}
          className={cn(
            "btn-glass btn-glass-primary h-14 w-14 rounded-full flex items-center justify-center",
            "text-energy-foreground",
            "border-4 border-background",
            open && "rotate-45"
          )}
        >
          <Plus className="h-7 w-7" strokeWidth={2.5} />
        </button>
      </div>

      {/* Mounted dialogs — lazy, and only once each has actually been
          opened (see everOpened above), so none of their code loads until
          the user picks that specific action. */}
      {everOpened.current.event && (
        <Suspense fallback={null}>
          <CreateSessionDialog
            open={showCreateEvent}
            onOpenChange={setShowCreateEvent}
            onCreated={() => navigate("/events/backstage")}
          />
        </Suspense>
      )}
      {everOpened.current.project && (
        <Suspense fallback={null}>
          <VoiceFirstCreateModal
            open={showCreateProject}
            onOpenChange={setShowCreateProject}
            onCreated={() => setShowCreateProject(false)}
            onExpand={() => { setShowCreateProject(false); navigate("/desk/new-room"); }}
          />
        </Suspense>
      )}
      {everOpened.current.gig && (
        <Suspense fallback={null}>
          <PostOpportunityDialog
            open={showPostGig}
            onOpenChange={setShowPostGig}
          />
        </Suspense>
      )}
      {everOpened.current.scout && (
        <Suspense fallback={null}>
          <ScoutEventDialog
            open={showScoutEvent}
            onOpenChange={setShowScoutEvent}
          />
        </Suspense>
      )}
    </>
  );
};

export default QuickActionFab;
