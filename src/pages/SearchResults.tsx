import { useSearchParams } from "react-router-dom";
import { SearchV2 } from "@/components/search/SearchV2";

/**
 * /search — results surface. Seeds SearchV2 with the ?q= query submitted
 * from the navbar, hero, or landing search bars.
 */
export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  return <SearchV2 key={q} initialQuery={q} />;
}
