/**
 * The hero's SoundStages scope opens /soundstages?q=…: the words narrow the list of stages already on that page. Matching is
 * case- and accent-insensitive on what a stage card shows (its title and its host); no words means every stage.
 */
const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function filterStagesByQuery<T extends { title: string; hostName?: string | null }>(stages: readonly T[], query: string | null | undefined): T[] {
  const words = fold((query ?? "").trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...stages];
  return stages.filter((s) => {
    const hay = fold(`${s.title} ${s.hostName ?? ""}`);
    return words.every((w) => hay.includes(w));
  });
}
