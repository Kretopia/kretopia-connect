/**
 * KretoFab — V1 wrapper around the existing ThriveAgentFab.
 *
 * The underlying agent code, tools, and Realtime plumbing all stay put.
 * This wrapper exists so V1 surfaces mount `<KretoFab />` and we can
 * swap the implementation later without touching every callsite.
 */
import { ThriveAgentFab } from "@/components/desk/ThriveAgentFab";

export function KretoFab() {
  return <ThriveAgentFab />;
}

export default KretoFab;
