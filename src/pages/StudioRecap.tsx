import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, CheckCircle2, Sparkles, ArrowRight, Camera, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { moodGradient, moodLabel } from "@/components/project/studio/moodGradient";
import { format } from "date-fns";
import { BrandLogo } from "@/components/BrandLogo";

type RecapProject = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  mood: string | null;
  workspace_type: string;
  status: string | null;
  client_name: string | null;
  deadline: string | null;
  created_at: string | null;
  updated_at: string | null;
  recap_summary: string | null;
};

type Person = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  role?: string | null;
};

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  due_date: string | null;
  completed_at: string | null;
};

type Deliverable = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  moodboard: any;
  completed_at: string | null;
};

type Recap = {
  project: RecapProject;
  owner: Person | null;
  collaborators: Person[];
  milestones: Milestone[];
  deliverables: Deliverable[];
};

const initials = (name?: string | null) =>
  (name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const firstThumb = (moodboard: any): string | null => {
  if (!moodboard) return null;
  if (Array.isArray(moodboard) && moodboard.length > 0) {
    const item = moodboard[0];
    return typeof item === "string" ? item : item?.url || item?.image_url || null;
  }
  if (typeof moodboard === "object" && Array.isArray(moodboard.items)) {
    return moodboard.items[0]?.url || moodboard.items[0]?.image_url || null;
  }
  return null;
};

const StudioRecap = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState<Recap | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_studio_recap", { token });
      if (!active) return;
      if (error || !data) {
        setRecap(null);
      } else {
        setRecap(data as unknown as Recap);
      }
      setLoading(false);
    })().catch(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!recap) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-background">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Camera className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold mb-1">Recap not found</h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-5">
          This studio recap may have been unpublished or the link is invalid.
        </p>
        <Button asChild>
          <Link to="/">Go to Kretopia</Link>
        </Button>
      </div>
    );
  }

  const { project, owner, collaborators, milestones, deliverables } = recap;
  const allCrew: Person[] = [
    ...(owner ? [{ ...owner, role: "Lead" }] : []),
    ...collaborators,
  ];
  const deliveredCount = deliverables.length;
  const milestonesDone = milestones.filter((m) => m.status === "completed" || m.completed_at).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>{project.title} · Studio Recap · Kretopia</title>
        <meta name="description" content={project.recap_summary || project.description || `${project.title} — a studio recap on Kretopia.`} />
        <meta property="og:title" content={`${project.title} — Studio Recap`} />
        <meta property="og:description" content={project.recap_summary || project.description || "Built in a Kretopia Studio."} />
        {project.cover_url && <meta property="og:image" content={project.cover_url} />}
        <link rel="canonical" href={`https://www.kretopia.com/studio/${token}`} />
      </Helmet>

      {/* Top bar */}
      <header className="px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo className="h-6 w-auto" />
        </Link>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/auth">
            Open a Studio
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="px-4">
        <div
          className="relative overflow-hidden rounded-3xl ring-1 ring-border min-h-[260px] sm:min-h-[340px] flex flex-col justify-end p-6 sm:p-8"
          style={{
            backgroundImage: project.cover_url
              ? `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%), url(${project.cover_url})`
              : moodGradient(project.mood),
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative z-10 text-white">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase opacity-90 mb-2">
              Studio Recap · {moodLabel(project.mood)}
            </p>
            <h1 className="text-3xl sm:text-5xl font-black tracking-[-0.03em] leading-[1.02] drop-shadow">
              {project.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {project.client_name && (
                <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1 font-medium">
                  For {project.client_name}
                </span>
              )}
              {project.deadline && (
                <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(project.deadline), "MMM yyyy")}
                </span>
              )}
              <span className="inline-flex items-center gap-1 bg-emerald-500/90 text-white rounded-full px-2.5 py-1 font-bold">
                <CheckCircle2 className="h-3 w-3" />
                Wrapped
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Summary */}
      {(project.recap_summary || project.description) && (
        <section className="px-4 mt-6 max-w-2xl">
          <p className="text-base sm:text-lg leading-relaxed text-foreground/90">
            {project.recap_summary || project.description}
          </p>
        </section>
      )}

      {/* Stats strip */}
      <section className="px-4 mt-6 grid grid-cols-3 gap-2 max-w-2xl">
        <div className="rounded-xl border border-border bg-card/50 p-3">
          <p className="text-2xl font-black">{allCrew.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Crew</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-3">
          <p className="text-2xl font-black">{deliveredCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Delivered</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-3">
          <p className="text-2xl font-black">{milestonesDone}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Milestones</p>
        </div>
      </section>

      {/* Crew — roll call */}
      {allCrew.length > 0 && (
        <section className="px-4 mt-8 max-w-3xl">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">
            The Crew
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allCrew.map((p) => {
              const node = (
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/50 p-2.5 hover:bg-card transition-colors">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback>{initials(p.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.full_name || "Creative"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.role ? p.role.replace(/_/g, " ") : (p.headline || "Collaborator")}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={p.user_id}>
                  {p.username ? (
                    <Link to={`/@${p.username}`}>{node}</Link>
                  ) : (
                    node
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Deliverables */}
      {deliverables.length > 0 && (
        <section className="px-4 mt-8 max-w-3xl">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">
            What Shipped
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deliverables.map((d) => {
              const thumb = firstThumb(d.moodboard);
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-border bg-card/50 overflow-hidden"
                >
                  <div
                    className="aspect-video bg-muted flex items-center justify-center"
                    style={
                      thumb
                        ? {
                            backgroundImage: `url(${thumb})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : { background: moodGradient(project.mood) }
                    }
                  >
                    {!thumb && <ImageIcon className="h-6 w-6 text-white/80" />}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold leading-tight">{d.title}</p>
                    {d.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {d.description}
                      </p>
                    )}
                    <Badge variant="secondary" className="mt-2 text-[10px] font-bold uppercase">
                      {d.status}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Milestones timeline */}
      {milestones.length > 0 && (
        <section className="px-4 mt-8 max-w-2xl">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">
            The Journey
          </h2>
          <ol className="space-y-3">
            {milestones.map((m) => {
              const done = m.status === "completed" || !!m.completed_at;
              return (
                <li key={m.id} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div
                      className={`h-3 w-3 rounded-full ring-2 ${
                        done
                          ? "bg-primary ring-primary/30"
                          : "bg-muted ring-border"
                      }`}
                    />
                    <div className="flex-1 w-px bg-border mt-1" />
                  </div>
                  <div className="flex-1 pb-2">
                    <p className={`text-sm font-semibold ${done ? "" : "text-muted-foreground"}`}>
                      {m.title}
                    </p>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                    )}
                    {(m.completed_at || m.due_date) && (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1">
                        {m.completed_at
                          ? `Done · ${format(new Date(m.completed_at), "MMM d, yyyy")}`
                          : `Due · ${format(new Date(m.due_date!), "MMM d, yyyy")}`}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Footer CTA */}
      <section className="px-4 mt-12 max-w-2xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ring-1 ring-primary/30 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">
                Run your next project in a Studio like this one.
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                Brief → tasks → files → payments → credits. One room, your whole crew, your whole client.
              </p>
              <Button asChild size="sm" className="mt-3 gap-1.5">
                <Link to="/auth">
                  Start a Studio
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StudioRecap;
