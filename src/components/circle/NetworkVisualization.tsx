import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, UserPlus, Gift, Trophy, Radar, ArrowUpRight, Activity, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkStats } from "@/hooks/useNetworkStats";
import { useReferralNetwork } from "@/hooks/useReferralNetwork";
import { getReferralsToNextTier } from "@/lib/referralEngine";
import { PathFinder } from "./PathFinder";
import { NetworkHealthScore } from "./NetworkHealthScore";
import { DegreeExplorerDrawer } from "./DegreeExplorerDrawer";
import type { NetworkPerson } from "./KretoNetworkScene";
import { cn } from "@/lib/utils";

const KretoNetworkScene = lazy(() => import("./KretoNetworkScene").then(m => ({ default: m.KretoNetworkScene })));

type WorkspaceTab = "reach" | "path" | "circle";

/** A single network workspace: accepted people in the scene, optional detail below it. */
export const NetworkVisualization = ({ onInvite, connections = [] }: { onInvite: () => void; connections?: NetworkPerson[] }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { stats, loading, error } = useNetworkStats(user?.id);
  const network = useReferralNetwork();
  const next = getReferralsToNextTier(network.referralCount);
  const [tab, setTab] = useState<WorkspaceTab>("reach");
  const [degree, setDegree] = useState<1 | 2 | 3>(1);
  const [drawer, setDrawer] = useState(false);
  const explore = (value: 1 | 2 | 3) => { setDegree(value); setDrawer(true); };
  return <section className="min-w-0" aria-label="Your Creative Universe">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><BrandLogo iconOnly size="sm" /><div><h2 className="text-lg font-bold text-foreground">Your Creative <span className="k-gradient-text">Universe</span></h2><p className="mt-1 text-xs text-muted-foreground">Kreto · The Executive Producer</p></div></div>
      <Button variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={onInvite}><UserPlus className="h-3.5 w-3.5" />Invite</Button>
    </header>
    <Suspense fallback={<div className="flex h-[390px] items-center justify-center"><KretopiaSpinner className="h-8 w-8" /></div>}><KretoNetworkScene connections={connections} onProfile={id => navigate(`/profile/${id}`)} /></Suspense>
    <div className="border-y border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-2"><Compass className="h-4 w-4 shrink-0 text-muted-foreground" /><h3 className="text-sm font-bold">Connection intelligence</h3></div>
        <span className="text-xs tabular-nums text-muted-foreground">{connections.length} accepted connections</span>
      </div>
      <div className="flex max-w-full gap-1 overflow-x-auto pb-3" role="group" aria-label="Network tools">
        {([ ["reach", "Your Network Reach", Activity], ["path", "Find Connection Path", Search], ["circle", "Creative Circle", Gift] ] as const).map(([id, label, Icon]) => <Button key={id} variant="ghost" size="sm" aria-pressed={tab === id} onClick={() => setTab(id)} className={cn("shrink-0 gap-1.5 rounded-full text-xs", tab === id && "bg-muted text-foreground")}><Icon className="h-3 w-3" />{label}</Button>)}
      </div>
      <div className="pb-4">
        {tab === "reach" && <div className="space-y-4">
          <div className="flex items-end justify-between gap-2"><span className="text-xs text-muted-foreground">Creators within 3 degrees</span><span className="text-2xl font-bold tabular-nums">{loading ? <KretopiaSpinner className="h-5 w-5" /> : error ? "—" : stats.totalReach.toLocaleString()}</span></div>
          {error ? <p role="status" className="text-xs text-muted-foreground">Network reach is unavailable right now.</p> : <div className="grid grid-cols-3 divide-x divide-border border-y border-border py-3">
            {([ [1, "Direct", stats.degree1], [2, "Friends of friends", stats.degree2], [3, "Extended", stats.degree3] ] as const).map(([value, label, count]) => <Button key={value} variant="ghost" className="h-auto min-w-0 flex-col gap-1 whitespace-normal rounded-none px-2 py-1" disabled={loading || count === 0} onClick={() => explore(value)} aria-label={`View ${value}${value === 1 ? "st" : value === 2 ? "nd" : "rd"} degree connections`}><span className="text-lg font-bold tabular-nums">{loading ? "—" : count}</span><span className="text-[10px] font-normal text-muted-foreground">{label}</span><ArrowUpRight className="h-3 w-3 text-muted-foreground" /></Button>)}
          </div>}
          <NetworkHealthScore compact embedded />
        </div>}
        {tab === "path" && <PathFinder embedded />}
        {tab === "circle" && <div className="space-y-3">
          <div className="flex items-center justify-between gap-2"><div><p className="text-sm font-semibold">{network.tier.label}</p><p className="mt-1 text-xs text-muted-foreground">{next ? `${next.remaining} more to ${next.next.label}` : network.tier.tagline}</p></div><span className="text-2xl font-bold tabular-nums">{network.referralCount}</span></div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={onInvite}><UserPlus className="mr-1 h-3 w-3" />Invite</Button><Button variant="outline" size="sm" onClick={() => navigate("/creative-circle")}><Gift className="mr-1 h-3 w-3" />Rewards</Button></div>
        </div>}
      </div>
    </div>
    <footer className="flex flex-wrap items-center gap-2 pt-3"><Button variant="ghost" size="sm" onClick={() => navigate("/credits")}><Trophy className="mr-1.5 h-3.5 w-3.5" />Kretopia Credits</Button><Button variant="ghost" size="sm" onClick={() => navigate("/scout?tab=all")}><Radar className="mr-1.5 h-3.5 w-3.5" />Find Gigs</Button></footer>
    <DegreeExplorerDrawer open={drawer} onOpenChange={setDrawer} initialDegree={degree} />
  </section>;
