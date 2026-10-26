import { PublicPresenceSearch } from "@/components/search/PublicPresenceSearch";
import type { WebCreditResult } from "./types";

interface Props {
  initialQuery?: string;
  onResults: (results: WebCreditResult[], query: string) => void;
}

/** Legacy entry reuses pre-account discovery; selected sources remain unverified. */
export const SearchOrPasteStep = ({ initialQuery = "", onResults }: Props) => (
  <PublicPresenceSearch initialQuery={initialQuery} onContinue={() => {
    try {
      const raw = sessionStorage.getItem("pending_presence_claim");
      if (!raw) return;
      const intent = JSON.parse(raw);
      if (intent.verified !== false || !Array.isArray(intent.links)) return;
      onResults(intent.links.map((r: { title: string; url: string; description?: string; kind?: string }) => ({
        title: r.title, url: r.url, description: r.description, type: r.kind,
      })), intent.query);
    } catch { /* Storage unavailable: discovery still works without asserting identity. */ }
  }} />
);
