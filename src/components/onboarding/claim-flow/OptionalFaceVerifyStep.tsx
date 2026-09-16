import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ClaimedCredit, DraftProfile } from "./types";

interface Props {
  profile: DraftProfile;
  credits: ClaimedCredit[];
  onSkip: () => void;
  onVerified: (faceMatchScore: number, verificationToken: string | null) => void;
  onBack: () => void;
}

/**
 * Optional identity verification step.
 * If user has an avatar in their draft profile we compare it to a fresh selfie
 * via verify-profile-claim. Success → unlocks "Identity-verified" tick + boosts
 * claimed credits (badge surfaced after sign-up).
 */
export const OptionalFaceVerifyStep = ({ profile, credits, onSkip, onVerified, onBack }: Props) => {
  const [step, setStep] = useState<"intro" | "camera" | "verifying" | "failed">("intro");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    try {
      setStep("camera");
      await new Promise((r) => setTimeout(r, 80));
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(() => {});
      }
    } catch (e: any) {
      setStep("intro");
      toast.error(e?.name === "NotAllowedError" ? "Camera permission denied" : "Couldn't open camera");
    }
  };

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    const selfie = c.toDataURL("image/jpeg", 0.8);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStep("verifying");

    try {
      const profileImageUrl =
        profile.avatar_url ||
        credits.find((cr) => cr.thumbnail)?.thumbnail ||
        null;

      if (!profileImageUrl) {
        toast.error("No reference photo to compare — skipping verification");
        onSkip();
        return;
      }

      const { data, error } = await supabase.functions.invoke("verify-profile-claim", {
        body: {
          profileId: null,
          profileImageUrl,
          selfieImage: selfie,
          profileName: profile.full_name,
        },
      });
      if (error) throw error;

      if (data?.verified) {
        toast.success("Identity verified");
        onVerified(Number(data.confidence) || 0.8, data.token ?? null);
      } else {
        setStep("failed");
      }
    } catch (e: any) {
      console.error("[face-verify]", e);
      setStep("failed");
    }
  };

  if (step === "intro") {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verify your identity (optional)
          </h2>
          <p className="text-sm text-muted-foreground">
            A quick selfie compared to your photo gives you a verified tick and makes
            your claimed credits stand out as real.
          </p>
        </div>

        <div className="rounded-lg border p-3 bg-primary/5 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <b>Why verify?</b> Verified profiles rank higher, can apply to brand-only
            gigs, and credits show an "Identity-verified" badge.
          </div>
        </div>

        <Button onClick={start} className="w-full">
          <Camera className="h-4 w-4 mr-2" /> Take a quick selfie
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} size="lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={onSkip} className="flex-1">
            Skip for now
          </Button>
        </div>
      </div>
    );
  }

  if (step === "camera") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden bg-black aspect-square">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <Button onClick={capture} className="w-full">
          <Camera className="h-4 w-4 mr-2" /> Capture & verify
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full">
          Skip
        </Button>
      </div>
    );
  }

  if (step === "verifying") {
    return (
      <div className="py-12 flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Comparing photos…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-center py-6">
      <p className="font-semibold">Couldn't confirm a match</p>
      <p className="text-sm text-muted-foreground">
        You can try again with better lighting or skip — you can verify later from
        your profile.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep("intro")} className="flex-1">
          Try again
        </Button>
        <Button onClick={onSkip} className="flex-1">
          Skip
        </Button>
      </div>
    </div>
  );
};
