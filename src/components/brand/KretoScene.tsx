import { cn } from "@/lib/utils";
import { KRETO_SCENES, type KretoSceneId } from "./kretoScenes";

export type { KretoSceneId } from "./kretoScenes";

interface KretoSceneProps {
  scene: KretoSceneId;
  /** Size and shape come from the slot (`h-full w-full`, `h-14 w-28 rounded-xl`, ...). */
  className?: string;
  /** Off for the first screenful, on everywhere else. */
  lazy?: boolean;
  /**
   * "thumb" is the 480 px file, for a slot up to about 240 px wide; "full" is
   * the 1280 px file, for banners and heroes. A scene with no thumb (the
   * interim crops) always uses its one file.
   */
  size?: "thumb" | "full";
  /** Called when the file cannot be loaded, so a slot that must never be blank can fall back to something else. */
  onError?: () => void;
}

/** One of Kreto's scenes as decorative art: it never carries information, so it has no alt text. */
export function KretoScene({ scene, className, lazy = true, size = "full", onError }: KretoSceneProps) {
  const asset = KRETO_SCENES[scene];
  const file = size === "thumb" && asset.thumb ? asset.thumb : asset;
  return (
    <img
      src={file.src}
      width={file.width}
      height={file.height}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      loading={lazy ? "lazy" : undefined}
      onError={onError}
      className={cn("pointer-events-none select-none object-cover", className)}
      style={{ objectPosition: asset.position }}
    />
  );
}

export default KretoScene;
