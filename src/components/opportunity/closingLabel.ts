import { format, parseISO } from "date-fns";

/** "Closes Nov 12" for a deadline that has not passed; nothing for a missing, invalid or past one. */
export function closingLabel(deadline: string | null | undefined, now: Date = new Date()): string | null {
  if (!deadline) return null;
  const date = parseISO(deadline);
  if (Number.isNaN(date.getTime()) || date.getTime() < now.getTime()) return null;
  return `Closes ${format(date, "MMM d")}`;
}
