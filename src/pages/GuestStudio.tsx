import { useEffect, useState, useCallback } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Sparkles, FileText, Folder, MessageCircle, UserPlus, ShieldCheck, Target, Send, Link2, Download, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { formatDistanceToNow } from "date-fns";

const STORAGE_KEY = (token: string) => `guest_studio:${token}`;

interface ProjectInfo {
  project_id: string;
  title: string;
  description: string | null;
  workspace_type: string | null;
  status: string | null;
  created_by: string;
  client_name: string | null;
  cover_url: string | null;
}

export default function GuestStudio() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"brief" | "drop" | "vault" | "chat">("brief");

  // Drop / Vault / Roster data
  const [files, setFiles] = useState<any[]>([]);
  const [pulse, setPulse] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [dropText, setDropText] = useState("");
  const [dropping, setDropping] = useState(false);

  const loadGuestData = useCallback(async () => {
    if (!token) return;
    try {
      const [{ data: f }, { data: p }, { data: r }] = await Promise.all([
        supabase.rpc("get_guest_files", { _token: token }),
        supabase.rpc("get_guest_pulse", { _token: token }),
        supabase.rpc("get_guest_collaborators", { _token: token }),
      ]);
      setFiles(f || []);
      setPulse(p || []);
      setRoster(r || []);
    } catch (e) {
      console.warn("[guest-studio] data load failed", e);
    }
  }, [token]);

  // Resolve token → project
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // If the viewer is signed in AND this token was minted for their email,
        // auto-promote them to a real collaborator and send them to the real Studio.
        // (Guests stay on the read-only preview as before.)
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: promotedProjectId } = await supabase.rpc(
              "promote_guest_token_to_collaborator",
              { _token: token },
            );
            if (!active) return;
            if (promotedProjectId) {
              // Verify membership before redirecting (RPC returns the project_id
              // even when emails don't match; only redirect when we're really in).
              const { data: membership } = await supabase
                .from("project_collaborators")
                .select("id")
                .eq("project_id", promotedProjectId)
                .eq("user_id", user.id)
                .eq("status", "accepted")
                .maybeSingle();
              if (membership) {
                navigate(`/desk/${promotedProjectId}`, { replace: true });
                return;
              }
            }
          }
        } catch (e) {
          console.warn("[guest-studio] auto-promote skipped", e);
        }

        const { data, error } = await supabase
          .rpc("get_project_for_guest", { _token: token })
          .maybeSingle();
        if (!active) return;
        if (error || !data) {
          setProject(null);
          setLoading(false);
          return;
        }
        setProject(data as ProjectInfo);

        const cached = localStorage.getItem(STORAGE_KEY(token));
        if (cached) {
          const parsed = JSON.parse(cached);
          setName(parsed.name || "");
          setEmail(parsed.email || "");
          await supabase.rpc("register_guest_session", {
            _token: token,
            _name: parsed.name,
            _email: parsed.email,
          });
        } else {
          setNeedsName(true);
        }
      } catch (e) {
        console.warn("[guest-studio] load failed", e);
        if (active) setProject(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, navigate]);

  const handleEnter = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email needed", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("register_guest_session", {
        _token: token,
        _name: name.trim(),
        _email: email.trim(),
      });
      if (error) throw error;
      localStorage.setItem(
        STORAGE_KEY(token),
        JSON.stringify({ name: name.trim(), email: email.trim() }),
      );
      setNeedsName(false);
      loadGuestData();
    } catch (e: any) {
      toast({ title: "Couldn't continue", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Load room data once we have a session
  useEffect(() => {
    if (!project || needsName) return;
    loadGuestData();
  }, [project, needsName, loadGuestData]);

  const handleDrop = async () => {
    const body = dropText.trim();
    if (!body) return;
    setDropping(true);
    try {
      const isUrl = /^https?:\/\//i.test(body);
      const { error } = await supabase.rpc("guest_drop_post", {
        _token: token,
        _content: body,
        _kind: isUrl ? "link" : "note",
      });
      if (error) throw error;
      setDropText("");
      toast({ title: "Dropped 🎯", description: "The team will see this." });
      loadGuestData();
    } catch (e: any) {
      toast({ title: "Couldn't drop", description: e.message, variant: "destructive" });
    } finally {
      setDropping(false);
    }
  };

  const openFile = async (path: string, name: string) => {
    try {
      const { data } = await supabase.storage.from("project-files").createSignedUrl(path, 3600, { download: name });
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast({ title: "Couldn't open file", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">Link expired or invalid</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Ask your collaborator to send you a fresh Studio link.
        </p>
        <Button className="mt-5" onClick={() => navigate("/")}>Go to Kretopia</Button>
      </div>
    );
  }

  if (needsName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <SEO
          title={`Join "${project.title}" on Kretopia`}
          description={`You've been invited to the "${project.title}" Studio — view the brief, share references and chat with the team.`}
        />
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-1.5">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 mb-1">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                You're invited
              </p>
              <h1 className="text-xl font-black tracking-tight leading-tight">{project.title}</h1>
              <p className="text-xs text-muted-foreground">
                A private Studio on Kretopia — brief, files, references and chat in one place.
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 border border-border/60 p-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                What you get
              </p>
              <ul className="text-xs space-y-1 text-foreground/90">
                <li>· Read the brief and see the team</li>
                <li>· Drop links, notes & references for the team</li>
                <li>· Get updates by email when things move</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="g-name">Your name</Label>
              <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-email">Email</Label>
              <Input id="g-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
              <p className="text-[10px] text-muted-foreground leading-snug">
                We use it to send you Studio updates only — no spam, no password to set up.
              </p>
            </div>
            <Button className="w-full" onClick={handleEnter} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter the Studio →"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Bookmark this link to come back any time.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header
        className="relative h-32 px-4 flex items-end pb-3"
        style={{
          backgroundImage: project.cover_url
            ? `linear-gradient(180deg, hsl(var(--background)/0.2), hsl(var(--background)/0.95)), url(${project.cover_url})`
            : undefined,
          backgroundColor: project.cover_url ? undefined : "hsl(var(--color-accent) / 0.16)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            Guest Studio · {project.workspace_type ?? "Project"}
          </p>
          <h1 className="text-xl font-black tracking-tight">{project.title}</h1>
          {name && <p className="text-[11px] text-muted-foreground">Hey {name.split(" ")[0]} 👋</p>}
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-background border-b border-border flex gap-1 px-2 overflow-x-auto">
        {[
          { id: "brief", label: "Brief", Icon: FileText },
          { id: "drop", label: "Drop Zone", Icon: Target },
          { id: "vault", label: "Vault", Icon: Folder },
          { id: "chat", label: "Team", Icon: MessageCircle },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <main className="px-4 py-5 space-y-4">
        {tab === "brief" && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-bold">The Brief</h2>
              {project.description ? (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {project.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  The team is still putting the brief together.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "drop" && (
          <div className="space-y-4">
            {/* Cinematic skydive target */}
            <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6 overflow-hidden">
              <div className="relative aspect-[16/10] flex items-center justify-center mb-4">
                <div className="absolute h-40 w-40 rounded-full border-2 border-primary/20" />
                <div className="absolute h-28 w-28 rounded-full border-2 border-primary/30" />
                <div className="absolute h-16 w-16 rounded-full border-2 border-primary/40" />
                <div className="relative h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                  <Target className="h-5 w-5" />
                </div>
              </div>
              <p className="text-center text-xs font-bold uppercase tracking-wider text-primary mb-1">
                Drop Zone 🎯
              </p>
              <p className="text-center text-xs text-muted-foreground mb-3">
                Drop a link, image, or quick note. The team's Copilot routes it.
              </p>
              <Textarea
                value={dropText}
                onChange={(e) => setDropText(e.target.value)}
                placeholder="Paste a reference link or thought…"
                className="min-h-[80px] text-sm bg-background"
              />
              <Button
                onClick={handleDrop}
                disabled={dropping || !dropText.trim()}
                className="w-full mt-2 gap-1.5"
              >
                {dropping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Drop 🎯
              </Button>
            </div>

            {/* Recent drops */}
            {pulse.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                  Recent drops
                </p>
                {pulse.slice(0, 8).map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold">{p.author_name}{p.is_guest && " · Guest"}</span>
                        <span className="text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                      </div>
                      {p.kind === "link" || /^https?:\/\//i.test(p.content || "") ? (
                        <a href={p.content} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1 break-all">
                          <Link2 className="h-3 w-3 shrink-0" /> {p.content}
                        </a>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{p.content}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "vault" && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">The Vault</h2>
                <span className="text-[11px] text-muted-foreground">{files.length} {files.length === 1 ? "file" : "files"}</span>
              </div>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No files yet. The team will share them here.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {files.map((f) => (
                    <li key={f.id} className="py-2.5 flex items-center gap-3">
                      <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.file_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => openFile(f.file_url, f.file_name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1 pt-1">
                <Lock className="h-3 w-3" /> Read-only · Claim your profile to upload directly
              </p>
            </CardContent>
          </Card>
        )}

        {tab === "chat" && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-bold">Who's in the room</h2>
              {roster.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Just the owner so far.</p>
              ) : (
                <ul className="space-y-2">
                  {roster.map((m) => (
                    <li key={m.user_id} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={m.avatar_url || undefined} />
                        <AvatarFallback>{(m.full_name || "?").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.full_name}</p>
                        {m.role && <p className="text-[11px] text-muted-foreground capitalize">{m.role}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground italic pt-2">
                Live chat is unlocked when you claim your profile — keeps things accountable.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Persistent Sign in / Sign up CTA */}
      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Get full Studio access</p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Sign in or create your free Kretopia account to collaborate.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const params = new URLSearchParams({ redirect: `/guest/${token}` });
                if (email) params.set("email", email);
                navigate(`/auth?mode=signin&${params.toString()}`);
              }}
              className="font-semibold"
            >
              Sign in
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const params = new URLSearchParams({ redirect: `/guest/${token}` });
                if (email) params.set("email", email);
                if (name) params.set("name", name);
                navigate(`/auth?mode=signup&${params.toString()}`);
              }}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
            >
              Sign up
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
