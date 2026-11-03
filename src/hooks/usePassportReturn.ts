import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { restoreScrollTop } from "@/lib/appScroller";
import { readRestoreScrollTop, returnState } from "@/lib/passportReturn";

/** navigate() for opening a detail view from a Passport: it remembers where, and how far down, so the view can offer the way back. */
export function useNavigateWithReturn(label = "Passport") {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (to: string) => navigate(to, { state: returnState(location.pathname + location.search, label) }),
    [navigate, location.pathname, location.search, label],
  );
}

/** On a Passport page: when we arrive from the back link, scroll to where the person was. Runs once per arrival. */
export function useRestoreReturnScroll() {
  const location = useLocation();
  const done = useRef<string | null>(null);
  useEffect(() => {
    const top = readRestoreScrollTop(location.state);
    if (!top || done.current === location.key) return;
    done.current = location.key;
    return restoreScrollTop(top);
  }, [location.key, location.state]);
}
