import type { ImportProvider } from "./types.ts";
import { csvProvider } from "./providers/csv.ts";
import { slackProvider } from "./providers/slack.ts";
import { notionProvider } from "./providers/notion.ts";
import { mondayProvider } from "./providers/monday.ts";

// Adding a provider = write an adapter that satisfies ImportProvider and register it here.
export const PROVIDERS: Record<string, ImportProvider> = {
  csv: csvProvider,
  slack_export: slackProvider,
  notion: notionProvider,
  monday: mondayProvider,
};

export function getProvider(id: string): ImportProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown import provider: ${id}`);
  return p;
}
