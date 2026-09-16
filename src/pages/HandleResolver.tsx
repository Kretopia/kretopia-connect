import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/brand/BrandDots";
import { Fingerprint } from "lucide-react";
import { BRAND } from "@/lib/brandLexicon";
import { APP_URL } from "@/lib/constants";

type Mode = "handle" | "passportId";

const HandleResolver = ({ mode }: { mode: Mode }) => {
  const params = useParams();
  const raw = mode === "handle" ? (params.handle ?? params.username) : params.passportId;
  const [status, setStatus] = useState<"loading" | "found" | "notfound">("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!raw) {
      setStatus("notfound");
      return;
    }
    (async () => {
      if (mode === "handle") {
        const clean = raw.replace(/^@/, "").toLowerCase();
        const { data } = await supabase
          .from("public_profiles_safe")
          .select("user_id")
          .ilike("username", clean)
          .maybeSingle();
        if (cancelled) return;
        if (data?.user_id) {
          setUserId(data.user_id);
          setStatus("found");
        } else {
          setStatus("notfound");
        }
      } else {
        // /passport/THR-XXXXX — match against derived id (first 5 chars of user_id hex).
        const code = raw.toUpperCase().replace(/^THR-?/, "").trim();
        if (!code) {
          setStatus("notfound");
          return;
        }
        // Pull a small batch and match client-side (rare lookup; max 200).
        const { data } = await supabase
          .from("public_profiles_safe")
          .select("user_id")
          .not("user_id", "is", null)
          .limit(500);
        if (cancelled) return;
        const hit = (data || []).find(
          (r: any) =>
            r.user_id &&
            r.user_id.replace(/-/g, "").slice(0, 5).toUpperCase() === code.slice(0, 5),
        );
        if (hit?.user_id) {
          setUserId(hit.user_id);
          setStatus("found");
        } else {
          setStatus("notfound");
        }
      }
    })().catch(() => !cancelled && setStatus("notfound"));
    return () => {
      cancelled = true;
    };
  }, [raw, mode]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <BrandLoader />
      </div>
    );
  }

  if (status === "found" && userId) {
    // Public-facing — always send to the EPK (works for signed-out + signed-in).
    return <Navigate to={`/epk/${userId}`} replace />;
  }

  // Not found — claim CTA.
  const displayed = mode === "handle" ? `@${raw?.replace(/^@/, "")}` : raw;
  return (
    <div className="accent-passport min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <SEO
        title={`${displayed} — Claim this Passport | Kretopia`}
        description={BRAND.passportHeadline}
        url={`${APP_URL}/${mode === "handle" ? raw : `passport/${raw}`}`}
      />
      <Fingerprint className="h-10 w-10 text-[hsl(var(--signal-teal))] mb-4" />
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">
        Passport not claimed
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-3">
        {displayed} is available.
      </h1>
      <p className="text-muted-foreground max-w-md mb-6">
        {BRAND.passportHeadline} Claim {displayed} before someone else does.
      </p>
      <div className="flex gap-2">
        <Button asChild className="bg-[hsl(var(--signal-teal))] text-black hover:bg-[hsl(var(--signal-teal))]/90">
          <Link to="/auth?intent=claim">Claim my Passport</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/passport">Browse the directory</Link>
        </Button>
      </div>
    </div>
  );
};

export default HandleResolver;
