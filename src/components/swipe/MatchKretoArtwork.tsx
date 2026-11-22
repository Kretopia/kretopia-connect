import { useState } from "react";
import wave from "@/assets/brand/kreto/kreto-match-pose-hd-0.webp.asset.json";
import scout from "@/assets/brand/kreto/kreto-match-pose-hd-1.webp.asset.json";
import passport from "@/assets/brand/kreto/kreto-match-pose-hd-2.webp.asset.json";
import welcome from "@/assets/brand/kreto/kreto-match-pose-hd-3.webp.asset.json";
import { cn } from "@/lib/utils";

const poses = [wave, scout, passport, welcome];
let nextPose = 0;

/** Rotate cached official-character artwork, never generate media during discovery. */
export function MatchKretoArtwork({ className }: { className?: string }) {
  const [pose] = useState(() => poses[nextPose++ % poses.length]);
  return <img src={pose?.url} width={2048} height={2048} alt="" aria-hidden draggable={false}
    decoding="async" className={cn("h-full w-full object-contain", className)} />;
}