import type { FaqItem } from "@/lib/eventSections";

/** What the host wrote in a section, one entry per line. Plain text only: it is never read as markup. */
export function SectionLines({ text, bullets = false }: { text: string; bullets?: boolean }) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  return bullets ? (
    <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
      {lines.map((line, index) => <li key={index}>{line}</li>)}
    </ul>
  ) : (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      {lines.map((line, index) => <li key={index}>{line}</li>)}
    </ul>
  );
}

/** The host's own FAQ entries. */
export function SectionFaq({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index}>
          <h4 className="font-medium">{item.question}</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.answer}</p>
        </div>
      ))}
    </div>
  );
}
