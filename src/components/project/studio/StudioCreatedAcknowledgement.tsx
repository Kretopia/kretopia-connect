import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KretoPresence } from "@/components/brand/KretoPresence";

/**
 * One-time Kreto "your Studio is ready" acknowledgement, per the approved
 * success-state design (KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md): New Room's
 * own modal already closes and navigates here ~80ms after a real, confirmed
 * project creation -- no artificial delay is added there, and no fake
 * success animation exists in the closing modal. This is the "success" the
 * brief asks for, shown once on arrival instead.
 *
 * The `kretoJustCreated` flag rides React Router's own navigation `state`
 * (set only by VoiceFirstCreateModal's `createProject`, only after its real
 * Supabase insert succeeds) rather than a query param -- state never
 * reaches the URL, so it can't be bookmarked, shared, or hand-typed to
 * spoof the acknowledgement on an unrelated visit to this route. The
 * `useState` initializer captures it once, then the effect immediately
 * replaces history with an empty state so a refresh or back/forward
 * navigation to this same entry never re-shows it.
 */
export const StudioCreatedAcknowledgement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(() => (location.state as { kretoJustCreated?: boolean } | null)?.kretoJustCreated === true);

  useEffect(() => {
    if (!(location.state as { kretoJustCreated?: boolean } | null)?.kretoJustCreated) return;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    // Intentionally runs once on mount only -- this consumes the flag from
    // the exact navigation that set it, not from any later re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-3 sm:mx-4 mt-3 rounded-lg border p-3 sm:p-4 flex items-center gap-3"
      style={{ borderColor: "hsl(var(--energy) / 0.3)", backgroundColor: "hsl(var(--energy) / 0.06)" }}
    >
      <KretoPresence size="compact" state="success" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Your Studio is ready.</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Kreto set up a starting structure you can review and shape.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
};

export default StudioCreatedAcknowledgement;
