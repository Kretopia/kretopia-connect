import { formatStatLine, type ModelStats } from "@/lib/modelUnits";

interface Props {
  name: string;
  agency?: string | null;
  unions?: string[] | null;
  categories?: string[] | null;
  stats?: ModelStats | null;
  images: string[]; // up to 5 in slot order (Headshot, Profile, Full Body, Editorial, Swim/Fit)
  contact?: string | null;
}

const SLOT_LABELS = ["Headshot", "Profile", "Full Body", "Editorial", "Swim / Fit"];

/**
 * Industry-standard 5.5" × 8.5" comp card preview, rendered at any container width.
 * Front side. Print-friendly via @media print if pulled into a print sheet.
 */
export function CompCardPreview({ name, agency, unions, categories, stats, images, contact }: Props) {
  const filled = Array.from({ length: 5 }, (_, i) => images[i] || null);
  const hero = filled[0];
  const others = filled.slice(1);

  return (
    <div
      className="w-full mx-auto bg-card text-card-foreground border border-border shadow-sm overflow-hidden"
      style={{ aspectRatio: "5.5 / 8.5" }}
    >
      <div className="grid grid-cols-2 grid-rows-[1.4fr_1fr_1fr] h-full gap-0.5 bg-border p-0.5">
        {/* Hero / Headshot — spans both cols, top row */}
        <div className="col-span-2 bg-muted relative overflow-hidden">
          {hero ? (
            <img src={hero} alt="Headshot" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">{SLOT_LABELS[0]}</div>
          )}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <div className="text-white font-serif text-xl leading-tight truncate">{name}</div>
            {(agency || (unions && unions.length)) && (
              <div className="text-white/80 text-[10px] uppercase tracking-wide truncate">
                {[agency, unions?.[0]].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>

        {/* Four secondary slots */}
        {others.map((src, i) => (
          <div key={i} className="bg-muted relative overflow-hidden">
            {src ? (
              <img src={src} alt={SLOT_LABELS[i + 1]} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">{SLOT_LABELS[i + 1]}</div>
            )}
          </div>
        ))}
      </div>

      {/* Footer strip — stats + contact */}
      <div className="absolute" />
      <div className="bg-card px-3 py-2 border-t border-border text-[10px] leading-tight">
        <div className="font-medium truncate">{formatStatLine(stats, "metric")}</div>
        {categories?.length ? <div className="text-muted-foreground truncate">{categories.slice(0, 4).join(" · ")}</div> : null}
        {contact ? <div className="text-muted-foreground truncate">{contact}</div> : null}
      </div>
    </div>
  );
}
