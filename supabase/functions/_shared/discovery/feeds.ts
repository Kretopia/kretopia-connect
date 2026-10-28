// Approved public feeds as Scout candidates, through the SAME parsers Scout already uses. Pure.
import { parseArbeitnow, parseJobicy, parseRemoteOk, parseWeWorkRemotely, type ScoutCandidate } from "../scoutSources.ts";

export function parseOpportunityFeed(adapterId: string, text: string): ScoutCandidate[] {
  try {
    switch (adapterId) {
      case "remoteok": return parseRemoteOk(JSON.parse(text));
      case "jobicy": return parseJobicy(JSON.parse(text));
      case "arbeitnow": return parseArbeitnow(JSON.parse(text));
      case "weworkremotely": return parseWeWorkRemotely(text);
      default: return [];
    }
  } catch {
    return []; // an unreadable feed is a failed run, never a partial success
  }
}
