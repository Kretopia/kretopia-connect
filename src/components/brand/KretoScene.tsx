import { cn } from "@/lib/utils";
import { KRETO_SCENES, type KretoSceneId } from "./kretoScenes";

export type { KretoSceneId } from "./kretoScenes";

interface KretoSceneProps {
  scene: KretoSceneId;
  /** Size and shape come from the slot (`h-full w-full`, `h-14 w-28 rounded-xl`, ...). */
  className?: string;
  /** Off for the first screenful, on everywhere else. */
  lazy?: boolean;
}

/** One of the library's scenes as decorative art: it never carries information, so it has no alt text. */
export function KretoScene({ scene, className, lazy = true }: KretoSceneProps) {
  const asset = KRETO_SCENES[scene];
  return (
    <img
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      loading={lazy ? "lazy" : undefined}
      className={cn("pointer-events-none select-none object-cover", className)}
      style={{ objectPosition: asset.position }}
    />
  );
}

export default KretoScene;
