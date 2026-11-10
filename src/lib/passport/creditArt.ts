import type { KretoSceneId } from "@/components/brand/kretoScenes";

/**
 * The picture a Kretopia credit wears when it has no cover of its own, or when its cover cannot be loaded.
 *
 * It is one of Kreto's approved scenes (src/assets/brand/kreto/scenes, the master set in components/brand/kretoScenes.ts): nothing is
 * generated, downloaded or fetched. It is chosen from the credit's own id, so the same credit gets the same picture on every render, on
 * every device and for every viewer, and two credits next to each other usually differ.
 *
 * Only the environments are used (Kreto at a desk, in a place). The product expressions each belong to one feature (Match, KrePay,
 * Scout, ...) and would read as that feature's art on someone's work history; the interim crops are not part of the master set.
 */
export const CREDIT_SCENES: readonly KretoSceneId[] = ["coworking", "music-studio", "office", "workspace", "bg-gradient"];

/** FNV-1a over the id's characters: small, dependency-free and the same everywhere. */
function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The scene for a credit id. An empty or missing id still gets one (always the same), so a card never lacks a picture. */
export function creditSceneFor(creditId: string | null | undefined): KretoSceneId {
  return CREDIT_SCENES[hashId((creditId ?? "").trim()) % CREDIT_SCENES.length];
}
