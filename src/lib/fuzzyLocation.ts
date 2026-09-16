/**
 * Fuzzy Location Privacy
 * Jitters coordinates by ~1km to protect user privacy on the map.
 * Uses a deterministic seed based on the user ID so the same user
 * always appears in the same jittered position (stable across renders).
 */

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// Simple seeded pseudo-random number generator
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Apply fuzzy jitter to coordinates (~0.5-1.5km offset).
 * The offset is deterministic based on the entity ID.
 */
export function fuzzyCoordinates(
  lat: number,
  lng: number,
  entityId: string,
  precision: 'exact' | 'approximate' | 'area_only' = 'approximate'
): { lat: number; lng: number } {
  if (precision === 'exact') return { lat, lng };

  const seed = hashCode(entityId);
  const rand = seededRandom(seed);

  // ~1km jitter for approximate, ~3km for area_only
  const maxOffset = precision === 'area_only' ? 0.027 : 0.009; // degrees (~1km at equator)
  
  const latOffset = (rand() - 0.5) * 2 * maxOffset;
  const lngOffset = (rand() - 0.5) * 2 * maxOffset;

  return {
    lat: lat + latOffset,
    lng: lng + lngOffset,
  };
}
