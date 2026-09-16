import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, Users, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

const JoinGuestStudio = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (!token) return;
    setStatus("joining");
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "redeem-project-guest-link",
        { body: { token } },
      );
      if (invokeErr) throw invokeErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      const projectId = (data as any)?.project_id as string | undefined;
      if (!projectId) throw new Error("No project returned");
      setStatus("joined");
      setTimeout(() => navigate(`/desk/${projectId}`), 600);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Couldn't join Studio");
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Stash so both post-auth AND post-onboarding flows route back here
      // to redeem the token (new sign-ups go through /onboarding first).
      const next = `/desk/join/${token}`;
      try { sessionStorage.setItem("thrivein_post_auth_redirect", next); } catch {}
      navigate(`/auth?redirect=${encodeURIComponent(next)}`);
      return;
    }
    if (status === "idle") join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <SEO title="Join Studio · Kretopia" description="Join a creative Studio as a guest" />
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Users className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Joining Studio…</h1>

        {status === "joining" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Hold tight, setting up your guest seat
          </div>
        )}

        {status === "joined" && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
            You're in <ArrowRight className="h-4 w-4" />
          </p>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={join} variant="default">Try again</Button>
              <Link to="/" className="text-xs text-muted-foreground underline">Go home</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinGuestStudio;
