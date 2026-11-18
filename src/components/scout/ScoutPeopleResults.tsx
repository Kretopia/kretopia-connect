import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, Users } from "lucide-react";
import { searchScoutPeople, SCOUT_PEOPLE_PAGE_SIZE } from "@/lib/scoutPeopleSearch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";

export function ScoutPeopleResults({ query }: { query: string }) {
  const results = useInfiniteQuery({
    queryKey: ["scout-people", query], initialPageParam: 0,
    queryFn: ({ pageParam }) => searchScoutPeople(query, pageParam),
    getNextPageParam: (last, pages) => last.hasMore ? pages.length * SCOUT_PEOPLE_PAGE_SIZE : undefined,
    staleTime: 30_000,
  });
  const people = results.data?.pages.flatMap(page => page.users) ?? [];
  return <section aria-label="Matching Kretopia users" className="space-y-3 py-4">
    <div className="flex items-center gap-2 text-foreground"><Users className="h-4 w-4 text-primary" /><h2 className="font-semibold">People · {query}</h2></div>
    {results.isPending && <KretopiaSpinner className="h-5 w-5" />}
    {results.isError && <Button variant="outline" onClick={() => results.refetch()}>Retry people search</Button>}
    {!results.isPending && !results.isError && !people.length && <p className="text-sm text-muted-foreground">No Kretopia profiles match “{query}” yet.</p>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {people.map(person => <Button key={person.user_id} variant="outline" asChild className="h-auto justify-start gap-3 p-3 whitespace-normal">
        <Link to={`/profile/${person.user_id}`}>
          <Avatar className="h-11 w-11 shrink-0"><AvatarImage src={person.avatar_url || undefined} alt={person.full_name || ""} /><AvatarFallback>{person.full_name?.slice(0, 1) || "K"}</AvatarFallback></Avatar>
          <span className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold">{person.full_name}</span><span className="block truncate text-xs text-muted-foreground">{person.role}</span>{person.location && <span className="block truncate text-xs text-muted-foreground">{person.location}</span>}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
        </Link>
      </Button>)}
    </div>
    {results.hasNextPage && <Button variant="ghost" disabled={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>{results.isFetchingNextPage ? <KretopiaSpinner className="h-4 w-4" /> : "Show more people"}</Button>}
  </section>;
}