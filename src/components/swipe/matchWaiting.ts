import { useEffect, useState } from "react";

/** Short, true things about how Match works, one at a time, for the moments a person is waiting. */
export const MATCH_WAIT_TIPS = [
  "Every card is a real Passport. Nothing on it is invented.",
  "Pass is private: nobody is told when you pass.",
  "Messaging opens only after a mutual match.",
  "Your deck follows craft, city, past collaborations and shared interests. Nobody is hidden for scoring low.",
  "Flip a card to read the full public Passport before you decide.",
] as const;

/** The steps of a deck coming together, shown one after the other while it loads. */
export const MATCH_WAIT_STEPS = ["Reading Passports", "Matching by craft and city", "Lining up your deck"] as const;

/** Advances through `count` things every `every` ms, and stays on the first when nothing should move. */
export function useRotation(count: number, every: number, still = false): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (still || count <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), every);
    return () => window.clearInterval(id);
  }, [count, every, still]);
  return index;
}
