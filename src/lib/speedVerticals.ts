// Speed Session vertical taxonomy. Keep in sync with the CHECK constraint on
// public.speed_sessions.vertical.
export type SpeedVertical =
  | "open"
  | "producers_singers"
  | "filmmakers"
  | "content_creators"
  | "artists"
  | "photographers"
  | "dancers"
  | "writers"
  | "designers"
  | "models";

export interface SpeedVerticalMeta {
  id: SpeedVertical;
  label: string;
  emoji: string;
  blurb: string;
}

export const SPEED_VERTICALS: SpeedVerticalMeta[] = [
  { id: "open",              label: "Open Night",        emoji: "🌐", blurb: "All disciplines welcome." },
  { id: "producers_singers", label: "Producers × Singers", emoji: "🎧", blurb: "Beatmakers meet vocalists." },
  { id: "filmmakers",        label: "Filmmakers",        emoji: "🎬", blurb: "Directors, DPs, editors, writers." },
  { id: "content_creators",  label: "Content Creators",  emoji: "📱", blurb: "Short-form, YouTube, podcasts." },
  { id: "artists",           label: "Visual Artists",    emoji: "🎨", blurb: "Painters, illustrators, 3D, NFT." },
  { id: "photographers",     label: "Photographers",     emoji: "📷", blurb: "Editorial, fashion, commercial, doc." },
  { id: "dancers",           label: "Dancers",           emoji: "💃", blurb: "Choreographers, performers, teachers." },
  { id: "writers",           label: "Writers",           emoji: "✍️", blurb: "Screen, copy, journalism, fiction." },
  { id: "designers",         label: "Designers",         emoji: "🖌️", blurb: "Brand, product, motion, fashion." },
  { id: "models",            label: "Models",            emoji: "👤", blurb: "Talent meets creatives & agencies." },
];

export function getVerticalMeta(id: string | null | undefined): SpeedVerticalMeta {
  return SPEED_VERTICALS.find((v) => v.id === id) ?? SPEED_VERTICALS[0];
}
