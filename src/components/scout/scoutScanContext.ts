import { createContext, useContext } from "react";

import type { ScoutActionRow, ScoutedGig } from "./scout.types";

export interface ScoutScanResult {
  title: string;
  description?: string;
  at: number;
}

export interface ScoutScanValue {
  userId: string | undefined;
  /** Scouted gigs for this person, dismissed and empty-shell listings already left out. */
  gigs: ScoutedGig[];
  loading: boolean;
  /** The list could not be read; `gigs` may be stale or empty because of that, not because nothing was found. */
  listError: boolean;
  queryKey: readonly ["scouted-gigs", string | undefined];
  actions: ScoutActionRow[];
  /** The actions have been read at least once, so counts built from them are not guesses. */
  actionsReady: boolean;
  /** The two Passport fields Scout's top section compares gigs with. Null until read, or when absent. */
  profile: { role: string | null; location: string | null } | null;
  progress: { saved: number; applied: number; won: number };
  /** When Scout last checked the boards, whatever started it. */
  lastRunAt: string | null;
  /** A full scan (Scan now, or first arrival) is running. */
  scanning: boolean;
  /** The quiet refresh of the public boards is running. */
  liveRefreshing: boolean;
  /** Either of the two: a second request would be a duplicate. */
  busy: boolean;
  scanElapsed: number;
  /** Why the last scan could not complete, in words a person can act on. */
  scanUnavailable: string | null;
  /** What a degraded scan could not use. */
  scanNote: string | null;
  /** What the last scan that had something to say said. */
  lastResult: ScoutScanResult | null;
  scanNow: (opts?: { auto?: boolean; mode?: "full" | "live" }) => Promise<void>;
}

export const ScoutScanContext = createContext<ScoutScanValue | null>(null);

/** The scan state if a provider is above, else null (the section then mounts its own). */
export const useOptionalScoutScan = () => useContext(ScoutScanContext);

export function useScoutScan(): ScoutScanValue {
  const value = useContext(ScoutScanContext);
  if (!value) throw new Error("useScoutScan must be used inside <ScoutScanProvider>");
  return value;
}
